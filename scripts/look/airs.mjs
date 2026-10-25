// The air of each age (#803): one shot per age of the same town, set to that age, to compare the sky, haze and sun.
//   npx vite build && (npx vite preview --port 5199 --strictPort &)
//   node scripts/look/airs.mjs [outDir] [age,age,...]      (default: a spread of ages in test-results/airs)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const out = process.argv[2] ?? 'test-results/airs';
const ages = (process.argv[3] ?? 'stone,bronze,industrial,atomic,mycelium,hive,golden,leviathans,bloodrite').split(',');
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await b.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5199/?seed=7&foes=1&hour=11');
await page.waitForSelector('#title:not(.hidden)', { timeout: 120000 });
await page.click('[data-act="start"]');
await page.waitForSelector('#hud:not(.hidden)', { timeout: 120000 });
await page.evaluate(() => document.querySelectorAll('[data-tip-act="off"]').forEach((e) => e.click()));
for (const age of ages) {
  await page.evaluate((a) => {
    const { game: g, view } = window.ages;
    const p = g.players.find((q) => !q.ai);
    const TRUNK = ['stone', 'bronze', 'middle', 'gunpowder', 'industrial', 'atomic'];
    p.age = a;
    p.epoch = TRUNK.includes(a) ? TRUNK.indexOf(a) : 2;
    view.rig.focus(p.startX, p.startY + 3, true);
    window.ages.fast(1);
  }, age);
  await page.waitForTimeout(9000); // the air eases over a few seconds
  await page.screenshot({ path: `${out}/${age}.png` });
  console.log(`${out}/${age}.png`);
}
await b.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
