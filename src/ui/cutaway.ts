/**
 * The deep mine's cut-away (#924 m1, `docs/deep-mine.md` "How it reads"): a side-on slice of a Mine Shaft drawn in the
 * selection panel's portrait. Layers are bands in the earth's colours (`STRATA[].tint`), seams glint in them while their
 * veins last, tiny miners stand at their faces. The layers it reaches are solid, the worked ones brightest; the layers
 * below are ghosted until reached; a spent layer is dulled. Clicking a band sends a miner there (`toLayer`).
 *
 * Props and cave-ins (#924 m2): an unshored layer that may fall in shows cracks across it; a shored one, timber props at the
 * shaft's sides with a cap beam over the face; a layer shut by a cave-in, rubble heaped over its face and a darker band.
 *
 * The wet deep (#924 m4): water seeps from the roof of a wet layer in drips and stands in it, rising from the floor, glassy
 * blue over the rock; flooded, it fills the band to the roof. A pump shows as a pipe down the shaft and a beam at the pithead.
 */
import { LODES, STRATA, SHAFT } from '../sim/data';
import { kindOf, lodeName } from '../sim/lodes';
import { SEAMS, crewOf, deepeningLeft, depthOf, digShare, fallOf, fillOf, floodedAt, pumping, safeAt, seamOf, shutLeft, veinFull, veinLeft, waterAt, wetAt } from '../sim/shafts';
import type { Building, GameState, SeamId } from '../sim/types';

const W = 116;
const H = 138;
/** The strip of sky and grass at the top, where the pithead stands. */
const TOP = 26;
/** The shaft's column, down the middle. */
const SX = 52;
const SW = 12;

/** A seam's glint colour (a later seam adds one). */
const GLINT: Partial<Record<SeamId, string>> = { stone: '#e6e0d2', gold: '#ffd24a', salt: '#f4f6f8', saltpetre: '#b8e0d0', bloodiron: '#c0303a', gems: '#7fe0f0' };

/** The seams a layer of this ground holds, and how much of each at first (#924 m3: the lode scales them). */
const veinsIn = (b: { lode?: number }, l: number): [SeamId, number][] => SEAMS.map((m) => [m, veinFull(b, l, m)] as [SeamId, number]).filter(([, n]) => n > 0);

/**
 * What a core sample reads (#924 m3): the ground below a spot, layer by layer, in the cut-away's words. The hover tip on a
 * core's striped column.
 */
export function coreTip(code: number): string {
  const k = LODES[kindOf(code)];
  const rows = STRATA.map((L, l) => {
    const veins = veinsIn({ lode: code }, l).map(([m, n]) => `${n} ${SHAFT.seams[m].name.toLowerCase()}`).join(', ') || 'no vein';
    const fall = fallOf({ lode: code }, l);
    // The wet deep (#924 m4): how fast the water rises under this ground.
    const wet = wetAt(l) ? `; floods in ${Math.round(fillOf({ lode: code }, l))}s unpumped${k.wet > 1 ? ' (wet ground)' : k.wet < 1 ? ' (dry ground)' : ''}` : '';
    return `<span style="color:${L.tint}">■</span> ${L.name}: ${veins}${fall > 0 ? `; ${Math.round(fall * 100)}% cave-in a basket unshored` : ''}${wet}`;
  });
  return `<b>Core sample · ${lodeName(code, (m) => SHAFT.seams[m].name)}</b>${k.blurb[0].toUpperCase()}${k.blurb.slice(1)}${k.add > 0 ? `, ${Math.round(k.add * 100)} points faster while a vein lasts` : ''}.<br>${rows.join('<br>')}<br>A shaft sunk on this patch digs what it shows.`;
}

/** Mix a #rrggbb colour toward another by `t` (0..1). */
function mix(a: string, b: string, t: number): string {
  const p = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  const ch = (i: number) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, '0');
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

