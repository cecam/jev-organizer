import { validFolderPath, type Category } from './settings';

/** Deselected categories retain their descriptions for a later selection. */
export function applyFolderSelection(previous: Category[], selected: Set<string>, available: Set<string>, reviewPath: string): Category[] {
  if (selected.size > 254) throw new Error('Puedes seleccionar un máximo de 254 carpetas.');
  for (const path of selected) {
    if (!validFolderPath(path) || path === reviewPath || !available.has(path)) {
      throw new Error('Una carpeta seleccionada ya no está disponible. Actualiza la lista e inténtalo de nuevo.');
    }
  }
  const result = previous.map(category => ({ ...category, enabled: selected.has(category.path) }));
  for (const path of selected) {
    if (!result.some(category => category.path === path)) {
      result.push({ id: `cat-${crypto.randomUUID()}`, path, name: path.split('/').at(-1)!, description: '', examples: '', enabled: true });
    }
  }
  return result;
}
