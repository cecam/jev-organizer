import { MarkdownView, Notice, Plugin, TFile, TFolder, normalizePath, requestUrl } from 'obsidian';
import { JevClient } from './client';
import { Organizer, type Snapshot } from './organizer';
import { loadSettings, renameConfiguredPaths, type Settings } from './settings';
import { OrganizerSettingsTab } from './settings-tab';

export default class JevOrganizerPlugin extends Plugin {
  declare settings: Settings;
  client!: JevClient;
  organizer!: Organizer<TFile>;
  private loaded = false;
  private revisions = new WeakMap<TFile, number>();
  private saveQueue: Promise<void> = Promise.resolve();
  private resultNotice: Notice | null = null;

  async onload(): Promise<void> {
    this.settings = loadSettings(await this.loadData());
    this.loaded = true;
    this.client = new JevClient(async (url, method, key, body) => {
      const response = await requestUrl({
        url, method, throw: false,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      let parsed: unknown;
      try { parsed = JSON.parse(response.text); } catch { parsed = null; }
      return { status: response.status, headers: response.headers, body: parsed };
    });
    this.organizer = new Organizer({
      settings: () => this.settings,
      key: () => this.getKey(),
      capture: () => this.capture(),
      unchanged: snapshot => this.unchanged(snapshot),
      folderExists: path => this.app.vault.getAbstractFileByPath(path) instanceof TFolder,
      ensureReview: path => this.ensureFolder(path),
      classify: (request, key) => this.client.classify(request, key),
      move: (file, source, target) => this.move(file, source, target),
      currentPath: file => this.app.vault.getAbstractFileByPath(file.path) === file ? file.path : null,
    });

    const bump = (file: TFile) => this.revisions.set(file, (this.revisions.get(file) ?? 0) + 1);
    this.registerEvent(this.app.workspace.on('editor-change', (_editor, info) => { if (info.file) bump(info.file); }));
    this.registerEvent(this.app.vault.on('modify', file => { if (file instanceof TFile) bump(file); }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      if (file instanceof TFile) bump(file);
      if (file instanceof TFolder && renameConfiguredPaths(this.settings, oldPath, file.path)) this.persist();
    }));
    this.addSettingTab(new OrganizerSettingsTab(this.app, this));
    this.addCommand({
      id: 'classify-and-archive', name: 'Clasificar y archivar nota',
      checkCallback: checking => {
        const available = this.app.workspace.getActiveViewOfType(MarkdownView)?.file?.extension === 'md';
        if (available && !checking) void this.classify();
        return available;
      },
    });
    this.addCommand({
      id: 'undo-last-move', name: 'Deshacer último movimiento',
      callback: () => { void this.undo(); },
    });
    this.app.workspace.onLayoutReady(() => { if (this.loaded) void this.initialize(); });
  }

  onunload(): void { this.loaded = false; this.organizer?.dispose(); this.resultNotice?.hide(); }

  getKey(): string { return this.settings.secretId ? this.app.secretStorage.getSecret(this.settings.secretId) ?? '' : ''; }

  persist(): void {
    const data = structuredClone(this.settings);
    this.saveQueue = this.saveQueue.then(() => this.saveData(data)).catch(() => {
      if (this.loaded) new Notice('No se pudieron guardar los ajustes de Jev Organizer. Comprueba los permisos de la bóveda.');
    });
  }

  private async initialize(): Promise<void> {
    if (this.settings.initialized) return;
    try {
      await this.ensureFolder(this.settings.reviewPath);
      if (!this.loaded) return;
      this.settings.initialized = true;
      this.persist();
      new Notice('Jev Organizer: la carpeta de revisión está lista. Configura tu clave y categorías en Ajustes → Jev Organizer.', 9000);
    } catch (error) { this.showError(error); }
  }

  async ensureFolder(path: string): Promise<void> {
    const pieces = path.split('/');
    let current = '';
    for (const part of pieces) {
      if (!this.loaded) throw new Error('El plugin se desactivó.');
      current = current ? current + '/' + part : part;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (existing instanceof TFolder) continue;
      if (existing) throw new Error(`Un archivo impide crear la carpeta «${current}». Corrígelo en la bóveda o elige otra carpeta de revisión.`);
      try { await this.app.vault.createFolder(current); }
      catch { if (!(this.app.vault.getAbstractFileByPath(current) instanceof TFolder)) throw new Error(`No se pudo crear la carpeta «${current}».`); }
    }
  }

  private async capture(): Promise<Snapshot<TFile>> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = view?.file;
    if (!view || !file || file.extension !== 'md') throw new Error('Abre una nota Markdown para clasificarla.');
    await view.save();
    if (view.file !== file) throw new Error('La nota activa cambió al guardar. Ejecuta de nuevo el comando.');
    const snapshot = { file, path: file.path, title: file.basename, text: view.getViewData(), revision: this.revisions.get(file) ?? 0 };
    if (!await this.unchanged(snapshot)) throw new Error('Espera a que termine de guardarse la nota y ejecuta de nuevo el comando.');
    return snapshot;
  }

