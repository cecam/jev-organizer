export interface Category {
  id: string;
  name: string;
  path: string;
  description: string;
  examples: string;
  enabled: boolean;
}

export interface Settings {
  version: 1;
  categories: Category[];
  reviewPath: string;
  threshold: number;
  model: string;
  secretId: string;
  initialized: boolean;
}

export const DEFAULTS: Settings = {
  version: 1, categories: [], reviewPath: 'Por revisar', threshold: 0.8,
  model: 'jev-1.13.0', secretId: 'jev-organizer-api-key', initialized: false,
};

export function validFolderPath(path: string): boolean {
  return path.length > 0 && !path.includes('\\') && !Array.from(path).some(char => char.charCodeAt(0) < 32)
    && path.split('/').every(part => part.length > 0 && part !== '.' && part !== '..' && !part.startsWith('.'));
}

export function loadSettings(raw: unknown): Settings {
  const s = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const categories: Category[] = [];
  if (Array.isArray(s.categories)) {
    for (const item of s.categories) {
      if (!item || typeof item !== 'object') continue;
      const c = item as Record<string, unknown>;
      if (typeof c.id !== 'string' || !/^cat-[a-z0-9-]+$/.test(c.id) || categories.some(x => x.id === c.id)) continue;
      if (typeof c.path !== 'string' || !validFolderPath(c.path)) continue;
      categories.push({
        id: c.id, path: c.path,
        name: typeof c.name === 'string' ? c.name : c.path.split('/').at(-1)!,
        description: typeof c.description === 'string' ? c.description : '',
        examples: typeof c.examples === 'string' ? c.examples : '', enabled: c.enabled !== false,
      });
    }
  }
  return {
    version: 1, categories,
    reviewPath: typeof s.reviewPath === 'string' && validFolderPath(s.reviewPath) ? s.reviewPath : DEFAULTS.reviewPath,
    threshold: typeof s.threshold === 'number' && Number.isFinite(s.threshold) && s.threshold >= 0 && s.threshold <= 1 ? s.threshold : DEFAULTS.threshold,
    model: typeof s.model === 'string' && /^jev-[a-zA-Z0-9.-]+$/.test(s.model) ? s.model : DEFAULTS.model,
    secretId: typeof s.secretId === 'string' && (s.secretId === '' || /^[a-z0-9-]+$/.test(s.secretId)) ? s.secretId : DEFAULTS.secretId,
    initialized: s.initialized === true,
  };
}

export function activeCategories(settings: Settings): Category[] {
  const active = settings.categories.filter(c => c.enabled);
  if (!active.length) throw new Error('Agrega y habilita al menos una categoría en los ajustes.');
  if (active.length > 254) throw new Error('Puedes habilitar un máximo de 254 categorías.');
  const paths = new Set<string>();
  for (const c of active) {
    if (!validFolderPath(c.path) || c.path === settings.reviewPath || paths.has(c.path)) {
      throw new Error('Cada categoría necesita una carpeta válida y distinta de las demás y de la carpeta de revisión.');
    }
    if (!c.name.trim() || !c.description.trim()) throw new Error('Completa el nombre y la descripción de cada categoría habilitada.');
    paths.add(c.path);
  }
  if (!validFolderPath(settings.reviewPath)) throw new Error('La carpeta de revisión no es válida.');
  return active;
}

export function renameConfiguredPaths(settings: Settings, oldPath: string, newPath: string): boolean {
  let changed = false;
  const update = (path: string) => {
    if (path === oldPath || path.startsWith(oldPath + '/')) {
      changed = true;
      return newPath + path.slice(oldPath.length);
    }
    return path;
  };
  settings.reviewPath = update(settings.reviewPath);
  settings.categories.forEach(c => { c.path = update(c.path); });
  return changed;
}
