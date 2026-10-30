// The site's own pictures (search results, link previews, home screens): `node scripts/look/site-images.mjs`.
// Draws public/icon.svg at each icon size, and the 1200×630 link card over a title shot (docs/screenshots).
// Writes into public/, which Vite copies to the site's root. Rerun after changing the icon or the card.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const icon = readFileSync('public/icon.svg', 'utf8');
const shot = readFileSync(process.argv[2] ?? 'docs/screenshots/title-ford-morning.jpg').toString('base64');
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Nunito:wght@700;800&display=block" />';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await b.newPage();

async function snap(html, w, h, path, type = 'png') {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head>${fonts}<style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}</style></head><body>${html}</body></html>`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path, type, ...(type === 'jpeg' ? { quality: 86 } : { omitBackground: true }) });
  console.log(path);
}

const svgAt = (s) => icon.replace('<svg ', `<svg width="${s}" height="${s}" style="display:block" `);
await snap(svgAt(192), 192, 192, 'public/icon-192.png');
await snap(svgAt(512), 512, 512, 'public/icon-512.png');
// Apple draws its own rounded corners, so the touch icon is square and full-bleed.
await snap(`<div style="background:#1b2230;width:180px;height:180px">${svgAt(180)}</div>`, 180, 180, 'public/apple-touch-icon.png');
// Maskable: launchers crop to any shape inside the middle 80%, so the globe sits well inside it.
await snap(`<div style="background:#1b2230;width:512px;height:512px;display:grid;place-items:center">${svgAt(400)}</div>`, 512, 512, 'public/icon-maskable-512.png');

await snap(`
<div style="position:relative;width:1200px;height:630px;background:#1b2230 url(data:image/jpeg;base64,${shot}) center/cover;font-family:Nunito,sans-serif">
  <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(18,23,33,.94) 0%,rgba(18,23,33,.82) 38%,rgba(18,23,33,0) 70%)"></div>
  <div style="position:absolute;left:64px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center;color:#e8c46a">
    <div style="width:88px;height:88px;margin-bottom:22px">${svgAt(88)}</div>
    <div style="font:800 76px/1 Cinzel,serif;letter-spacing:2px;background:linear-gradient(#ffdf8a,#e8c46a 60%,#b8913c);-webkit-background-clip:text;color:transparent">Ages <span style="font-size:.6em;-webkit-text-fill-color:#9aa3b5">of</span> Earth</div>
    <div style="margin-top:22px;font:700 30px/1.3 Nunito,sans-serif;color:#eef1f6">A real-time strategy game in your browser</div>
    <div style="margin-top:12px;font:700 22px/1.4 Nunito,sans-serif;color:#b9c1cf">From the first fire to the age of steam. Six peoples, armies, navies and aircraft, against the computer or online.</div>
    <div style="margin-top:26px;display:flex;gap:8px">${['#c7b48a', '#d8924a', '#a9b6c8', '#d0705a', '#7fa6bf'].map((c) => `<i style="width:56px;height:8px;border-radius:4px;background:${c}"></i>`).join('')}</div>
    <div style="margin-top:22px;font:800 22px Nunito,sans-serif;color:#ffdf8a">Free · No download · Play now</div>
  </div>
</div>`, 1200, 630, 'public/og-card.jpg', 'jpeg');
await b.close();
