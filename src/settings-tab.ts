import { AbstractInputSuggest, App, Notice, PluginSettingTab, SecretComponent, Setting, TFolder } from 'obsidian';
import type JevOrganizerPlugin from './main';
import { validFolderPath } from './settings';
import { applyFolderSelection } from './folder-selection';

class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(app: App, input: HTMLInputElement, private selected: (path: string) => void) { super(app, input); }
  getSuggestions(query: string): TFolder[] {
    return this.app.vault.getAllLoadedFiles()
      .filter((file): file is TFolder => file instanceof TFolder && validFolderPath(file.path) && file.path.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
      .sort((a, b) => a.path.localeCompare(b.path));
  }
  renderSuggestion(folder: TFolder, el: HTMLElement): void { el.setText(folder.path); }
  selectSuggestion(folder: TFolder): void { this.setValue(folder.path); this.selected(folder.path); this.close(); }
}

export class OrganizerSettingsTab extends PluginSettingTab {
  private suggests: FolderSuggest[] = [];
  constructor(app: App, private plugin: JevOrganizerPlugin) { super(app, plugin); }
  hide(): void { this.suggests.forEach(s => s.close()); this.suggests = []; }

  display(): void {
    this.hide();
    const { containerEl } = this;
    const settings = this.plugin.settings;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Jev Organizer' });
    containerEl.createEl('p', { text: 'Clasifica la nota activa con un comando y muévela a una de tus carpetas. Los atajos se asignan en Ajustes → Atajos de teclado.' });
    const privacy = containerEl.createDiv({ cls: 'jev-info' });
    privacy.createEl('p', { text: 'Cada clasificación envía a TypeSafe el título y Markdown completo de esa nota, junto con las descripciones y ejemplos de tus categorías. No envía otras notas ni archivos adjuntos. El uso de la API se factura en tu cuenta de TypeSafe.' });

    const secretSetting = new Setting(containerEl).setName('Clave de TypeSafe').setDesc('Selecciona o crea un secreto de Obsidian. El plugin guarda su referencia, no la clave, en sus ajustes.');
    new SecretComponent(this.app, secretSetting.controlEl).setValue(settings.secretId).onChange(id => {
      settings.secretId = id ?? '';
      this.plugin.persist();
    });
    new Setting(containerEl).setName('Probar conexión').setDesc('Consulta los modelos de tu cuenta sin enviar el contenido de ninguna nota.').addButton(button => button.setButtonText('Probar conexión').onClick(async () => {
      button.setDisabled(true);
      try { await this.plugin.client.testConnection(this.plugin.getKey()); new Notice('Conexión correcta con TypeSafe.'); }
      catch (error) { this.plugin.showError(error); }
      finally { button.setDisabled(false); }
    }));

    let reviewInput = settings.reviewPath;
    const review = new Setting(containerEl).setName('Carpeta de revisión').setDesc('Se usa cuando ninguna categoría encaja o la confianza es insuficiente. Se crea si hace falta; cambiarla no mueve notas anteriores.');
    review.addText(text => {
      text.setValue(reviewInput).onChange(value => { reviewInput = value.trim(); });
      this.suggests.push(new FolderSuggest(this.app, text.inputEl, path => { reviewInput = path; }));
    }).addButton(button => button.setButtonText('Aplicar').onClick(async () => {
      if (!validFolderPath(reviewInput) || settings.categories.some(c => c.enabled && c.path === reviewInput)) { new Notice('Elige una carpeta válida que no sea una categoría.'); return; }
      button.setDisabled(true);
      try {
        await this.plugin.ensureFolder(reviewInput);
        settings.reviewPath = reviewInput;
        settings.initialized = true;
        this.plugin.persist();
        new Notice('Carpeta de revisión actualizada.');
        this.display();
      } catch (error) { this.plugin.showError(error); }
      finally { button.setDisabled(false); }
    }));
    if (!(this.app.vault.getAbstractFileByPath(settings.reviewPath) instanceof TFolder)) {
      containerEl.createEl('p', { cls: 'jev-warning', text: 'La carpeta de revisión no existe o su ruta está ocupada por un archivo. Usa Aplicar para crearla o corregirla.' });
    }

    new Setting(containerEl).setName('Confianza mínima').setDesc('Valor inicial: 0,80. Es una señal del modelo, no un porcentaje garantizado de aciertos. Ajusta el umbral con tus propios artículos.').addSlider(slider => slider
      .setLimits(0, 1, 0.01).setValue(settings.threshold).setDynamicTooltip().onChange(value => { settings.threshold = value; this.plugin.persist(); }));

    containerEl.createEl('h3', { text: '1. Selecciona las carpetas' });
    containerEl.createEl('p', { text: 'Marca las carpetas que participarán en la clasificación y pulsa Aplicar selección. Cada subcarpeta es una opción independiente. La carpeta de revisión no se incluye.' });
    const folderPaths = () => this.app.vault.getAllLoadedFiles()
      .filter((file): file is TFolder => file instanceof TFolder && validFolderPath(file.path) && file.path !== settings.reviewPath)
      .map(folder => folder.path).sort((a, b) => a.localeCompare(b));
    const paths = folderPaths();
    // Keep missing active paths visible so applying never silently drops them.
    const missing = settings.categories.filter(c => c.enabled && !paths.includes(c.path));
    const selected = new Set(settings.categories.filter(c => c.enabled).map(c => c.path));
    const summary = containerEl.createEl('p', { attr: { 'aria-live': 'polite' } });
    const controls = containerEl.createDiv({ cls: 'jev-folder-controls' });
    const all = controls.createEl('button', { text: 'Seleccionar todas', attr: { type: 'button' } });
    const clear = controls.createEl('button', { text: 'Deseleccionar todas', attr: { type: 'button' } });
    const apply = controls.createEl('button', { text: 'Aplicar selección', cls: 'mod-cta', attr: { type: 'button' } });
    const list = containerEl.createDiv({ cls: 'jev-folder-list', attr: { role: 'group', 'aria-label': 'Carpetas participantes' } });
    const checkboxes = new Map<string, HTMLInputElement>();
    const refresh = () => {
      summary.setText(`${selected.size} carpetas seleccionadas · máximo 254`);
      apply.disabled = selected.size > 254;
      summary.toggleClass('jev-warning', selected.size > 254);
      for (const [path, input] of checkboxes) input.checked = selected.has(path);
    };
    for (const path of [...paths, ...missing.map(c => c.path)]) {
      const row = list.createEl('label', { cls: 'jev-folder-option' });
      const checkbox = row.createEl('input', { attr: { type: 'checkbox' } });
      row.createEl('span', { text: paths.includes(path) ? path : `${path} (ya no existe)`, cls: paths.includes(path) ? '' : 'jev-warning' });
      checkboxes.set(path, checkbox);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selected.add(path); else selected.delete(path);
        refresh();
      });
    }
    if (!paths.length && !missing.length) list.createEl('p', { text: 'No hay carpetas disponibles. Crea carpetas en tu bóveda y vuelve a abrir estos ajustes.' });
    all.addEventListener('click', () => { selected.clear(); paths.forEach(path => selected.add(path)); refresh(); });
    clear.addEventListener('click', () => { selected.clear(); refresh(); });
    apply.addEventListener('click', () => {
      try {
        settings.categories = applyFolderSelection(settings.categories, selected, new Set(folderPaths()), settings.reviewPath);
        this.plugin.persist();
        this.display();
        this.containerEl.querySelector<HTMLElement>('.jev-descriptions-heading')?.scrollIntoView({ block: 'start' });
        new Notice('Selección aplicada. Completa las descripciones de las carpetas nuevas.');
      } catch (error) { this.plugin.showError(error); }
    });
    refresh();
    containerEl.createEl('p', { cls: 'setting-item-description', text: 'Los cambios de selección se guardan al pulsar Aplicar selección. Las descripciones se conservan si desmarcas y vuelves a seleccionar una carpeta.' });
    containerEl.createEl('h3', { text: '2. Describe las carpetas seleccionadas', cls: 'jev-descriptions-heading' });
    if (!settings.categories.some(c => c.enabled)) containerEl.createEl('p', { text: 'Selecciona las carpetas arriba y aplica la selección para completar sus descripciones.' });
    for (const category of settings.categories.filter(c => c.enabled)) {
      const card = containerEl.createDiv({ cls: 'jev-category' });
      card.createEl('h4', { text: category.path });
      if (!(this.app.vault.getAbstractFileByPath(category.path) instanceof TFolder)) card.createEl('p', { cls: 'jev-warning', text: 'Esta carpeta ya no existe. Desmárcala en la lista y aplica la selección.' });
      new Setting(card).setName('Nombre').addText(text => text.setValue(category.name).onChange(value => { category.name = value; this.plugin.persist(); }));
      new Setting(card).setName('Descripción obligatoria').setDesc('Indica el tema principal, qué incluir y qué excluir.').addTextArea(text => text.setValue(category.description).setPlaceholder('Artículos sobre… Excluir…').onChange(value => { category.description = value; this.plugin.persist(); }));
      new Setting(card).setName('Ejemplos opcionales').setDesc('Títulos o descripciones breves de artículos representativos.').addTextArea(text => text.setValue(category.examples).onChange(value => { category.examples = value; this.plugin.persist(); }));
    }
    containerEl.createEl('h3', { text: 'Avanzado' });
    let model = settings.model;
    new Setting(containerEl).setName('Modelo de Jev').setDesc('Inicial: jev-1.13.0. Una versión fija evita cambios inesperados de clasificación. También admite jev-latest.').addText(text => text.setValue(model).onChange(value => { model = value.trim(); }))
      .addButton(button => button.setButtonText('Aplicar').onClick(() => {
        if (!/^jev-[a-zA-Z0-9.-]+$/.test(model)) { new Notice('Introduce un identificador de modelo Jev válido.'); return; }
        settings.model = model; this.plugin.persist(); new Notice('Modelo actualizado.');
      }));
  }

}
