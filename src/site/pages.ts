import { AGES, CIVS, EPOCHS, MAP_TYPES } from '../sim/data';

/**
 * The site's plain pages (#896): what the game is, its peoples, its ages and how to play, as static
 * HTML that search engines and people without WebGL can read. Built from the game's own data at
 * build time (`vite.config.ts`, sitePagesPlugin), so they never drift from it; the Worker lists
 * SITE_PAGES in /sitemap.xml.
 */
export const SITE_PAGES = [
  { path: 'guide/', title: 'How to play', nav: 'How to play' },
  { path: 'peoples/', title: 'The six peoples', nav: 'Peoples' },
  { path: 'ages/', title: 'The ages', nav: 'Ages' },
] as const;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(path: string, title: string, description: string, body: string): string {
  const nav = SITE_PAGES.map((p) => `<a href="/${p.path}"${p.path === path ? ' aria-current="page"' : ''}>${p.nav}</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#1b2230" />
<title>${esc(title)} · a free browser RTS</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="/${path}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Ages of Earth" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="/og-card.jpg" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="/icon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Nunito:wght@600;700;800&display=swap" media="print" onload="this.media='all'" />
<style>
:root { color-scheme: dark; --ink: #e8ecf3; --muted: #9aa3b5; --gold: #e8c46a; --gold-2: #ffdf8a; --card: #18202d; --line: #2b3546; }
* { box-sizing: border-box; }
body { margin: 0; background: #0e1621; color: var(--ink); font: 17px/1.65 Nunito, system-ui, -apple-system, sans-serif; }
a { color: var(--gold-2); }
header.top { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; padding: 12px 20px; background: rgba(14, 22, 33, 0.94); border-bottom: 1px solid var(--line); }
.brand { display: flex; align-items: center; gap: 10px; color: var(--gold); text-decoration: none; font: 800 20px Cinzel, Georgia, serif; letter-spacing: 1px; }
.brand img { width: 32px; height: 32px; }
nav { display: flex; flex-wrap: wrap; gap: 4px 18px; flex: 1; }
nav a { color: var(--muted); text-decoration: none; font-weight: 700; }
nav a:hover, nav a[aria-current] { color: var(--gold-2); }
.play { padding: 8px 18px; border-radius: 8px; background: linear-gradient(#f2d27e, #c99a3e); color: #1b2230; font-weight: 800; text-decoration: none; white-space: nowrap; }
main { max-width: 860px; margin: 0 auto; padding: 28px 20px 56px; }
h1 { margin: 8px 0 6px; font: 800 clamp(30px, 6vw, 46px)/1.15 Cinzel, Georgia, serif; color: var(--gold); }
h2 { margin: 36px 0 10px; font: 700 26px/1.2 Cinzel, Georgia, serif; color: var(--gold); }
h3 { margin: 0 0 4px; font-size: 19px; }
.lede { color: var(--muted); font-size: 19px; margin: 0 0 18px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; margin: 12px 0; }
.card p { margin: 6px 0 0; }
.tag { color: var(--muted); font-size: 15px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.grid .card { margin: 0; }
ul.howto li { margin: 8px 0; }
kbd { padding: 1px 6px; border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 4px; background: #222c3b; font: 600 14px ui-monospace, monospace; }
.cta { margin: 40px 0 0; text-align: center; }
.cta .play { display: inline-block; padding: 12px 28px; font-size: 19px; white-space: normal; }
@media (max-width: 600px) { .brand { flex: 1; } nav { order: 3; flex-basis: 100%; } }
footer { padding: 20px; text-align: center; color: var(--muted); font-size: 14px; border-top: 1px solid var(--line); }
</style>
</head>
<body>
<header class="top"><a class="brand" href="/"><img src="/icon.svg" alt="" />Ages of Earth</a><nav aria-label="Guide">${nav}</nav><a class="play" href="/">Play free</a></header>
<main>
${body}
<p class="cta"><a class="play" href="/">Play Ages of Earth free in your browser</a></p>
</main>
<footer>Ages of Earth is a free real-time strategy game for the browser: no download, no account. Best on a laptop or desktop with a mouse.</footer>
</body>
</html>
`;
}

/** Every page, keyed by its file in dist/. `howto` is the How to play list from index.html, so the guide matches the game's own. */
export function sitePages(howto: string): Record<string, string> {
  const peoples = Object.values(CIVS)
    .map((c) => `<section class="card"><h3>${esc(c.name)}</h3><p>${esc(c.blurb)}</p>${c.verb ? `<p class="tag"><b>You:</b> ${esc(c.verb)}.</p>` : ''}${c.door ? `<p class="tag"><b>The price:</b> ${esc(c.door)}.</p>` : ''}</section>`)
    .join('\n');
  const ages = EPOCHS.map((e, tier) => {
    const here = Object.values(AGES).filter((a) => a.tier === tier);
    const cards = here
      .map((a) => `<section class="card"><h3>${esc(a.name)}</h3><p>${esc(a.blurb)}</p>${a.good ? `<p class="tag">${esc(a.good)}.</p>` : ''}</section>`)
      .join('\n');
    return `<h2>${esc(e.name)}${here.length > 1 ? ` and its side roads` : ''}</h2>\n<div class="grid">${cards}</div>`;
  }).join('\n');
  const maps = Object.values(MAP_TYPES).map((m) => `<li><b>${esc(m.label)}:</b> ${esc(m.blurb)}</li>`).join('');
  const ageCount = Object.keys(AGES).length;
  return {
    'guide/index.html': page(
      'guide/',
      'How to play Ages of Earth',
      'How to play Ages of Earth, a free real-time strategy game in the browser: gather, build, advance through the ages, command armies, ships and aircraft, and the keys that matter.',
      `<h1>How to play</h1>
<p class="lede">Ages of Earth is a real-time strategy game in the spirit of Age of Empires and Empire Earth. You lead one of six peoples from the Stone Age onward: gather, build a town, raise an army, and outlast your rivals, against the computer or online with friends.</p>
<ul class="howto">${howto}</ul>
<h2>The maps</h2>
<ul>${maps}</ul>
<p>Every map comes from a seed: share a world link and a friend plays the same land with the same rivals. Read about <a href="/peoples/">the six peoples</a> and <a href="/ages/">the ${ageCount} ages</a>.</p>`,
    ),
    'peoples/index.html': page(
      'peoples/',
      'The six peoples of Ages of Earth',
      `The Egyptians, Greeks, Romans, Mongols, Chinese and Britons in Ages of Earth, a free browser RTS: how each people plays, what it does best and what it gives up.`,
      `<h1>The six peoples</h1>
<p class="lede">Each people plays differently: not just stronger numbers, but a different way to run a town and fight a war. Each is drawn from history.</p>
${peoples}`,
    ),
    'ages/index.html': page(
      'ages/',
      `The ${ageCount} ages of Ages of Earth`,
      `All ${ageCount} ages in Ages of Earth, a free browser RTS: the trunk from the Stone Age to the Atomic Age, and the side roads (Age of Sail, Age of the Steppe, Age of the Silk Road and more) that change how your people play.`,
      `<h1>The ages</h1>
<p class="lede">The ages in Ages of Earth are a web, not a ladder. The trunk runs from the Stone Age to the Atomic Age and works on every map; ${ageCount - EPOCHS.length} side ages branch off it, each changing what your people do while they stand there. The land you wake in opens roads of its own, and stepping back is sometimes how you get ahead.</p>
${ages}`,
    ),
  };
}
