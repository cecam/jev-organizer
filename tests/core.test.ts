import { describe, expect, it, vi, afterEach } from 'vitest';
import { activeCategories, DEFAULTS, loadSettings, renameConfiguredPaths, validFolderPath, type Settings } from '../src/settings';
import { buildRequest, destination, parseDecision, REVIEW, type Decision } from '../src/decision';
import { Organizer, type Ports, type Snapshot } from '../src/organizer';
import { JevClient, type HttpResult } from '../src/client';

function settings(): Settings {
  return { ...structuredClone(DEFAULTS), initialized: true, categories: [
    { id: 'cat-ai', name: 'IA', path: 'Artículos/IA', description: 'Modelos y agentes de inteligencia artificial', examples: '', enabled: true },
    { id: 'cat-work', name: 'Productividad', path: 'Artículos/Productividad', description: 'Hábitos personales', examples: '', enabled: true },
  ] };
}
const decision = (confidence = 0.9, choice = 'cat-ai'): Decision => ({ choice, confidence, model: 'jev-1.13.0', probabilities: { 'cat-ai': 0.95, 'cat-work': 0.03, [REVIEW]: 0.02 } });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }

describe('categorías y contrato de Jev', () => {
  it('envía solo categorías habilitadas, descripciones y una opción de revisión', () => {
    const s = settings(); s.categories[1]!.enabled = false;
    const request = buildRequest('Artículo', 'Texto actual', s);
    expect(Object.keys(request.questions.category.criteria)).toEqual(['cat-ai', REVIEW]);
    expect(request.state).toEqual({ title: 'Artículo', markdown: 'Texto actual' });
    expect(JSON.stringify(request)).not.toContain('Artículos/');
  });
  it('conserva una configuración válida al cargarla y descarta claves adicionales', () => {
    const s = settings(); expect(loadSettings({ ...s, apiKey: 'never-store' })).toEqual(s);
    expect(loadSettings({ ...s, secretId: '' }).secretId).toBe('');
  });
  it('restablece valores corruptos y rechaza rutas que salgan de la bóveda', () => {
    expect(loadSettings({ threshold: NaN, reviewPath: '../outside' }).threshold).toBe(0.8);
    for (const path of ['../outside', '/absolute', 'a/../b', '.obsidian', 'a\\b', 'a//b', 'a/']) expect(validFolderPath(path)).toBe(false);
    expect(validFolderPath('Recursos/Inteligencia artificial')).toBe(true);
  });
  it('requiere descripción y una categoría activa', () => {
    const s = settings(); s.categories[0]!.description = ' ';
    expect(() => activeCategories(s)).toThrow('descripción');
    s.categories = []; expect(() => activeCategories(s)).toThrow('al menos');
  });
  it('impide duplicados y usar la carpeta de revisión como categoría', () => {
    const s = settings(); s.categories[1]!.path = s.categories[0]!.path;
    expect(() => activeCategories(s)).toThrow('distinta');
    s.categories[1]!.path = s.reviewPath; expect(() => activeCategories(s)).toThrow();
  });
  it('respeta el límite de Choice reservando la opción de revisión', () => {
    const s = settings(); s.categories = Array.from({ length: 255 }, (_, i) => ({ ...s.categories[0]!, id: `cat-${i}`, path: `Folder${i}` }));
    expect(() => activeCategories(s)).toThrow('254');
  });
  it('actualiza rutas de carpetas y descendientes sin afectar nombres parecidos', () => {
    const s = settings(); s.reviewPath = 'Artículos/Revisión';
    expect(renameConfiguredPaths(s, 'Artículos', 'Archivo')).toBe(true);
    expect(s.categories[0]!.path).toBe('Archivo/IA'); expect(s.reviewPath).toBe('Archivo/Revisión');
    expect(renameConfiguredPaths(s, 'Arch', 'X')).toBe(false);
  });
  it('acepta el umbral exacto y envía confianza menor o ninguna categoría a revisión', () => {
    expect(destination(decision(0.8), settings()).review).toBe(false);
    expect(destination(decision(0.799), settings()).path).toBe('Por revisar');
    expect(destination(decision(0.99, REVIEW), settings()).review).toBe(true);
  });
  it('valida distribución y no permite rutas inventadas o respuestas incompletas', () => {
    const request = buildRequest('Title', 'Text', settings());
    const raw = { model: 'jev-1.13.0', answers: { category: { type: 'choice', ...decision() } } };
    expect(parseDecision(raw, request).choice).toBe('cat-ai');
    for (const bad of [null, {}, { ...raw, answers: { category: { ...raw.answers.category, choice: '../../evil' } } },
      { ...raw, answers: { category: { ...raw.answers.category, confidence: NaN } } },
      { ...raw, answers: { category: { ...raw.answers.category, probabilities: { 'cat-ai': 1 } } } }]) {
      expect(() => parseDecision(bad, request)).toThrow('inválida');
    }
  });
});

