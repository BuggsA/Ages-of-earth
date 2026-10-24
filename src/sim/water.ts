import { DYKE, POLDER, domainOf, secs } from './data';
import { ageDef, asleep } from './ages';
import type { Building, GameState, Player } from './types';
import { B_RES, B_TERRAIN, R_FISH, R_NONE, T_GRASS, T_ROCK, T_WATER } from './types';

/**
 * The water layer (#701, the Water Road). The map's water was fixed at the start of a match until the Age of Dykes: a people raises
 * dykes across the shallows (a bank its own people walk along and nobody else passes, `stampBuilding`), and windmills behind them pump
 * the water out, a tile at a time, nearest first, into polder: land where the sea was (`T_GRASS`, marked in `GameState.polder`), its
 * corners raised just over the water line so the renderer shows the water stepping back. Water flows four ways only, so a dyke line
 * that steps diagonally still holds. A mill pumps only a small basin (a lake, or a bay a dyke has shut off): water that reaches a map
 * edge, or more than `POLDER.most` tiles of it, is the open sea. Drained land is everyone's: a strait drained is a land bridge.
 * The numbers are `DYKE` and `POLDER`. Breaches, sluices and canals are the road's later steps (#701 s2 on).
 */

/** Whether this tile was pumped out into polder. */
export const isPolder = (s: GameState, tile: number): boolean => !!s.polder && s.polder[tile] === 1;

/** Whether a water tile is shallow enough to raise a dyke in: every corner at `DYKE.depth` or higher. */
export function shallow(s: GameState, tile: number): boolean {
  if (s.terrain[tile] !== T_WATER) return false;
  const x = tile % s.w;
  const y = (tile - x) / s.w;
  const W = s.w + 1;
  const h = s.height;
  const i = y * W + x;
  return h[i] >= DYKE.depth && h[i + 1] >= DYKE.depth && h[i + W] >= DYKE.depth && h[i + W + 1] >= DYKE.depth;
}

/** Why a dyke can't stand on this tile, as the land sees it: deep water, or dry land with no water beside it. Null where it can. */
export function dykeSpot(s: GameState, tx: number, ty: number): 'deep' | 'dry' | null {
  const i = ty * s.w + tx;
  if (s.terrain[i] === T_WATER) return shallow(s, i) ? null : 'deep';
  if (s.terrain[i] === T_ROCK) return null;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if ((dx || dy) && x >= 0 && y >= 0 && x < s.w && y < s.h && s.terrain[y * s.w + x] === T_WATER) return null;
    }
  return 'dry';
}

/** Shallow water tiles within `DYKE.home` of where a people began: what its coast door counts. */
export function shallowsNear(s: GameState, p: Player): number {
  const cx = Math.floor(p.startX);
  const cy = Math.floor(p.startY);
  const r = DYKE.home;
  let n = 0;
  for (let y = Math.max(0, cy - r); y <= Math.min(s.h - 1, cy + r); y++)
    for (let x = Math.max(0, cx - r); x <= Math.min(s.w - 1, cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r && shallow(s, y * s.w + x)) n++;
    }
  return n;
}

/** Whether a people's coast opens the Age of Dykes: enough shallows by its town. */
export const coastHeld = (s: GameState, p: Player): boolean => shallowsNear(s, p) >= DYKE.need;

/** Water that flows: open water with no dyke (or any building) on it. */
const wet = (s: GameState, i: number): boolean => s.terrain[i] === T_WATER && s.bldAt[i] === 0;
/** What a mill's pull passes through: water, and the polder it has already won. */
const pull = (s: GameState, i: number): boolean => wet(s, i) || (isPolder(s, i) && s.bldAt[i] === 0);

const FOUR = [1, 0, -1, 0, 0, 1, 0, -1];

/**
 * The water a windmill pumps: the water within `POLDER.reach` of its footprint, reached through water and polder four ways, in the
 * order it is reached (nearest first). Each body it touches is judged on its own, in tile order: the first that is a basin (no map
 * edge, at most `POLDER.most` water tiles) and still holds water is the one. Empty when there is none: the open sea, or all dry.
 */
