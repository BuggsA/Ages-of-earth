/**
 * The ground below differs (#924 m3, `docs/deep-mine.md`): the match's seed lays the map out in lodes, patches of
 * `LODE.cell` tiles, each a kind of `LODES` (common ground, a gold reef, building stone, poor ground, sound rock, shattered
 * ground) and some with a seam of a rare ore this world holds. Every patch round a town's start is common ground, so a town
 * digs at home as every other does (rule 1), and what is richer or poorer lies out on the map, where a shaft has to be held.
 *
 * Core samples: a Prospector's Lodge drills a core at a spot its people has seen and learns the lode there, which the
 * underground view (U) and the core's striped column show. The numbers are `LODE`, `LODES` and `CORE` in `data.ts`.
 */
import { CORE, LODE, LODES, secs } from './data';
import { mulberry32 } from './rng';
import type { Building, CoreSample, GameState, RareId, SeamId } from './types';

/** The rare seams a lode may hold, by their number in a lode's code (0: none). Glowcaps wait on the hot deep (m5). */
const ORES: (RareId | null)[] = [null, 'salt', 'saltpetre', 'bloodiron'];

/** A lode's kind (`LODES` index). */
export const kindOf = (code: number): number => (LODES[code & 15] ? code & 15 : 0);

/** The rare seam a lode holds in `LODE.oreLayer`, or null. */
export const oreOf = (code: number): SeamId | null => ORES[code >> 4] ?? null;

/** How many patches a row of the map has. */
const across = (w: number): number => Math.ceil(w / LODE.cell);

/**
 * Lay the lodes for a new match from its seed (a stream of its own, so nothing else on the map moves): tract centres on a
 * jittered grid `LODE.patch` apart, each a kind drawn by weight and perhaps a rare seam; every patch takes its nearest
 * centre's lode, but a patch within `LODE.home` tiles of a start is common ground.
 */
export function layLodes(seed: number, w: number, h: number, starts: readonly { x: number; y: number }[], rares: readonly RareId[]): Uint8Array {
  const rng = mulberry32(seed ^ 0x10de5);
  const n = LODE.patch;
  const total = LODES.reduce((a, k) => a + k.weight, 0);
  const held = ORES.filter((o): o is RareId => !!o && rares.includes(o));
  const tracts: { x: number; y: number; code: number }[] = [];
  for (let gy = 0; gy < Math.ceil(h / n); gy++) {
    for (let gx = 0; gx < Math.ceil(w / n); gx++) {
      const x = (gx + rng()) * n;
      const y = (gy + rng()) * n;
      let r = rng() * total;
      let kind = 0;
      while (kind < LODES.length - 1 && r >= LODES[kind].weight) r -= LODES[kind++].weight;
      const ore = held.length && rng() < LODE.ore ? ORES.indexOf(held[Math.floor(rng() * held.length)]) : 0;
      tracts.push({ x, y, code: kind + 16 * ore });
    }
  }
  const cw = across(w);
  const ch = Math.ceil(h / LODE.cell);
  const out = new Uint8Array(cw * ch);
  const home2 = LODE.home * LODE.home;
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const x0 = cx * LODE.cell;
      const y0 = cy * LODE.cell;
      // Home ground: the patch comes within `home` of a start (its nearest point, not its middle).
      const home = starts.some((st) => {
        const dx = Math.max(x0 - st.x, 0, st.x - (x0 + LODE.cell));
        const dy = Math.max(y0 - st.y, 0, st.y - (y0 + LODE.cell));
        return dx * dx + dy * dy <= home2;
      });
      if (home) continue;
      const mx = x0 + LODE.cell / 2;
      const my = y0 + LODE.cell / 2;
      let best = 0;
      let d = Infinity;
      for (const t of tracts) {
        const e = (t.x - mx) * (t.x - mx) + (t.y - my) * (t.y - my);
        if (e < d) {
          d = e;
          best = t.code;
        }
      }
      out[cy * cw + cx] = best;
    }
  }
  return out;
}

/** The lode under a point of the map (0, common ground, where the match has none: an older save or a campaign). */
export function lodeAt(s: GameState, x: number, y: number): number {
  if (!s.lodes || x < 0 || y < 0 || x >= s.w || y >= s.h) return 0;
  return s.lodes[Math.floor(y / LODE.cell) * across(s.w) + Math.floor(x / LODE.cell)] ?? 0;
}

/** The lode under a site: the one at its middle. */
export const lodeOfSite = (s: GameState, b: { tx: number; ty: number; size: number }): number => lodeAt(s, b.tx + b.size / 2, b.ty + b.size / 2);

/** The patch a point lies in, for the underground view: its corner and side, in tiles. */
export function patchOf(x: number, y: number): { x0: number; y0: number; side: number } {
  return { x0: Math.floor(x / LODE.cell) * LODE.cell, y0: Math.floor(y / LODE.cell) * LODE.cell, side: LODE.cell };
}

/** A lode said in a few words: "A gold reef, with a seam of salt". */
export function lodeName(code: number, seamName: (m: SeamId) => string): string {
  const ore = oreOf(code);
  return `${LODES[kindOf(code)].name}${ore ? `, with a seam of ${seamName(ore).toLowerCase()}` : ''}`;
}

// ---- Core samples -------------------------------------------------------------------------------------------------

/** A people's cores that are drawn (ready to read), oldest first. */
export const coresOf = (s: GameState, owner: number): CoreSample[] => (s.players[owner]?.cores ?? []).filter((c) => c.at <= s.tick);

/** Seconds until a lodge's core is drawn, or 0 when it is drilling none. */
export function drillingLeft(s: GameState, b: Building): number {
  const c = s.players[b.owner]?.cores?.find((k) => k.by === b.id && k.at > s.tick);
  return c ? Math.ceil((c.at - s.tick) / secs(1)) : 0;
}

/** Why a people's lodge can't drill a core at this point now, or null. Its cost is checked where it is paid. */
export function coreProblem(s: GameState, owner: number, b: GameState['ents'][number] | undefined, x: number, y: number): string | null {
  if (!b || b.kind !== 'building' || b.owner !== owner || b.type !== 'prospector') return "Only a Prospector's Lodge draws cores";
  if (!b.built) return 'Finish the lodge first';
  if (!(x >= 0 && y >= 0 && x < s.w && y < s.h)) return 'That is off the map';
  const p = s.players[owner];
  const tile = Math.floor(y) * s.w + Math.floor(x);
  if (!p.seen[tile]) return 'Your people has not seen that ground';
  if (drillingLeft(s, b) > 0) return 'The lodge is drilling a core already';
  const near = CORE.near * CORE.near;
  const tx = tile % s.w;
  const ty = Math.floor(tile / s.w);
  const close = (c: CoreSample) => {
    const dx = (c.tile % s.w) - tx;
    const dy = Math.floor(c.tile / s.w) - ty;
    return dx * dx + dy * dy <= near;
  };
  if (p.cores?.some(close)) return 'A core was drawn there already';
  return null;
}

/** Drill a core (paid by the caller): ready `CORE.time` seconds from now. Past `CORE.most`, the oldest is let go. */
export function drawCore(s: GameState, owner: number, b: Building, x: number, y: number): void {
  const p = s.players[owner];
  const tile = Math.floor(y) * s.w + Math.floor(x);
  (p.cores ??= []).push({ tile, lode: lodeAt(s, x, y), by: b.id, at: s.tick + secs(CORE.time) });
  while (p.cores.length > CORE.most) p.cores.shift();
}
