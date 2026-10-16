// Screenshots the building gallery for each epoch in headless Chromium: `npx vite --port 5199 &` then
// `node scripts/gallery/shoot.mjs [outDir]` (default docs/screenshots/gallery-e<N>.jpg). ?t=<type>&e=<epoch> shows one.
import { chromium } from 'playwright-core';
const out = process.argv[2] ?? 'docs/screenshots';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
for (const e of [0, 1, 2, 3, 4]) {
  await p.goto(`http://localhost:5199/scripts/gallery/index.html?e=${e}`);
  await p.waitForFunction('window.done', null, { timeout: 60000 });
  await p.screenshot({ path: `${out}/gallery-e${e}.jpg`, type: 'jpeg', quality: 80 });
}
await b.close();
