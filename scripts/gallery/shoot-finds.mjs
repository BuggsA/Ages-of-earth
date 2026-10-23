// Screenshots the finds gallery: `npx vite --port 5199 &` then `node scripts/gallery/shoot-finds.mjs [outFile]`.
import { chromium } from 'playwright-core';
const out = process.argv[2] ?? 'docs/screenshots/gallery-finds.jpg';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1600, height: 700 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:5199/scripts/gallery/finds.html');
await p.waitForFunction('window.done', null, { timeout: 60000 });
await p.screenshot({ path: out, type: 'jpeg', quality: 85 });
await b.close();