/** A small fixed scatter for layer `l`, glint `k`: the same spots every frame, left and right of the shaft. */
function spot(l: number, k: number, y0: number, h: number): [number, number] {
  const r = (n: number) => ((Math.imul(n, 2654435761) >>> 0) % 1000) / 1000;
  const left = k % 2 === 0;
  const x = left ? 6 + r(l * 31 + k * 7 + 1) * (SX - 16) : SX + SW + 6 + r(l * 17 + k * 13 + 5) * (W - SX - SW - 14);
  return [x, y0 + 5 + r(l * 11 + k * 29 + 3) * (h - 10)];
}

/** What's left in a layer, all seams together, and how much there was. */
function veinsOf(b: Building, l: number): { left: number; full: number } {
  let left = 0;
  let full = 0;
  for (const [m, n] of veinsIn(b, l)) {
    full += n;
    left += veinLeft(b, l, m);
  }
  return { left, full };
}

/** The cut-away's SVG and a key that changes whenever what it shows does. */
export function cutaway(s: GameState, b: Building, color: string, open: boolean): { svg: string; key: string } {
  const depth = depthOf(b);
  const { at } = crewOf(s, b);
  const sinking = deepeningLeft(s, b);
  const n = STRATA.length;
  const h = (H - TOP) / n;
  const seam = seamOf(s, b);
  const parts: string[] = [];
  // Sky and grass.
  parts.push(`<rect width="${W}" height="${TOP}" fill="#2c3a52"/><path d="M0 ${TOP - 5} L30 ${TOP - 7} L70 ${TOP - 5} L${W} ${TOP - 6} V${TOP} H0Z" fill="#5f8a3e"/>`);
  for (let l = 0; l < n; l++) {
    const L = STRATA[l];
    const y0 = TOP + l * h;
    const reached = l <= depth;
    const { left, full } = veinsOf(b, l);
    const spent = reached && full > 0 && left === 0;
    const worked = reached && at[l] > 0;
    const fill = spent ? mix(L.tint, '#6a6a6a', 0.6) : worked ? mix(L.tint, '#ffffff', 0.12) : L.tint;
    const op = reached ? 1 : 0.32;
    // A low-poly band: a gently broken top edge and two darker facets.
    const j = (k: number) => (((l * 7 + k * 3) % 5) - 2) * 0.8;
    const band = `M0 ${y0 + j(0)} L${W * 0.3} ${y0 + j(1)} L${W * 0.62} ${y0 + j(2)} L${W} ${y0 + j(3)} V${y0 + h + 1} H0Z`;
    const facet = `M0 ${y0 + h * 0.55} L${W * 0.22} ${y0 + h} H0Z M${W} ${y0 + h * 0.35} L${W * 0.74} ${y0 + h} H${W}Z`;
    const glints: string[] = [];
    for (const [m, nv] of veinsIn(b, l)) {
      const c = GLINT[m];
      if (!c || !nv) continue;
      // Four glints for a plain layer's vein; more on rich ground (#924 m3), fewer on poor.
      const shown = Math.ceil((veinLeft(b, l, m) / Math.max(1, STRATA[l].veins[m] ?? nv)) * 4);
      for (let k = 0; k < Math.min(shown, 8); k++) {
        const [x, y] = spot(l, k + (m === 'gold' ? 8 : m === 'stone' ? 0 : m === 'gems' ? 24 : 16), y0, h);
        // A gem is a cut stone with a bright facet; the rest are plain glints.
        glints.push(m === 'gems'
          ? `<path d="M${(x - 2).toFixed(1)} ${y.toFixed(1)} l2 -2.6 l2 2.6 l-2 2.6Z" fill="${c}"/><path d="M${x.toFixed(1)} ${(y - 2.6).toFixed(1)} l2 2.6 h-2Z" fill="#e8fbff"/>`
          : `<path d="M${x.toFixed(1)} ${(y - 2.2).toFixed(1)} l2 2.2 l-2 2.2 l-2 -2.2Z" fill="${c}"/>`);
      }
    }
    const room = L.room;
    // Props, cracks and rubble (#924 m2), drawn only in the layers reached.
    const shut = reached ? shutLeft(s, b, l) : 0;
    const risky = reached && fallOf(b, l) > 0 && !safeAt(b, l);
    const shored = reached && L.fall > 0 && safeAt(b, l);
    const marks: string[] = [];
    if (risky) {
      // Two jagged cracks, one each side of the shaft, from the band's roof down.
      for (const [x0, dir] of [[SX - 14, -1], [SX + SW + 12, 1]] as [number, number][]) {
        const d = `M${x0} ${y0 + 1} l${dir * 3} ${(h * 0.22).toFixed(1)} l${-dir * 2.5} ${(h * 0.14).toFixed(1)} l${dir * 4} ${(h * 0.24).toFixed(1)} m${-dir * 4} ${(-h * 0.1).toFixed(1)} l${-dir * 4} ${(h * 0.12).toFixed(1)}`;
        marks.push(`<path d="${d}" stroke="#1a120c" stroke-width="0.9" fill="none" opacity="0.8"/>`);
      }
    }
    if (shored) {
      // Timber sets: a post either side of the face and a cap beam over it.
      for (const x of [SX - 22, SX - 3, SX + SW + 1, SX + SW + 20]) marks.push(`<rect x="${x}" y="${(y0 + 3).toFixed(1)}" width="2" height="${(h - 4).toFixed(1)}" fill="#a87a44"/>`);
      marks.push(`<rect x="${SX - 23}" y="${(y0 + 2).toFixed(1)}" width="23" height="2" fill="#c4935a"/><rect x="${SX + SW}" y="${(y0 + 2).toFixed(1)}" width="23" height="2" fill="#c4935a"/>`);
    }
    if (shut > 0) {
      // Rubble heaped over the face, in the band's own stone.
      const yb = y0 + h;
      const rock = mix(L.tint, '#2a2a2a', 0.35);
      marks.push(`<path d="M${SX - 26} ${yb} L${SX - 18} ${yb - h * 0.55} L${SX - 9} ${yb - h * 0.4} L${SX - 2} ${yb - h * 0.7} L${SX} ${yb}Z M${SX + SW} ${yb} L${SX + SW + 4} ${yb - h * 0.6} L${SX + SW + 13} ${yb - h * 0.45} L${SX + SW + 24} ${yb}Z" fill="${rock}" stroke="#1a120c" stroke-width="0.6"/>`);
    }
    // The water (#924 m4): drips from the roof while it rises, a pool from the floor up, the whole band when flooded.
    const water = reached && wetAt(l) ? waterAt(b, l) : 0;
    const pumped = reached && wetAt(l) && pumping(s, b);
    if (reached && wetAt(l)) {
      if (water > 0) {
        const wh = Math.min(h, h * water);
        const yw = y0 + h - wh;
        marks.push(`<rect x="0" y="${yw.toFixed(1)}" width="${W}" height="${wh.toFixed(1)}" fill="#3a8ab8" opacity="${water >= 1 ? 0.62 : 0.48}"/><path d="M0 ${yw.toFixed(1)} H${W}" stroke="#bfe6f6" stroke-width="0.8" opacity="0.8"/>`);
      }
      if (!pumped && water < 1) {
        // Drips from the roof: short blue streaks where the water seeps in.
        for (let k = 0; k < 5; k++) {
          const [x] = spot(l, k + 40, y0, h);
          const len = 2 + (k % 3);
          marks.push(`<path d="M${x.toFixed(1)} ${(y0 + 1.5).toFixed(1)} v${len}" stroke="#8fd0ee" stroke-width="1" stroke-linecap="round" opacity="0.85"/><circle cx="${x.toFixed(1)}" cy="${(y0 + 3.5 + len + (k % 2) * 3).toFixed(1)}" r="0.7" fill="#8fd0ee"/>`);
        }
      }
    }
    const wetNote = reached && wetAt(l) ? (water >= 1 ? ` Flooded: it takes no one${b.pump ? (pumped ? ' while the pump drains it.' : '; the pump has stalled with the hurt pithead.') : ' until pumped (F).'}` : pumped ? ` Pumped${water > 0 ? `: water ${Math.round(water * 100)}% and falling` : ' dry'}.` : ` Water ${Math.round(water * 100)}% and rising: to the roof in ${Math.ceil(fillOf(b, l) * (1 - water))} seconds. Every full basket risks an inrush, likelier the higher it stands. Pump it (F).`) : wetAt(l) ? ` Takes on water once reached: it floods in ${Math.round(fillOf(b, l))} seconds unless pumped.` : '';
    const state = shut > 0 ? ` Caved in: cleared in ${shut} seconds, or at once if shored.` : risky ? ` Unshored: ${Math.round(L.rush * 100)} points faster, a ${Math.round(fallOf(b, l) * 100)}% chance of a cave-in each basket. Shore it (P).` : shored ? ' Shored with props.' : '';
    const tip = `<b>${L.name}</b>${reached ? '' : `Sink the shaft to reach it (${Object.entries(L.sink).map(([r, v]) => `${v} ${r}`).join(', ')}, ${L.time} seconds). `}${veinsIn(b, l).map(([m, v]) => `${SHAFT.seams[m].name}: ${veinLeft(b, l, m)} of ${v} left`).join(', ') || 'No vein'}. Room for ${room} miners${reached ? `, ${at[l]} here` : ''}.${reached && seam ? ` Digs ${SHAFT.seams[seam].name.toLowerCase()} at ${Math.round(digShare(s, b, seam, l) * 100)}%.` : ''}${state}${wetNote}${reached && !shut && !floodedAt(b, l) ? ' Click to send a miner here.' : ''}`;
    const dark = shut > 0 ? `<path d="${band}" fill="#000" opacity="0.28"/>` : '';
    parts.push(`<g data-layer="${l}" data-shaft="${b.id}" data-tip="${tip.replace(/"/g, '&quot;')}" opacity="${op}" class="${reached ? 'cut-reach' : ''}"><path d="${band}" fill="${fill}"/><path d="${facet}" fill="#000" opacity="0.12"/>${glints.join('')}${dark}${marks.join('')}${worked ? `<path d="M0 ${y0 + 0.5} H${W}" stroke="#fff" stroke-opacity="0.35" stroke-width="1"/>` : ''}</g>`);
  }
  // The shaft: down to the deepest layer reached, and a dashed stretch into the next while it is sunk.
  const bottom = TOP + (depth + 1) * h;
  parts.push(`<rect x="${SX}" y="${TOP - 6}" width="${SW}" height="${bottom - TOP + 6}" fill="#17110c"/>`);
  if (sinking > 0 && depth + 1 < n) {
    const total = STRATA[depth + 1].time;
    const dug = Math.max(0.08, 1 - sinking / total) * h;
    parts.push(`<rect x="${SX + 2}" y="${bottom}" width="${SW - 4}" height="${dug.toFixed(1)}" fill="#17110c" stroke="#e8c070" stroke-dasharray="2 2" stroke-width="0.8"/>`);
  }
  // Ladders: a rung every few pixels down the shaft.
  for (let y = TOP; y < bottom - 2; y += 5) parts.push(`<path d="M${SX + 3} ${y} H${SX + SW - 3}" stroke="#6b4a2a" stroke-width="0.8"/>`);
  // The pump (#924 m4): its rising main down the shaft's side, and the beam that works it over the collar.
  if (b.pump) {
    const run = pumping(s, b) ? '#9aa2aa' : '#6a5a50';
    parts.push(`<rect x="${SX + SW - 3}" y="${TOP - 8}" width="2" height="${bottom - TOP + 6}" fill="${run}"/><path d="M${SX + SW - 2} ${TOP - 8} L${SX + SW + 10} ${TOP - 12}" stroke="${b.pump === 'mill' ? '#c89a5a' : '#4a4e54'}" stroke-width="1.6"/>`);
    if (b.pump === 'mill') {
      // Four sails on a little tower beside the pithead.
      const cx = SX + SW + 14;
      const cy = TOP - 16;
      parts.push(`<path d="M${cx - 2} ${TOP - 5} L${cx - 1} ${cy} H${cx + 1} L${cx + 2} ${TOP - 5}Z" fill="#a87a44"/><path d="M${cx} ${cy} l-6 -6 M${cx} ${cy} l6 -6 M${cx} ${cy} l6 6 M${cx} ${cy} l-6 6" stroke="#e8e0d0" stroke-width="1.4"/>`);
    } else {
      // A boiler house and its stack, smoke when it runs.
      const x = SX + SW + 8;
      parts.push(`<rect x="${x}" y="${TOP - 12}" width="10" height="7" fill="#6b5a4a"/><rect x="${x + 7}" y="${TOP - 20}" width="2.4" height="9" fill="#7a3a2c"/>${pumping(s, b) ? `<circle cx="${x + 8.2}" cy="${TOP - 23}" r="2" fill="#c8c8c8" opacity="0.6"/>` : ''}`);
    }
  }
  // The pithead: a headframe and its wheel, taller the deeper the shaft.
  const tall = 10 + depth * 3;
  const top = TOP - 6 - tall;
  parts.push(`<path d="M${SX - 3} ${TOP - 5} L${SX + SW / 2} ${top} L${SX + SW + 3} ${TOP - 5}" stroke="#c89a5a" stroke-width="1.6" fill="none"/><circle cx="${SX + SW / 2}" cy="${top + 1}" r="3" fill="none" stroke="#e2c08a" stroke-width="1.2"/>`);
  // Miners at their faces, by the shaft, in the player's colour.
  for (let l = 0; l <= depth; l++) {
    const y = TOP + (l + 1) * h - 2;
    for (let k = 0; k < at[l]; k++) {
      const left = k % 2 === 0;
      const x = left ? SX - 4 - Math.floor(k / 2) * 6 : SX + SW + 4 + Math.floor(k / 2) * 6;
      parts.push(`<g><rect x="${x - 1.6}" y="${y - 6}" width="3.2" height="5" rx="1" fill="${color}"/><circle cx="${x}" cy="${y - 7.6}" r="1.6" fill="#f0d8b0"/><path d="M${x + (left ? -1 : 1)} ${y - 5} l${left ? -3 : 3} -2" stroke="#ddd" stroke-width="0.8"/></g>`);
    }
  }
  // The lode (#924 m3): its name in a small tag on the sky, in its own colour.
  const lode = b.lode ?? 0;
  parts.push(`<g data-tip="${coreTip(lode).replace(/"/g, '&quot;')}"><rect x="2" y="2" width="5" height="5" rx="1" fill="${LODES[kindOf(lode)].tint}" stroke="#0008" stroke-width="0.6"/><text x="9" y="6.6" font-size="7" fill="#e8e0d0" font-family="sans-serif">${LODES[kindOf(lode)].name}</text></g>`);
  const svg = `<svg class="cutaway${open ? ' cut-open' : ''}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="The shaft, cut away">${parts.join('')}</svg>`;
  const key = `${lode}:${depth}:${sinking}:${at.join(',')}:${STRATA.map((_, l) => Math.ceil(veinsOf(b, l).left / 10)).join(',')}:${seam}:${open}:${STRATA.map((_, l) => `${safeAt(b, l) ? 1 : 0}${shutLeft(s, b, l)}${wetAt(l) ? `w${Math.round(waterAt(b, l) * 50)}` : ''}`).join(',')}:${b.pump ?? ''}${pumping(s, b) ? 1 : 0}`;
  return { svg, key };
}
