import { describe, expect, it, vi } from 'vitest';
import JevOrganizerPlugin from '../src/main';
import { DEFAULTS } from '../src/settings';
import { MarkdownView, TFile, TFolder, Notice } from './obsidian-mock';

async function vault(options: { input?: unknown; source?: string; reviewFile?: boolean; reviewFolder?: boolean } = {}) {
  const files = new Map<string, TFile | TFolder>();
  for (const path of ['Borradores', 'Artículos', 'Artículos/IA']) files.set(path, new TFolder(path));
  if (options.reviewFile) files.set('Por revisar', new TFile('Por revisar', 'No borrar'));
  if (options.reviewFolder) files.set('Por revisar', new TFolder('Por revisar'));
  const file = new TFile(options.source ?? 'Borradores/Nota.md', 'Versión guardada'); files.set(file.path, file);
  const events = new Map<string, ((...args: any[]) => void)[]>();
  const emit = (name: string, ...args: unknown[]) => events.get(name)?.forEach(cb => cb(...args));
  const on = (name: string, cb: (...args: any[]) => void) => { events.set(name, [...events.get(name) ?? [], cb]); return {}; };
  const view = new MarkdownView(file, 'Texto actual sin guardar', () => emit('modify', file));
  let ready = () => {};
  const app = {
    secretStorage: { getSecret: vi.fn(() => 'test-secret') },
    vault: {
      on,
      getAbstractFileByPath: (path: string) => files.get(path) ?? null,
      getAllLoadedFiles: () => [...files.values()],
      createFolder: vi.fn(async (path: string) => { if (files.has(path)) throw new Error('Exists'); const folder = new TFolder(path); files.set(path, folder); return folder; }),
      read: vi.fn(async (target: TFile) => target.content),
    },
    workspace: {
      on,
      onLayoutReady: (callback: () => void) => { ready = callback; },
      getActiveViewOfType: () => view,
      getLeavesOfType: () => [{ view }],
    },
    fileManager: {
      renameFile: vi.fn(async (target: TFile, newPath: string) => {
        if (files.has(newPath)) throw new Error('Collision');
        const old = target.path; files.delete(old); target.path = newPath; files.set(newPath, target); emit('rename', target, old);
      }),
    },
  };
  const plugin = new JevOrganizerPlugin(app as any, { id: 'jev-organizer' } as any);
  (plugin as any).inputData = options.input ?? { ...DEFAULTS, initialized: true, categories: [{ id: 'cat-ai', name: 'IA', path: 'Artículos/IA', description: 'Modelos de IA', examples: '', enabled: true }] };
  await plugin.onload();
  plugin.client.classify = vi.fn(async () => ({ choice: 'cat-ai', confidence: 0.9, probabilities: { 'cat-ai': 0.95, 'needs-review': 0.05 }, model: 'jev-1.13.0' }));
  return { app, file, files, view, plugin, ready: () => ready(), emit };
}

describe('adaptador Obsidian con bóveda simulada', () => {
  it('crea revisión en la primera activación, guarda la inicialización y no consulta la API', async () => {
    const h = await vault({ input: {} }); h.ready();
    await vi.waitFor(() => expect(h.plugin.settings.initialized).toBe(true));
    expect(h.files.get('Por revisar')).toBeInstanceOf(TFolder);
    expect(h.app.vault.createFolder).toHaveBeenCalledTimes(1);
    expect(h.plugin.client.classify).not.toHaveBeenCalled();
    h.ready(); expect(h.app.vault.createFolder).toHaveBeenCalledTimes(1);
  });
  it('reutiliza revisión existente y conserva archivos que impiden crearla', async () => {
    const existing = await vault({ input: {}, reviewFolder: true }); existing.ready();
    await vi.waitFor(() => expect(existing.plugin.settings.initialized).toBe(true));
    expect(existing.app.vault.createFolder).not.toHaveBeenCalled();
    const blocked = await vault({ input: {}, reviewFile: true }); blocked.ready();
    await vi.waitFor(() => expect(Notice.messages.some(message => typeof message === 'string' && message.includes('impide crear'))).toBe(true));
    expect((blocked.files.get('Por revisar') as TFile).content).toBe('No borrar');
    expect(blocked.plugin.settings.initialized).toBe(false);
  });
  it('guarda el contenido del editor y mueve mediante FileManager', async () => {
    const h = await vault(); await h.plugin.organizer.run();
    expect(h.file.content).toBe('Texto actual sin guardar');
    expect(h.app.fileManager.renameFile).toHaveBeenCalledWith(h.file, 'Artículos/IA/Nota.md');
    expect(h.plugin.client.classify).toHaveBeenCalledWith(expect.objectContaining({ state: { title: 'Nota', markdown: 'Texto actual sin guardar' } }), 'test-secret');
  });
  it('comprueba colisiones antes de llamar a FileManager', async () => {
    const h = await vault(); h.files.set('Artículos/IA/Nota.md', new TFile('Artículos/IA/Nota.md', 'Contenido existente'));
    await expect(h.plugin.organizer.run()).rejects.toThrow('Ya existe');
    expect(h.app.fileManager.renameFile).not.toHaveBeenCalled();
    expect((h.files.get('Artículos/IA/Nota.md') as TFile).content).toBe('Contenido existente');
  });
  it('deshace hasta la raíz de la bóveda y conserva ediciones', async () => {
    const h = await vault({ source: 'Nota.md' }); await h.plugin.organizer.run();
    h.view.text = 'Edición posterior'; await h.view.save();
    await h.plugin.organizer.undo();
    expect(h.file.path).toBe('Nota.md'); expect(h.file.content).toBe('Edición posterior');
  });
  it('la edición en el editor mientras responde Jev cancela el movimiento', async () => {
    const h = await vault();
    h.plugin.client.classify = vi.fn(async () => { h.view.text = 'Otro texto'; h.emit('editor-change', h.view.editor, h.view); return { choice: 'cat-ai', confidence: 1, probabilities: { 'cat-ai': 1, 'needs-review': 0 }, model: 'jev-1.13.0' }; });
    await expect(h.plugin.organizer.run()).rejects.toThrow('cambió'); expect(h.app.fileManager.renameFile).not.toHaveBeenCalled();
  });
  it('los eventos de cambio de nombre actualizan carpetas descendientes', async () => {
    const h = await vault(); const folder = new TFolder('Archivo');
    h.emit('rename', folder, 'Artículos');
    expect(h.plugin.settings.categories[0]!.path).toBe('Archivo/IA');
  });
  it('guarda referencias a secretos, sin persistir la clave', async () => {
    const h = await vault(); h.plugin.persist();
    await vi.waitFor(() => expect((h.plugin as any).savedData).toBeDefined());
    expect(JSON.stringify((h.plugin as any).savedData)).not.toContain('test-secret');
    expect((h.plugin as any).savedData.secretId).toBe('jev-organizer-api-key');
  });
});