export function basinOf(s: GameState, b: { tx: number; ty: number; size: number }): number[] {
  const { w, h } = s;
  const r = POLDER.reach;
  const seen = new Set<number>();
  for (let y = Math.max(0, b.ty - r); y < Math.min(h, b.ty + b.size + r); y++)
    for (let x = Math.max(0, b.tx - r); x < Math.min(w, b.tx + b.size + r); x++) {
      const start = y * w + x;
      if (seen.has(start) || !pull(s, start)) continue;
      const order: number[] = [start];
      seen.add(start);
      let water = 0;
      let open = false;
      for (let k = 0; k < order.length && !open; k++) {
        const t = order[k];
        const tx = t % w;
        const ty = (t - tx) / w;
        if (s.terrain[t] === T_WATER) {
          water++;
          if (tx === 0 || ty === 0 || tx === w - 1 || ty === h - 1 || water > POLDER.most) open = true;
        }
        for (let d = 0; d < 8; d += 2) {
          const nx = tx + FOUR[d];
          const ny = ty + FOUR[d + 1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (seen.has(n) || !pull(s, n)) continue;
          seen.add(n);
          order.push(n);
        }
      }
      if (open || water === 0) continue;
      return order.filter((t) => s.terrain[t] === T_WATER);
    }
  return [];
}

/** Whether a windmill works now: finished, standing, and its people in the Age of Dykes (a mill outside it sleeps, `asleep`). */
export function pumps(s: GameState, b: Building): boolean {
  return b.type === 'windmill' && b.built && b.hp > 0 && !!ageDef(s.players[b.owner]).pumps && !asleep(s, b);
}

/** Why a finished windmill stands still, or null while it pumps. */
export function millIdle(s: GameState, b: Building): string | null {
  if (!ageDef(s.players[b.owner]).pumps) return 'Windmills pump only in the Age of Dykes';
  if (!basinOf(s, b).length) return 'No water to pump here: raise it by a lake, or by a bay your dykes have shut off from the open sea';
  return null;
}

/** Pump one tile dry: it becomes polder, land for anyone, its fish lost and its corners raised over the water line. */
export function drain(s: GameState, tile: number, owner: number, mill: number): void {
  const { w } = s;
  s.terrain[tile] = T_GRASS;
  (s.polder ??= new Uint8Array(w * s.h))[tile] = 1;
  if (s.res[tile] === R_FISH) {
    s.res[tile] = R_NONE;
    s.amount[tile] = 0;
    s.block[tile] &= ~B_RES;
  }
  s.block[tile] &= ~B_TERRAIN;
  const x = tile % w;
  const y = (tile - x) / w;
  const W = w + 1;
  for (const c of [y * W + x, y * W + x + 1, (y + 1) * W + x, (y + 1) * W + x + 1]) if (s.height[c] < POLDER.ground) s.height[c] = POLDER.ground;
  s.blockVersion++;
  const p = s.players[owner];
  p.stats.drained = (p.stats.drained ?? 0) + 1;
  s.events.push({ k: 'drained', owner, mill, tile, x: x + 0.5, y: y + 0.5 });
}

/**
 * Every `POLDER.every` seconds each working windmill (in id order, each on its own beat) pumps the nearest tile of its basin dry,
 * passing over one a boat floats on: a boat is never left aground.
 */
export function pumpStep(s: GameState): void {
  if (s.tick % 5 !== 0) return;
  const period = secs(POLDER.every);
  let afloat: Set<number> | null = null;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'windmill' || (s.tick + e.id * 5) % period !== 0 || !pumps(s, e)) continue;
    const basin = basinOf(s, e);
    if (!basin.length) continue;
    if (!afloat) {
      afloat = new Set();
      for (const u of s.ents) if (u.kind === 'unit' && u.hp > 0 && domainOf(u.type) === 'water') afloat.add(Math.floor(u.y) * s.w + Math.floor(u.x));
    }
    const tile = basin.find((t) => !afloat!.has(t));
    if (tile === undefined) continue;
    drain(s, tile, e.owner, e.id);
    e.pumped = s.tick;
  }
}

/** Whether a Farm stands on polder: most of its footprint pumped out of the sea. It works `POLDER.farm` times as fast. */
export function polderField(s: GameState, b: Building): boolean {
  if (!s.polder) return false;
  let n = 0;
  for (let y = b.ty; y < b.ty + b.size; y++) for (let x = b.tx; x < b.tx + b.size; x++) if (s.polder[y * s.w + x] === 1) n++;
  return n * 2 > b.size * b.size;
}

/** A dyke line and the basin it shuts off (#701): what the computer builds toward. `line` is empty for a lake that needs none. */
export interface DykePlan {
  /** Ends of the line, on land, as a wall drag takes them; the dykes go on the water tiles between. */
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** The water tiles of the line, in order. */
  line: number[];
  /** The water tiles it shuts off, nearest the line first. */
  basin: number[];
  score: number;
}

