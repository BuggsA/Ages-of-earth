import { ageOf, hasWalked, isSideRoad, roadKnown } from '../sim/ages';
import { AGES, ROADS, ROUTES, TICK_HZ, TRUNK } from '../sim/data';
import { leanOf } from '../sim/ai';
import type { AgeId, GameState, Player } from '../sim/types';
import { MAP, layout } from './webMap';

/**
 * Your road at the end (#743, `docs/engagement.md` Phase 1, step 3): each player's journey through the web drawn on the end
 * screen, from the `journey` the rules keep. The climbs, the loops back, time in each age, keepsakes carried, crossings walked,
 * and each weak window after a step back with what was lost in it. Under it, the roads the viewer knew of that nobody took.
 */

/** A stay in one age: from the tick it was entered to the tick it was left (or the match ended). */
export interface Stay {
  age: AgeId;
  from: number;
  to: number;
  /** Entered by a step back; `lost` is what fell inside its weak window. */
  back: boolean;
  lost: number;
}

/** The ages a player stood in, in order. A save from before the journey was kept starts from the age it stands in. */
export function staysOf(p: Player, end: number): Stay[] {
  const legs = p.journey ?? [];
  const out: Stay[] = [{ age: legs[0]?.from ?? ageOf(p), from: 0, to: legs[0]?.tick ?? end, back: false, lost: 0 }];
  legs.forEach((l, i) => out.push({ age: l.to, from: l.tick, to: legs[i + 1]?.tick ?? end, back: !!l.back, lost: l.lost ?? 0 }));
  return out;
}

/** The crossing ages (#585) a player has walked. */
export const crossingsWalked = (p: Player): AgeId[] => [...new Set(ROADS.filter((r) => r.crossing && hasWalked(p, r.to)).map((r) => r.to))];

/** The ages whose work a standing building of the player's still keeps. */
export function keepsakesCarried(s: GameState, p: Player): AgeId[] {
  const out: AgeId[] = [];
  for (const e of s.ents) if (e.kind === 'building' && e.owner === p.id && e.keep && e.hp > 0 && !out.includes(e.keep)) out.push(e.keep);
  return out;
}

