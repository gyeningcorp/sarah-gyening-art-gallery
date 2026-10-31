// Bundles src/ into one self-contained page: docs/index.html (served by GitHub Pages).
import * as esbuild from 'esbuild';
import fs from 'fs';

const r = await esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  write: false,
  target: ['es2020'],
  legalComments: 'none',
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = fs.readFileSync('src/template.html', 'utf8');
const out = tpl.replace('/*__APP__*/', () => js);
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/index.html', out);
console.log('docs/index.html', (out.length / 1024).toFixed(0) + ' KB');
