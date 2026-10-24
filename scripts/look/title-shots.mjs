// The title's chosen camera shots (#267), one picture each: `npx vite --port 5199 &` then `node scripts/look/title-shots.mjs [outDir] [seed]`.
// Starts the title's own match on a lakes map, puts a dock and an army at a ford in it, and jumps the film to each shot's slot.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const out = process.argv[2] ?? 'test-results/title';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:5199/?seed=${process.argv[3] ?? 7}&weather=clear`);
await page.waitForSelector('#title:not(.hidden)', { timeout: 120000 });
// The card would cover the film: shoot the film alone.
await page.addStyleTag({ content: '#title { opacity: 0 !important; pointer-events: none }' });
await page.evaluate(() => {
  const a = window.ages;
  const g = a.game;
  a.build(0, 'dock');
  a.build(1, 'dock');
  for (let i = 0; i < 6; i++) a.build(0, 'house');
  g.landmarks ??= [];
  // The nearest landmark to the rival's town becomes the Old Ford, or one is made on open ground nearby.
  const p = g.players[1];
  let m = g.landmarks.slice().sort((a, b) => (a.x - p.startX) ** 2 + (a.y - p.startY) ** 2 - ((b.x - p.startX) ** 2 + (b.y - p.startY) ** 2))[0];
  if (!m) g.landmarks.push((m = { id: 9000, x: p.startX + 14.5, y: p.startY + 0.5, kind: 'ford', owner: -1, claim: 0, by: -1 }));
  {
    m.kind = 'ford';
    for (let i = 0; i < 8; i++) a.spawn(i % 3 ? 1 : 0, i % 2 ? 'infantry' : 'ranged', m.x - 6 + (i % 4) * 0.9, m.y - 1 + Math.floor(i / 4) * 0.9);
  }
});
for (const [name, at] of [['town', 0], ['dock-dusk', 24], ['ford-morning', 72], ['town-night', 96]]) {
  await page.evaluate((t) => window.ages.titleAt(t), at);
  await page.waitForTimeout(name === 'town-night' ? 40000 : 14000); // the light eases for ~5 s; software GL draws slowly
  await page.screenshot({ path: `${out}/title-${name}.png` });
  console.log(`${out}/title-${name}.png`);
}
await b.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
