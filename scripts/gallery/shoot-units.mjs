// Screenshots the unit gallery: `npx vite --port 5199 &` then `node scripts/gallery/shoot-units.mjs [outDir] [civ]`.
// `node scripts/gallery/shoot-units.mjs <outDir> gear` takes only the close-up of each people's foot-soldier gear (epochs 1-3).
import { chromium } from 'playwright-core';
const dir = process.argv[2] ?? 'docs/screenshots';
const civ = process.argv[3] ? `&c=${process.argv[3]}` : '';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
const gear = process.argv[3] === 'gear';
for (const g of gear ? ['gear'] : ['land', 'sea']) {
  await p.goto(`http://localhost:5199/scripts/gallery/units.html?g=${g}${gear ? '' : civ}`);
  await p.waitForFunction('window.done', null, { timeout: 60000 });
  await p.screenshot({ path: `${dir}/gallery-units-${g}.jpg`, type: 'jpeg', quality: 80 });
}
await b.close();