function harness() {
  const s = settings();
  const file = { path: 'Borradores/Artículo.md', text: 'Artículo sobre agentes de IA', revision: 1 };
  const folders = new Set(['Borradores', 'Artículos/IA', 'Artículos/Productividad']);
  const occupied = new Set<string>();
  const ports: Ports<typeof file> = {
    settings: () => s, key: () => 'test-key',
    capture: vi.fn(async () => ({ file, path: file.path, title: 'Artículo', text: file.text, revision: file.revision })),
    unchanged: vi.fn(async snapshot => snapshot.path === file.path && snapshot.text === file.text && snapshot.revision === file.revision),
    folderExists: path => folders.has(path),
    ensureReview: vi.fn(async path => { folders.add(path); }),
    classify: vi.fn(async () => decision()),
    currentPath: f => f.path,
    move: vi.fn(async (f, source, target) => {
      if (source !== f.path) throw new Error('moved');
      if (occupied.has(target)) throw new Error('collision');
      const parent = target.split('/').slice(0, -1).join('/');
      if (!folders.has(parent)) throw new Error('folder missing');
      f.path = target;
    }),
  };
  return { s, file, folders, occupied, ports, organizer: new Organizer(ports) };
}

describe('clasificación, integridad y recuperación', () => {
  it('mueve la nota, conserva texto y permite deshacer después de editar', async () => {
    const h = harness(); const outcome = await h.organizer.run();
    expect(outcome.path).toBe('Artículos/IA/Artículo.md');
    h.file.text = 'Ediciones posteriores';
    expect(await h.organizer.undo()).toBe('Borradores/Artículo.md');
    expect(h.file.text).toBe('Ediciones posteriores'); expect(h.organizer.canUndo).toBe(false);
  });
  it('crea revisión solo para decisiones inciertas', async () => {
    const h = harness(); h.ports.classify = vi.fn(async () => decision(0.3));
    expect((await h.organizer.run()).path).toBe('Por revisar/Artículo.md');
    expect(h.ports.ensureReview).toHaveBeenCalledOnce();
  });
  it('no mueve ni crea revisión si falla la API', async () => {
    const h = harness(); h.ports.classify = vi.fn(async () => { throw new Error('API error'); });
    await expect(h.organizer.run()).rejects.toThrow('API');
    expect(h.ports.move).not.toHaveBeenCalled(); expect(h.ports.ensureReview).not.toHaveBeenCalled();
    expect(h.organizer.busy).toBe(false);
  });
  it.each(['text', 'path', 'settings', 'dispose', 'revision'])('cancela si cambia %s mientras espera la respuesta', async change => {
    const h = harness(); const pending = deferred<Decision>();
    h.ports.classify = vi.fn(() => pending.promise);
    const run = h.organizer.run();
    await vi.waitFor(() => expect(h.ports.classify).toHaveBeenCalledOnce());
    if (change === 'text') h.file.text = 'Nueva edición';
    if (change === 'path') h.file.path = 'Otra.md';
    if (change === 'settings') h.s.threshold = 0.7;
    if (change === 'dispose') h.organizer.dispose();
    if (change === 'revision') h.file.revision++;
    pending.resolve(decision());
    await expect(run).rejects.toThrow('cambió');
    expect(h.ports.move).not.toHaveBeenCalled();
  });
  it('rechaza comandos simultáneos y no consulta notas vacías', async () => {
    const h = harness(); const pending = deferred<Decision>(); h.ports.classify = () => pending.promise;
    const run = h.organizer.run(); await expect(h.organizer.run()).rejects.toThrow('en curso');
    pending.resolve(decision()); await run;
    h.file.text = ' '; await expect(h.organizer.run()).rejects.toThrow('vacía');
  });
  it('una colisión no sobrescribe y conserva la ubicación original', async () => {
    const h = harness(); h.occupied.add('Artículos/IA/Artículo.md');
    await expect(h.organizer.run()).rejects.toThrow('collision');
    expect(h.file.path).toBe('Borradores/Artículo.md'); expect(h.organizer.canUndo).toBe(false);
  });
  it('si ya está en su destino no hace un movimiento ni crea un deshacer', async () => {
    const h = harness(); h.file.path = 'Artículos/IA/Artículo.md';
    expect((await h.organizer.run()).moved).toBe(false); expect(h.ports.move).not.toHaveBeenCalled();
  });
  it('detecta carpetas faltantes antes y después de consultar', async () => {
    const h = harness(); h.folders.delete('Artículos/IA');
    await expect(h.organizer.run()).rejects.toThrow('no existe'); expect(h.ports.classify).not.toHaveBeenCalled();
    h.folders.add('Artículos/IA'); h.ports.classify = async () => { h.folders.delete('Artículos/IA'); return decision(); };
    await expect(h.organizer.run()).rejects.toThrow('no existe'); expect(h.ports.move).not.toHaveBeenCalled();
  });
  it('deshacer se detiene si el origen está ocupado o la nota fue movida externamente', async () => {
    const h = harness(); await h.organizer.run(); h.occupied.add('Borradores/Artículo.md');
    await expect(h.organizer.undo()).rejects.toThrow('collision'); expect(h.organizer.canUndo).toBe(true);
    h.file.path = 'Manual.md'; await expect(h.organizer.undo()).rejects.toThrow('ubicación');
  });
  it('no permite categorías ajenas aunque el clasificador falle en validarlas', async () => {
    const h = harness(); h.ports.classify = async () => decision(1, 'unknown');
    await expect(h.organizer.run()).rejects.toThrow('permitida'); expect(h.ports.move).not.toHaveBeenCalled();
  });
});

