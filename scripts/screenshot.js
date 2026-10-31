// Headless screenshots of the film and the camera stops.
// Usage: node scripts/screenshot.js desk|mob film=0.8,13 p=0,1,2
// Needs Playwright with Chromium installed (npm i -D playwright && npx playwright install chromium).
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const OUT = path.resolve(__dirname, '../screenshots');
fs.mkdirSync(OUT, { recursive: true });
const [,, which = 'desk', ...rest] = process.argv;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const vp = which === 'mob' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: 1 });
  p.on('console', m => { if (m.type() !== 'debug') console.log('>', m.type(), m.text().slice(0, 300)); });
  p.on('pageerror', e => console.log('ERR', e.message));
  const t0 = Date.now();
  await p.goto('file://' + path.resolve(__dirname, '../docs/index.html') + '?test');
  await p.waitForFunction(() => window.__tgReady, null, { timeout: 300000 });
  console.log('ready in', (Date.now() - t0) / 1000, 's');
  const films = (rest.find(a => a.startsWith('film=')) || 'film=').slice(5).split(',').filter(Boolean).map(Number);
  const ps = (rest.find(a => a.startsWith('p=')) || 'p=').slice(2).split(',').filter(Boolean).map(Number);
  for (const t of films) {
    await p.evaluate((t) => window.__tg.seek(t), t);
    await p.screenshot({ path: `${OUT}/${which}_film_${t}.png`, timeout: 240000 });
    console.log('film', t);
  }
  if (ps.length) {
    await p.evaluate(() => window.__tg.site(0));
    await p.waitForTimeout(200);
    for (const v of ps) {
      await p.evaluate((v) => window.__tg.setP(v), v);
      await p.screenshot({ path: `${OUT}/${which}_p_${v}.png`, timeout: 240000 });
      console.log('p', v, JSON.stringify(await p.evaluate(() => window.__tg.stats())));
    }
  }
  await b.close();
})();