/** Side roads the viewer knew of, from an age they stood in, into an age no player walked: what this seed offered and nobody took. */
export function untakenRoads(s: GameState, viewer: number): { from: AgeId; to: AgeId }[] {
  const v = s.players[viewer];
  if (!v) return [];
  const stood = (a: AgeId) => hasWalked(v, a) || (TRUNK.includes(a) && AGES[a].tier <= v.epoch);
  return ROADS.filter((r) => isSideRoad(r) && stood(r.from) && roadKnown(s, v, r) && !s.players.some((p) => hasWalked(p, r.to))).map((r) => ({ from: r.from, to: r.to }));
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const mins = (ticks: number) => {
  const m = ticks / TICK_HZ / 60;
  return m < 1 ? `${Math.round(ticks / TICK_HZ)}s` : `${Math.floor(m)}m`;
};

/** One player's road as a line of text: "Stone 6m → Bronze 8m → ↩ Stone 3m (window: lost 4) → …". */
export function roadLine(p: Player, end: number): string {
  return staysOf(p, end)
    .map((st) => `${st.back ? '↩ ' : ''}${AGES[st.age].short} ${mins(st.to - st.from)}${st.back ? (st.lost ? ` (window struck: lost ${st.lost})` : ' (window unstruck)') : ''}`)
    .join(' → ');
}

/** The end screen's "Roads walked" section: the web drawn with every player's journey, a line each, and the roads nobody took. */
export function journeyHtml(s: GameState, viewer: number, end: number): string {
  const pos = layout();
  const untaken = untakenRoads(s, viewer);
  const ages = new Set<AgeId>();
  for (const p of s.players) for (const st of staysOf(p, end)) ages.add(st.age);
  for (const r of untaken) (ages.add(r.from), ages.add(r.to));
  const { nodeW: w, nodeH: h } = MAP;
  const xs = [...ages].map((a) => pos[a].x), ys = [...ages].map((a) => pos[a].y);
  const x0 = Math.min(...xs) - w / 2 - 6, y0 = Math.min(...ys) - h / 2 - 6;
  const vw = Math.max(...xs) - x0 + w / 2 + 6, vh = Math.max(...ys) - y0 + h / 2 + 6;
  const defs = s.players.map((p) => `<marker id="jr-arrow-${p.id}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8z" fill="${p.color}"/></marker>`).join('');
  // Each leg runs to its own right, so a road walked there and back shows as two lines, and each player a little
  // farther out than the last, so two people on the same road both show.
  const legs = s.players
    .map((p, i) => {
      const off = 3 + i * 5;
      return (p.journey ?? [])
        .map((l) => {
          const a = pos[l.from], b = pos[l.to];
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
          const px = -dy / len, py = dx / len;
          const tip = `<title>${esc(p.name)}: ${l.back ? 'stepped back to' : 'entered'} the ${esc(AGES[l.to].name)} at ${mins(l.tick)}</title>`;
          const cls = `jr-leg${l.back ? ' back' : ''}" stroke="${p.color}" fill="none" marker-end="url(#jr-arrow-${p.id})`;
          if (Math.abs(dy) < h) {
            // Along a tier the boxes nearly touch: arc from the top (or bottom) of one box to the other's.
            const side = py >= 0 ? 1 : -1, sx = Math.sign(dx) * (w / 4);
            const y = a.y + side * (h / 2 + 2), dip = y + side * (10 + off * 2);
            return `<path class="${cls}" d="M${a.x + sx} ${y}Q${(a.x + b.x) / 2} ${dip} ${b.x - sx} ${b.y + side * (h / 2 + 2)}">${tip}</path>`;
          }
          // Stop short of the boxes at both ends.
          const cut = Math.min(0.45, (h / 2 + 3) / Math.abs(dy));
          const x1 = a.x + dx * cut + px * off, y1 = a.y + dy * cut + py * off, x2 = b.x - dx * cut + px * off, y2 = b.y - dy * cut + py * off;
          return `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${tip}</line>`;
        })
        .join('');
    })
    .join('');
  const faint = untaken.map((r) => `<line class="jr-untaken" x1="${pos[r.from].x}" y1="${pos[r.from].y + h / 2}" x2="${pos[r.to].x}" y2="${pos[r.to].y - h / 2}"/>`).join('');
  const walked = new Set(s.players.flatMap((p) => staysOf(p, end).map((st) => st.age)));
  const nodes = [...ages]
    .map((a) => `<g class="jr-node${walked.has(a) ? '' : ' untaken'}"><rect x="${pos[a].x - w / 2}" y="${pos[a].y - h / 2}" width="${w}" height="${h}" rx="8"/><text x="${pos[a].x}" y="${pos[a].y + 4}" text-anchor="middle">${esc(AGES[a].short)}</text></g>`)
    .join('');
  const rows = s.players
    .map((p) => {
      const kept = keepsakesCarried(s, p), cross = crossingsWalked(p);
      const lean = leanOf(s, p.id);
      const bits = [lean ? `Favoured the ${ROUTES[lean].name.toLowerCase()}` : '', kept.length ? `Keepsakes carried: ${kept.map((a) => AGES[a].name).join(', ')}` : '', cross.length ? `Crossings walked: ${cross.map((a) => AGES[a].name).join(', ')}` : ''].filter(Boolean);
      return `<li><span class="swatch" style="background:${p.color}"></span><b>${esc(p.name)}</b> ${esc(roadLine(p, end))}${bits.length ? `<div class="jr-sub">${esc(bits.join('. '))}</div>` : ''}</li>`;
    })
    .join('');
  const none = untaken.length ? `<p class="jr-sub">Roads you knew of that nobody took: ${untaken.map((r) => `${AGES[r.from].short} → ${AGES[r.to].name}`).join(', ')}.</p>` : '';
  return `<details class="jr" open><summary>Roads walked</summary>
    <svg class="jr-map" viewBox="${x0} ${y0} ${vw} ${vh}" width="${vw}" height="${vh}" role="img" aria-label="Each player's road through the ages"><defs>${defs}</defs>${faint}${nodes}${legs}</svg>
    <ul class="jr-list">${rows}</ul>${none}</details>`;
}
