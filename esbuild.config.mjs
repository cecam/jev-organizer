import * as esbuild from 'esbuild';
const options = {
  entryPoints: ['src/main.ts'], bundle: true, external: ['obsidian'],
  format: 'cjs', platform: 'browser', target: 'es2022', outfile: 'main.js',
  sourcemap: false, treeShaking: true, logLevel: 'info',
  banner: { js: '/* Jev Organizer — generated bundle */' },
};
if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else await esbuild.build(options);
