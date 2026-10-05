import { describe, expect, it } from 'vitest';
import { applyFolderSelection } from '../src/folder-selection';
import type { Category } from '../src/settings';

const existing: Category = { id: 'cat-ai', name: 'IA personalizada', path: 'IA', description: 'Agentes y modelos', examples: 'Clasificadores', enabled: true };
describe('selección múltiple de carpetas', () => {
  it('conserva descripciones e identificadores al desmarcar y volver a seleccionar', () => {
    const disabled = applyFolderSelection([existing], new Set(), new Set(['IA']), 'Por revisar');
    expect(disabled[0]).toEqual({ ...existing, enabled: false });
    expect(applyFolderSelection(disabled, new Set(['IA']), new Set(['IA']), 'Por revisar')).toEqual([existing]);
    expect(existing.enabled).toBe(true);
  });
  it('agrega varias carpetas independientes sin sustituir las descripciones existentes', () => {
    const result = applyFolderSelection([existing], new Set(['IA', 'Trabajo', 'Trabajo/Notas']), new Set(['IA', 'Trabajo', 'Trabajo/Notas']), 'Por revisar');
    expect(result[0]).toEqual(existing);
    expect(result.slice(1).map(c => [c.path, c.description, c.enabled])).toEqual([['Trabajo', '', true], ['Trabajo/Notas', '', true]]);
    expect(new Set(result.map(c => c.id)).size).toBe(3);
  });
  it('rechaza carpetas eliminadas durante la selección y la carpeta de revisión', () => {
    expect(() => applyFolderSelection([existing], new Set(['IA']), new Set(), 'Por revisar')).toThrow('disponible');
    expect(() => applyFolderSelection([], new Set(['Por revisar']), new Set(['Por revisar']), 'Por revisar')).toThrow('disponible');
  });
  it('rechaza seleccionar todas cuando excede el límite sin perder configuración', () => {
    const paths = new Set(Array.from({ length: 255 }, (_, i) => `Carpeta ${i}`));
    expect(() => applyFolderSelection([existing], paths, paths, 'Por revisar')).toThrow('254');
    expect(existing.description).toBe('Agentes y modelos');
  });
});
