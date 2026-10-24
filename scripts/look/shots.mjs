// The art umbrella's shared before-and-after shots (#617): the same scenes for every area, so pull requests compare like with like.
//   npx vite build && (npx vite preview --port 5199 --strictPort &)
//   node scripts/look/shots.mjs [outDir] [only]     (default test-results/look; `only` is one scene name)
// Each scene starts a fresh match on seed 7 as the Britons against one rival, sets it up through `window.ages` and frames it.
// Software GL in a container draws slowly, so each scene waits for the view to catch up before its shot. Fails on any page error.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const out = process.argv[2] ?? 'test-results/look';
const only = process.argv[3];
mkdirSync(out, { recursive: true });

/** Each scene: its name, and a function run in the page against the live game (`g`, `ages`, `me` the player's id, `rv` the rival's). */
const SCENES = [
  // A first minute: the town, its citizens, the woods and berries round it.
  ['stone-start', () => ({ zoom: 1 })],
  // Two armies of mixed lines meeting on open ground in the Middle Ages.
  ['battle', ({ g, ages, me, rv }) => {
    ages.setEpoch(me, 2);
    ages.setEpoch(rv, 2);
    const p = g.players[me];
    const x = p.startX + 10;
    const y = p.startY + 2;
    const lines = ['infantry', 'ranged', 'cavalry', 'infantry', 'ranged', 'siege', 'priest', 'citizen'];
    for (let i = 0; i < 24; i++) {
      ages.spawn(me, lines[i % lines.length], x - 3 + (i % 6) * 0.9, y - 2 + Math.floor(i / 6) * 0.9);
      ages.spawn(rv, lines[(i + 3) % lines.length], x + 3 + (i % 6) * 0.9, y - 2 + Math.floor(i / 6) * 0.9);
    }
    return { x: x + 2, y, zoom: 0.7 };
  }],
  // A grown town in the Gunpowder Age: houses, a market, a temple, barracks, towers and walls among the fields.
  ['town', ({ g, ages, me }) => {
    ages.setEpoch(me, 3);
    for (const t of ['house', 'house', 'house', 'market', 'temple', 'barracks', 'range', 'stable', 'tower', 'storehouse', 'farm', 'farm', 'farm', 'snare', 'dock']) ages.build(me, t);
    const p = g.players[me];
    ages.wall(me, p.startX - 9, p.startY - 9, p.startX + 9, p.startY - 9);
    for (let i = 0; i < 12; i++) ages.spawn(me, 'citizen', p.startX + 4 + (i % 4), p.startY + 4 + Math.floor(i / 4));
    return { zoom: 1.4 };
  }],
];

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
for (const [name, setup] of SCENES) {
  if (only && only !== name) continue;
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto('http://localhost:5199/?seed=7&foes=1');
  await page.waitForSelector('#title:not(.hidden)', { timeout: 120000 });
  await page.evaluate(() => {
    const s = document.querySelector('#opt-civ');
    s.value = 'britons';
    s.dispatchEvent(new Event('change'));
  });
  await page.click('[data-act="start"]');
  await page.waitForSelector('#hud:not(.hidden)', { timeout: 120000 });
  // Close the opening card and any tip, so the shot is the world.
  await page.evaluate(() => document.querySelectorAll('[data-tip-act="off"]').forEach((e) => e.click()));
  const frame = await page.evaluate(`(${setup.toString()})((() => { const ages = window.ages; const g = ages.game; const me = g.players.findIndex((p) => !p.ai); return { g, ages, me, rv: 1 - me }; })())`);
  await page.evaluate((f) => {
    const { game: g, view } = window.ages;
    const p = g.players.find((q) => !q.ai);
    view.rig.focus(f.x ?? p.startX, f.y ?? p.startY + 3, true);
    if (f.zoom && f.zoom !== 1) view.rig.zoom(f.zoom);
    window.ages.fast(1);
    view.resources.markDirty();
  }, frame);
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.close();
  console.log(`${out}/${name}.png`);
}
await b.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
