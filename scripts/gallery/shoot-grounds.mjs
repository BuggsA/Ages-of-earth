// Contact sheets of the ground each age wears round a town (#815): `npx vite --port 5199 &` then
// `node scripts/gallery/shoot-grounds.mjs [outDir] [ages,comma,separated]` (default docs/screenshots/age-grounds-<n>.jpg).
import { chromium } from 'playwright-core';
const out = process.argv[2] ?? 'docs/screenshots';
const only = process.argv[3]?.split(',');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 960, height: 630 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:5199/?seed=7&size=small');
await p.waitForSelector('#title:not(.hidden)', { timeout: 120000 });
await p.click('[data-act="start"]');
await p.waitForSelector('#hud:not(.hidden)', { timeout: 120000 });
await p.addStyleTag({ content: '* { visibility: hidden !important } canvas { visibility: visible !important }' });
await p.evaluate(() => {
  for (const t of ['house', 'house', 'barracks', 'storehouse', 'house', 'market', 'temple']) window.ages.build(0, t, undefined, undefined, 3);
});
const list = only ?? (await p.evaluate(() => import('/src/sim/data.ts').then((m) => Object.keys(m.AGES))));
const shots = [];
for (const age of list) {
  await p.evaluate((age) => {
    const a = window.ages;
    return import('/src/sim/data.ts').then((m) => {
      const pl = a.game.players[0];
      pl.age = age;
      pl.epoch = m.AGES[age].tier;
      a.view.rig.focus(pl.startX + 1, pl.startY + 1);
      a.view.rig.frame(20);
    });
  }, age);
  await p.waitForTimeout(2500);
  shots.push({ age, img: (await p.screenshot({ type: 'jpeg', quality: 80 })).toString('base64') });
  console.log(age);
}
const sheet = await b.newPage({ viewport: { width: 1920, height: 945 } });
for (let i = 0; i < shots.length; i += 12) {
  const part = shots.slice(i, i + 12);
  await sheet.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(4,480px);gap:0;font:bold 18px sans-serif;color:#fff">${part.map((s) => `<div style="position:relative"><img src="data:image/jpeg;base64,${s.img}" style="width:480px;height:315px;display:block"><span style="position:absolute;left:8px;top:6px;text-shadow:0 0 4px #000">${s.age}</span></div>`).join('')}</body>`);
  await sheet.screenshot({ path: `${out}/age-grounds-${i / 12 + 1}.jpg`, type: 'jpeg', quality: 70, fullPage: false });
}
await b.close();