/** The four-way water body (with the given tiles as banks) that holds `start`: its tiles, or null once it is open sea. */
function body(s: GameState, start: number, banks: Set<number>): number[] | null {
  const { w, h } = s;
  const out = [start];
  const seen = new Set(out);
  for (let k = 0; k < out.length; k++) {
    const t = out[k];
    const tx = t % w;
    const ty = (t - tx) / w;
    if (tx === 0 || ty === 0 || tx === w - 1 || ty === h - 1 || out.length > POLDER.most) return null;
    for (let d = 0; d < 8; d += 2) {
      const n = (ty + FOUR[d + 1]) * w + tx + FOUR[d];
      if (seen.has(n) || banks.has(n) || !wet(s, n)) continue;
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/** The four straight ways a dyke line is tried. */
const DIRS4 = [1, 0, 0, 1, 1, 1, 1, -1];

/**
 * The best dyke near a point (#701), for the computer: every shallow tile within `reach` is tried as the middle of a straight line (four
 * ways) running to land on both sides within `AI_DYKE.line` water tiles, all of them shallow; the line (as `walls` lays it between its
 * two shore ends) must shut off a basin of `least` to `POLDER.most` water tiles. A lake small enough to pump needs no line. Scored by
 * tiles won less `cost` for each dyke; ties go to the first found, in tile order. Null when there is none.
 */
export function dykePlan(s: GameState, cx: number, cy: number, reach: number, opts: { line: number; least: number; cost: number }, walls: (x0: number, y0: number, x1: number, y1: number) => { x: number; y: number }[]): DykePlan | null {
  const { w, h } = s;
  let best: DykePlan | null = null;
  const tried = new Set<string>();
  const lakes = new Set<number>();
  const x0 = Math.max(1, Math.floor(cx - reach));
  const x1 = Math.min(w - 2, Math.floor(cx + reach));
  const y0 = Math.max(1, Math.floor(cy - reach));
  const y1 = Math.min(h - 2, Math.floor(cy + reach));
  const consider = (p: DykePlan) => {
    if (!best || p.score > best.score) best = p;
  };
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const t = y * w + x;
      if (!wet(s, t)) continue;
      const dx0 = x - cx;
      const dy0 = y - cy;
      if (dx0 * dx0 + dy0 * dy0 > reach * reach) continue;
      // A lake to pump as it is.
      if (!lakes.has(t)) {
        const lake = body(s, t, new Set());
        if (lake) {
          for (const l of lake) lakes.add(l);
          if (lake.length >= opts.least) consider({ from: { x, y }, to: { x, y }, line: [], basin: lake, score: lake.length });
        }
      }
      if (!shallow(s, t)) continue;
      for (let d = 0; d < 8; d += 2) {
        const ddx = DIRS4[d];
        const ddy = DIRS4[d + 1];
        const end = (sgn: number): { x: number; y: number } | null => {
          for (let k = 1; k <= opts.line; k++) {
            const ex = x + ddx * k * sgn;
            const ey = y + ddy * k * sgn;
            if (ex < 1 || ey < 1 || ex >= w - 1 || ey >= h - 1) return null;
            const e = ey * w + ex;
            if (s.terrain[e] !== T_WATER) return s.terrain[e] === T_ROCK || s.bldAt[e] !== 0 ? null : { x: ex, y: ey };
            if (!shallow(s, e) || s.bldAt[e] !== 0) return null;
          }
          return null;
        };
        const a = end(-1);
        const b = a && end(1);
        if (!a || !b) continue;
        const key = `${a.x},${a.y},${b.x},${b.y}`;
        if (tried.has(key)) continue;
        tried.add(key);
        const tiles = walls(a.x, a.y, b.x, b.y);
        const line: number[] = [];
        let ok = true;
        for (const p of tiles) {
          const i = p.y * w + p.x;
          if (s.terrain[i] !== T_WATER) continue;
          if (!shallow(s, i) || s.bldAt[i] !== 0 || s.res[i] !== R_NONE) ok = false;
          line.push(i);
        }
        if (!ok || !line.length || line.length > opts.line + 2) continue;
        const banks = new Set(line);
        // Each side of the line on its own: the basin is the side that is not the sea.
        let done = false;
        for (const i of line) {
          if (done) break;
          const lx = i % w;
          const ly = (i - lx) / w;
          for (let q = 0; q < 8 && !done; q += 2) {
            const n = (ly + FOUR[q + 1]) * w + lx + FOUR[q];
            if (banks.has(n) || !wet(s, n) || lakes.has(n)) continue;
            const side = body(s, n, banks);
            if (!side || side.length < opts.least) continue;
            consider({ from: a, to: b, line, basin: side, score: side.length - opts.cost * line.length });
            done = true;
          }
        }
      }
    }
  return best;
}
