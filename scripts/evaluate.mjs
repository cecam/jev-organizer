import { build } from 'esbuild';
if (!process.env.TYPESAFE_API_KEY?.trim()) {
  console.error('Configura TYPESAFE_API_KEY en tu entorno antes de evaluar. No se ha enviado ninguna nota.');
  process.exit(1);
}
const result = await build({ entryPoints: ['scripts/evaluation.ts'], bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22' });
await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
