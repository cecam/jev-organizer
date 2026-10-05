import { parseDecision, type DecisionRequest, type Decision } from './decision';

export interface HttpResult { status: number; headers: Record<string, string>; body: unknown }
export type Transport = (url: string, method: 'GET' | 'POST', key: string, body?: unknown) => Promise<HttpResult>;
const BASE = 'https://api.typesafe.ai/v1';
const TIMEOUT = 'TypeSafe tardó más de 30 segundos. La nota permanece en su carpeta; vuelve a intentarlo.';

export class JevClient {
  constructor(private transport: Transport) {}

  private async request(path: string, method: 'GET' | 'POST', key: string, body?: unknown): Promise<unknown> {
    if (!key.trim()) throw new Error('Configura la clave de TypeSafe en los ajustes.');
    let expired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + 30_000;
    const operation = async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        let response: HttpResult;
        try { response = await this.transport(BASE + path, method, key, body); }
        catch { throw new Error('No se pudo conectar con TypeSafe. Comprueba tu conexión e inténtalo de nuevo.'); }
        if (expired) throw new Error(TIMEOUT);
        if (response.status >= 200 && response.status < 300) return response.body;
        const transient = response.status === 429 || response.status >= 500;
        if (transient && attempt === 0) {
          const header = response.headers['retry-after'] ?? response.headers['Retry-After'];
          const seconds = header ? Number(header) : NaN;
          const date = header && !Number.isFinite(seconds) ? Date.parse(header) : NaN;
          const wait = Math.max(1000, Number.isFinite(seconds) ? seconds * 1000 : Number.isFinite(date) ? date - Date.now() : 1000);
          if (Date.now() + wait < deadline) {
            await new Promise<void>(resolve => { delayTimer = setTimeout(resolve, wait); });
            if (expired) throw new Error(TIMEOUT);
            continue;
          }
        }
        if (response.status === 401 || response.status === 403) throw new Error('TypeSafe rechazó la clave o el acceso al modelo. Revisa tus ajustes.');
        if (response.status === 413 || response.status === 422) throw new Error('TypeSafe rechazó la solicitud. Revisa el modelo y el tamaño de la nota y los criterios; no se ha recortado el texto.');
        if (response.status === 429) throw new Error('Se alcanzó el límite de TypeSafe. Inténtalo más tarde.');
        if (response.status === 404) throw new Error('El modelo o recurso de TypeSafe no está disponible. Revisa el modelo configurado.');
        throw new Error('TypeSafe no está disponible en este momento. La nota no se ha movido.');
      }
      throw new Error(TIMEOUT);
    };
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => { expired = true; reject(new Error(TIMEOUT)); }, 30_000); }),
      ]);
    } finally {
      expired = true;
      clearTimeout(timer);
      clearTimeout(delayTimer);
    }
  }

  async classify(request: DecisionRequest, key: string): Promise<Decision> {
    return parseDecision(await this.request('/systemone', 'POST', key, request), request);
  }

  async testConnection(key: string): Promise<void> {
    const raw = await this.request('/models', 'GET', key);
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Record<string, unknown>).models)) {
      throw new Error('TypeSafe devolvió una lista de modelos inválida.');
    }
  }
}
