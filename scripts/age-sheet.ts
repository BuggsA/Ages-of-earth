/**
 * A contact sheet of the age interface art (`docs/age-art.md`): each age's button plate with sample glyphs, its emblem
 * and its hand-drawn glyphs, using the game's own CSS. Open the page or screenshot it with the browser at
 * /opt/pw-browsers/chromium (see the guide) to look at your chunk before and after.
 *   npx tsx scripts/age-sheet.ts out.html [age …]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { AGES, TECHS } from '../src/sim/data';
import type { AgeId } from '../src/sim/types';
import { AGE_ICONS, plateColors, plateIsDark, plateUrl } from '../src/ui/ageIcons';
import { AGE_ART, drawing } from '../src/ui/ageArt';

const [out, ...only] = process.argv.slice(2);
if (!out) throw new Error('usage: npx tsx scripts/age-sheet.ts out.html [age …]');
const css = readFileSync(new URL('../src/ui/style.css', import.meta.url), 'utf8');
const rules = css.slice(css.indexOf("/* The age's own button plates")).replace(/#commands/g, '.pl');
const ids = (only.length ? only : Object.keys(AGES)) as AgeId[];
const sample = ['🌾', '⚔', '🏹', '🔬', '🏠'];
let h = `<style>body{background:#1d2230;color:#ddd;font:12px sans-serif;margin:8px}.row{display:flex;align-items:center;gap:8px;margin:4px 0}
.n{width:150px}.pl{display:grid;grid-auto-flow:column;grid-template-rows:64px;grid-auto-columns:70px;gap:5px;flex:none}.pl .cmd{position:relative;width:70px;height:64px;border:0;padding:0;display:grid;place-items:center;font-size:24px;color:#fff}
.pl .key{position:absolute;top:2px;left:4px;font:900 10px sans-serif}.emb{width:64px;height:64px;color:var(--ink)}${rules}</style>`;
for (const id of ids) {
  const i = AGE_ICONS[id];
  const art = AGE_ART[id];
  const ink = plateColors(id).ink;
  const dark = plateIsDark(id) ? 'data-dark="1"' : '';
  const style = `--plate:${plateUrl(id)};--ink:${ink}`;
  const techs = Object.entries(art.glyphs ?? {}).map(([k, g]) => `<div class="cmd" title="${k}"><span class="glyph drawn">${drawing(g, 34)}</span><span class="key">${k.replace(/^tech:/, '').slice(0, 8)}</span></div>`).join('');
  h += `<div class="row"><div class="n">${AGES[id].name}<br><small>${i.plate}/${i.motif}/${art.stamp ?? i.stamp}</small></div>
<div class="pl plated stamp-${art.stamp ?? i.stamp}" ${dark} style="${style}">${sample.map((g, k) => `<button class="cmd ${k === 1 ? 'on' : ''}"><span class="glyph">${g}</span><span class="key">${'QWERT'[k]}</span></button>`).join('')}</div>
<div class="pl plated stamp-${art.stamp ?? i.stamp}" ${dark} style="${style}"><div class="cmd">${art.emblem ? `<span class="glyph drawn">${drawing(art.emblem, 40)}</span>` : '<small>none</small>'}</div>${techs}</div></div>`;
}
void TECHS;
writeFileSync(out, `<html><body>${h}</body></html>`);
console.log(`wrote ${out} (${ids.length} ages)`);
