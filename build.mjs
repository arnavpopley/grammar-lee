import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, copyFileSync } from 'fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('static', 'dist', { recursive: true });
copyFileSync('node_modules/harper.js/dist/harper_wasm_slim_bg.wasm', 'dist/harper_wasm_slim_bg.wasm');

const common = { external: ['fs'], bundle: true, target: 'chrome116', minify: false, legalComments: 'none', logLevel: 'info' };
await build({ ...common, entryPoints: ['src/background.js'], outfile: 'dist/background.js', format: 'esm' });
await build({ ...common, entryPoints: ['src/content/index.js'], outfile: 'dist/content.js', format: 'iife' });
for (const p of ['popup', 'options', 'editor']) {
  await build({ ...common, entryPoints: [`src/${p}.js`], outfile: `dist/${p}.js`, format: 'iife' });
}