  private async unchanged(snapshot: Snapshot<TFile>): Promise<boolean> {
    const { file, path, text, revision } = snapshot;
    const consistent = () => this.loaded && file.path === path
      && this.app.vault.getAbstractFileByPath(path) === file
      && (this.revisions.get(file) ?? 0) === revision
      && this.app.workspace.getLeavesOfType('markdown').every(leaf => {
        const view = leaf.view;
        return !(view instanceof MarkdownView) || view.file !== file || view.getViewData() === text;
      });
    if (!consistent()) return false;
    try { return await this.app.vault.read(file) === text && consistent(); }
    catch { return false; }
  }

  private async move(file: TFile, source: string, destination: string): Promise<void> {
    if (!this.loaded) throw new Error('El plugin se desactivó.');
    if (file.path !== source || this.app.vault.getAbstractFileByPath(source) !== file) throw new Error('La nota cambió de ubicación o ya no existe.');
    const target = normalizePath(destination);
    const parent = target.substring(0, target.lastIndexOf('/'));
    if (parent && !(this.app.vault.getAbstractFileByPath(parent) instanceof TFolder)) throw new Error('La carpeta de destino ya no existe.');
    if (this.app.vault.getAbstractFileByPath(target)) throw new Error(`Ya existe un archivo en «${target}». No se ha sobrescrito ni movido ninguna nota.`);
    try { await this.app.fileManager.renameFile(file, target); }
    catch { throw new Error('Obsidian no pudo completar el movimiento. Comprueba la ubicación actual de la nota y los permisos de la bóveda.'); }
  }

  async classify(): Promise<void> {
    if (this.organizer.busy) { new Notice('Ya hay una operación en curso.'); return; }
    const progress = new Notice('Jev Organizer: clasificando…', 0);
    try {
      const outcome = await this.organizer.run();
      if (!this.loaded) return;
      const fragment = document.createDocumentFragment();
      fragment.createEl('div', { text: outcome.moved ? `Movido a ${outcome.path}` : `La nota ya está en ${outcome.path}` });
      if (outcome.review) fragment.createEl('div', { text: 'Requiere revisión: no hay una categoría suficientemente clara.' });
      if (outcome.moved) {
        const button = fragment.createEl('button', { text: 'Deshacer' });
        button.addEventListener('click', () => {
          button.disabled = true;
          void this.undo().finally(() => { button.disabled = false; });
        });
      }
      this.resultNotice?.hide();
      this.resultNotice = new Notice(fragment, 12000);
    } catch (error) { this.showError(error); }
    finally { progress.hide(); }
  }

  async undo(): Promise<void> {
    try {
      if (!this.loaded) return;
      const path = await this.organizer.undo();
      this.resultNotice?.hide();
      if (this.loaded) new Notice(`Movimiento deshecho: ${path}`);
    } catch (error) { this.showError(error); }
  }

  showError(error: unknown): void {
    if (this.loaded) new Notice(error instanceof Error ? error.message : 'No se pudo completar la operación.', 10000);
  }
}