afterEach(() => vi.useRealTimers());
describe('cliente de TypeSafe', () => {
  const result = (status: number, body: unknown = {}, headers: Record<string, string> = {}): HttpResult => ({ status, body, headers });
  it('prueba conexión sin enviar notas', async () => {
    const transport = vi.fn(async () => result(200, { models: [] }));
    await new JevClient(transport).testConnection('secret');
    expect(transport).toHaveBeenCalledWith('https://api.typesafe.ai/v1/models', 'GET', 'secret', undefined);
  });
  it('no reintenta credenciales inválidas y no expone el cuerpo del error', async () => {
    const transport = vi.fn(async () => result(401, { message: 'secret-key and note text' }));
    await expect(new JevClient(transport).testConnection('secret')).rejects.toThrow('rechazó');
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('reintenta una sola vez respetando Retry-After', async () => {
    vi.useFakeTimers();
    const transport = vi.fn().mockResolvedValueOnce(result(429, {}, { 'retry-after': '2' })).mockResolvedValue(result(200, { models: [] }));
    const pending = new JevClient(transport).testConnection('secret');
    await vi.advanceTimersByTimeAsync(1999); expect(transport).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); await pending; expect(transport).toHaveBeenCalledTimes(2);
  });
  it('no reintenta si Retry-After supera el plazo', async () => {
    const transport = vi.fn(async () => result(429, {}, { 'retry-after': '60' }));
    await expect(new JevClient(transport).testConnection('secret')).rejects.toThrow('límite');
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('limita la espera e ignora respuestas tardías sin volver a consultar', async () => {
    vi.useFakeTimers(); const pending = deferred<HttpResult>(); const transport = vi.fn(() => pending.promise);
    const operation = new JevClient(transport).testConnection('secret');
    const assertion = expect(operation).rejects.toThrow('30 segundos');
    await vi.advanceTimersByTimeAsync(30_000); await assertion;
    pending.resolve(result(529)); await vi.advanceTimersByTimeAsync(60_000);
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
