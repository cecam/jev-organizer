import { activeCategories, type Settings } from './settings';
import { buildRequest, destination, type Decision, type DecisionRequest } from './decision';

export interface Snapshot<F> { file: F; path: string; title: string; text: string; revision: number }
export interface Ports<F> {
  settings(): Settings;
  key(): string;
  capture(): Promise<Snapshot<F>>;
  unchanged(snapshot: Snapshot<F>): Promise<boolean>;
  folderExists(path: string): boolean;
  ensureReview(path: string): Promise<void>;
  classify(request: DecisionRequest, key: string): Promise<Decision>;
  move(file: F, source: string, destination: string): Promise<void>;
  currentPath(file: F): string | null;
}
export interface Outcome { moved: boolean; path: string; review: boolean; confidence: number }

export class Organizer<F> {
  busy = false;
  private generation = 0;
  private undoRecord: { file: F; source: string; target: string } | null = null;
  constructor(private ports: Ports<F>) {}
  dispose(): void { this.generation++; this.undoRecord = null; }
  get canUndo(): boolean { return this.undoRecord !== null && !this.busy; }

  async run(): Promise<Outcome> {
    if (this.busy) throw new Error('Ya hay una clasificación o movimiento en curso.');
    this.busy = true;
    const generation = this.generation;
    const settings = structuredClone(this.ports.settings());
    const signature = JSON.stringify(settings);
    const isCurrent = () => generation === this.generation && signature === JSON.stringify(this.ports.settings());
    try {
      const key = this.ports.key();
      if (!key.trim()) throw new Error('Configura la clave de TypeSafe en los ajustes.');
      for (const c of activeCategories(settings)) {
        if (!this.ports.folderExists(c.path)) throw new Error('Una carpeta configurada ya no existe. Corrige las categorías en los ajustes.');
      }
      const snapshot = await this.ports.capture();
      if (!snapshot.text.trim()) throw new Error('La nota está vacía. Escribe contenido antes de clasificarla.');
      if (!isCurrent()) throw new Error('La configuración cambió. Ejecuta de nuevo el comando.');
      const decision = await this.ports.classify(buildRequest(snapshot.title, snapshot.text, settings), key);
      if (!isCurrent() || !await this.ports.unchanged(snapshot) || !isCurrent()) {
        throw new Error('La nota o la configuración cambió durante la consulta. Ejecuta de nuevo el comando.');
      }
      const chosen = destination(decision, settings);
      if (chosen.review) await this.ports.ensureReview(chosen.path);
      else if (!this.ports.folderExists(chosen.path)) throw new Error('La carpeta de destino ya no existe. Corrige los ajustes.');
      const basename = snapshot.path.split('/').at(-1)!;
      const target = chosen.path + '/' + basename;
      if (!isCurrent() || !await this.ports.unchanged(snapshot) || !isCurrent()) {
        throw new Error('La nota o la configuración cambió. Ejecuta de nuevo el comando.');
      }
      if (target === snapshot.path) return { moved: false, path: target, review: chosen.review, confidence: decision.confidence };
      await this.ports.move(snapshot.file, snapshot.path, target);
      if (generation === this.generation) this.undoRecord = { file: snapshot.file, source: snapshot.path, target };
      return { moved: true, path: target, review: chosen.review, confidence: decision.confidence };
    } finally { this.busy = false; }
  }

  async undo(): Promise<string> {
    if (this.busy) throw new Error('Espera a que termine la operación actual.');
    const record = this.undoRecord;
    if (!record) throw new Error('No hay movimientos que deshacer en esta sesión.');
    if (this.ports.currentPath(record.file) !== record.target) throw new Error('La nota se eliminó o cambió de ubicación. No se puede deshacer.');
    this.busy = true;
    try {
      await this.ports.move(record.file, record.target, record.source);
      this.undoRecord = null;
      return record.source;
    } finally { this.busy = false; }
  }
}
