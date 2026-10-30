// The age preview's four parts and its "Here" reasons (the owner, 2026-10-30), in a browser: an Industrial town whose rival walks the
// Warband, the Town Center selected, each age-up button hovered and shot with its tip.
//   npx vite build && (npx vite preview --port 5199 --strictPort &)
//   node scripts/look/age-preview.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const out = process.argv[2] ?? 'test-results/age-preview';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await b.newPage({ viewport: { width: 1280, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5199/?seed=7&foes=1');
await page.waitForSelector('#title:not(.hidden)', { timeout: 120000 });
await page.click('[data-act="start"]');
await page.waitForSelector('#hud:not(.hidden)', { timeout: 120000 });
await page.evaluate(() => document.querySelectorAll('[data-tip-act="off"]').forEach((e) => e.click()));
await page.evaluate(() => {
  const { ages } = window;
  const g = ages.game;
  const me = g.players.findIndex((p) => !p.ai);
  ages.setEpoch(me, 2);
  ages.setEpoch(1 - me, 2);
  ages.build(me, 'dock');
  ages.build(me, 'market');
  ages.build(me, 'temple');
  g.players[1 - me].age = 'warband';
  for (const p of g.players) p.res = { food: 99999, wood: 99999, gold: 99999, stone: 99999 };
  ages.fast(1);
});
await page.keyboard.press('h');
await page.waitForTimeout(1500);
const n = await page.locator('.cmd').count();
for (let i = 0; i < n; i++) {
  const btn = page.locator('.cmd').nth(i);
  const tip = (await btn.getAttribute('data-tip')) ?? '';
  const m = tip.match(/^<b>(?:Advance to |Turn to |Step back to )?the ([^<·]+)/i);
  if (!m) continue;
  await btn.hover();
  await page.waitForTimeout(400);
  const name = m[1].trim().replace(/\W+/g, '-').toLowerCase();
  const box = await page.locator('#tooltip').boundingBox();
  if (box) await page.screenshot({ path: `${out}/${name}.png`, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: box.width + 16, height: box.height + 16 } });
  console.log(`${out}/${name}.png`);
}
await b.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
