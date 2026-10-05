import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { JevClient } from './client';
import { buildRequest, destination, REVIEW } from './decision';
import { activeCategories, DEFAULTS, type Category } from './settings';

const key = process.env.TYPESAFE_API_KEY;
if (!key?.trim()) throw new Error('Falta TYPESAFE_API_KEY.');
const dataset = JSON.parse(await readFile(process.argv[2] ?? 'tests/evaluation-cases.json', 'utf8'));
const settings = { ...structuredClone(DEFAULTS), categories: dataset.categories as Category[], model: process.env.JEV_MODEL ?? DEFAULTS.model, threshold: Number(process.env.JEV_THRESHOLD ?? DEFAULTS.threshold) };
activeCategories(settings);
if (!Number.isFinite(settings.threshold) || settings.threshold < 0 || settings.threshold > 1) throw new Error('JEV_THRESHOLD debe estar entre 0 y 1.');
if (!Array.isArray(dataset.cases) || dataset.cases.length < 20) throw new Error('Incluye al menos 20 casos.');
const ids = new Set<string>();
for (const c of dataset.cases) {
  if (!c || typeof c.id !== 'string' || ids.has(c.id) || typeof c.title !== 'string' || typeof c.markdown !== 'string'
    || !(c.expected === REVIEW || settings.categories.some(category => category.enabled && category.id === c.expected))) throw new Error('Caso de evaluación inválido.');
  ids.add(c.id);
}
const client = new JevClient(async (url, method, secret, body) => {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  const raw = await response.text();
  let parsed: unknown; try { parsed = JSON.parse(raw); } catch { parsed = null; }
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => { headers[name] = value; });
  return { status: response.status, headers, body: parsed };
});
const results = [];
for (const c of dataset.cases) {
  try {
    const answer = await client.classify(buildRequest(c.title, c.markdown, settings), key);
    const routed = destination(answer, settings);
    const actual = routed.review ? REVIEW : answer.choice;
    results.push({ id: c.id, expected: c.expected, actual, correct: actual === c.expected, confidence: answer.confidence, model: answer.model });
    console.log(`${c.id}: ${actual === c.expected ? 'correcto' : 'revisar resultado'}`);
  } catch (error) {
    results.push({ id: c.id, error: error instanceof Error ? error.message : 'Error de evaluación' });
    console.error(`${c.id}: error técnico`);
  }
}
const successful = results.filter(r => 'actual' in r);
const summary = {
  datasetType: dataset.kind ?? 'user-provided', total: results.length,
  correct: successful.filter(r => r.correct).length,
  sentToReview: successful.filter(r => r.actual === REVIEW).length,
  incorrect: successful.filter(r => !r.correct).length,
  technicalErrors: results.length - successful.length,
};
await mkdir('release', { recursive: true });
await writeFile('release/evaluation-report.json', JSON.stringify({ generatedAt: new Date().toISOString(), model: settings.model, threshold: settings.threshold, summary, results }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
console.log('Informe: release/evaluation-report.json');
if (summary.technicalErrors) process.exitCode = 1;
