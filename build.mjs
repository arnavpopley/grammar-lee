import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, copyFileSync, readFileSync, writeFileSync } from 'fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('static', 'dist', { recursive: true });
copyFileSync('node_modules/harper.js/dist/harper_wasm_slim_bg.wasm', 'dist/harper_wasm_slim_bg.wasm');

// Version stamp: the popup and settings page show exactly which build is loaded.
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('static/manifest.json', 'utf8'));
const stamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
manifest.version = pkg.version;
manifest.version_name = `${pkg.version} (built ${stamp})`;
writeFileSync('dist/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);

const common = { external: ['fs'], bundle: true, target: 'chrome116', minify: false, legalComments: 'none', logLevel: 'info' };
await build({ ...common, entryPoints: ['src/background.js'], outfile: 'dist/background.js', format: 'esm' });
await build({ ...common, entryPoints: ['src/content/index.js'], outfile: 'dist/content.js', format: 'iife' });
for (const p of ['popup', 'options', 'editor']) {
  await build({ ...common, entryPoints: [`src/${p}.js`], outfile: `dist/${p}.js`, format: 'iife' });
}
