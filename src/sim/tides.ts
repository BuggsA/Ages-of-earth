import { AGES, AI_EBB, AI_GATE_ANSWER, BARRAGE, COCKLE, COCKLER, KEG, TIDE, TIDE_GATE, TIDE_ROUTE, TIDE_WORK, domainOf, secs } from './data';
import { ageDef, ageOf, asleep } from './ages';
import { distToRect, distToTile, stampBuilding, walkable } from './grid';
import { isChannel, isInund, isPolder, seaAt } from './water';
import { goalForPoint, isEnemy, passOf, statsOf } from './world';
import { hash2 } from './rng';
import { findPath } from './path';
import { kegsOf, sappers } from './powder';
import { peace } from './combat';
import type { BarragePlan, Building, GameState, Order, Unit } from './types';
import { B_TERRAIN, R_COCKLE, R_NONE, T_SAND, T_WATER } from './types';

/**
 * The tide (#739, s6 of the Water Road #701, the Age of Tides). Until the first people enters the age the sea stands still at high water,
 * as every map is drawn. From that tick (`GameState.tideFrom`) a public clock runs for everyone: every `TIDE.period` seconds the sea falls
 * through `TIDE.flats.length` levels to low water and rises back, one step at a time. The tidal ground (`GameState.tidal`) is laid out
 * once, when the tide wakes: the open sea (`seaAt`) whose shallowest corner lies at or above a level's depth. It is a layer of its own,
 * beside the polder and channels of `water.ts`: a tile the tide bares is wet sand (`T_SAND`, walked by anyone, sailed by no one), and
 * it is sea again when the water comes back, whoever stands on it swept ashore. Tiles a dyke, a polder, a channel, a building site or a
 * shoal of fish took over are left as they are. Causeways (`TIDE_CAUSEWAY`) are tidal ground the people of the age raise: bared at every
 * level but high water. Tide Mills grind gold each time the tide turns. Everything is integer ticks and tile order: online play, saves
 * and replays see the same tide.
 */

/** The `tidal` value of a causeway: tidal ground of the top level, drawn as a causeway. */
export const TIDE_CAUSEWAY = 255;

/** How many levels the tide falls through: high water is this, low water 0. */
export const TIDE_TOP = TIDE.flats.length;

/** Ticks in one step of the tide. */
const stepTicks = (): number => Math.max(1, Math.floor(secs(TIDE.period) / (2 * TIDE_TOP)));

/** The tide's step at a tick since it woke: 0 is high water, `TIDE_TOP` low water, back to `2 × TIDE_TOP − 1`. -1 before it wakes. */
function stepAt(s: GameState, tick: number): number {
  if (s.tideFrom === undefined || tick < s.tideFrom) return -1;
  return Math.floor((tick - s.tideFrom) / stepTicks()) % (2 * TIDE_TOP);
}

/** The level the sea stands at (high water `TIDE_TOP` before the tide wakes, low water 0). */
export function tideLevel(s: GameState, tick = s.tick): number {
  const j = stepAt(s, tick);
  if (j < 0) return TIDE_TOP;
  return j <= TIDE_TOP ? TIDE_TOP - j : j - TIDE_TOP;
}

/** The public tide clock (#739), for the HUD and the computer: where the sea stands, which way it goes, and when it next turns. */
export interface TideClock {
  level: number;
  /** Whether the water is coming in (after low water). */
  rising: boolean;
  /** Seconds to the next step. */
  next: number;
  /** Seconds to the next low and high water. */
  toLow: number;
  toHigh: number;
}

/** The tide clock, or null while the sea stands still (no people has yet entered the Age of Tides). */
export function tideClock(s: GameState): TideClock | null {
  const j = stepAt(s, s.tick);
  if (j < 0) return null;
  const st = stepTicks();
  const into = (s.tick - s.tideFrom!) % st;
  const next = (st - into) / secs(1);
  const n = 2 * TIDE_TOP;
  const until = (to: number) => (((to - j + n) % n) - 1) * (st / secs(1)) + next;
  return { level: tideLevel(s), rising: j >= TIDE_TOP, next, toLow: j === TIDE_TOP ? 0 : until(TIDE_TOP), toHigh: j === 0 ? 0 : until(0) };
}

/** Whether the tide has woken (#739). */
export const tideAwake = (s: GameState): boolean => s.tideFrom !== undefined && !!s.tidal;

/** The level below which this tile is bared (1 to `TIDE_TOP`), or 0 where the tide never reaches. */
export function tidalLevel(s: GameState, tile: number): number {
  const k = s.tidal ? s.tidal[tile] : 0;
  return k === TIDE_CAUSEWAY ? TIDE_TOP : k;
}

/** Whether this tile is tidal ground (a causeway too). */
export const isTidal = (s: GameState, tile: number): boolean => !!s.tidal && s.tidal[tile] !== 0;

/** Whether this tile is a causeway. */
export const isCauseway = (s: GameState, tile: number): boolean => !!s.tidal && s.tidal[tile] === TIDE_CAUSEWAY;

/** Whether the tide has bared this tile now: tidal ground standing out of the water as wet sand. */
export const bared = (s: GameState, tile: number): boolean => isTidal(s, tile) && s.terrain[tile] === T_SAND;

/** How deep a tile's bed lies: the mean of its corners. What decides how early the falling tide bares it. */
function bedDepth(s: GameState, tile: number): number {
  const x = tile % s.w;
  const y = (tile - x) / s.w;
  const W = s.w + 1;
  const i = y * W + x;
  const h = s.height;
  return (h[i] + h[i + 1] + h[i + W] + h[i + W + 1]) / 4;
}

/** The level of tidal ground a sea tile of this depth would be: the count of `TIDE.flats` depths at or below its bed. */
function levelFor(depth: number): number {
  let k = 0;
  for (const d of TIDE.flats) if (depth >= d) k++;
  return k;
}

/** Whether nothing on a tile keeps the tide off it: no building or site, no polder, channel or sluice's flood (#701 s4), no shoal. */
const free = (s: GameState, i: number): boolean => s.bldAt[i] === 0 && (s.res[i] === R_NONE || s.res[i] === R_COCKLE) && !isPolder(s, i) && !isChannel(s, i) && !isInund(s, i);

/**
 * Wake the tide (#739): lay out the tidal ground and start the clock at high water. Called once, the tick the first people stands in the
 * Age of Tides. The open sea only: a lake or a dyked-off basin has no tide.
 */
export function wakeTide(s: GameState): void {
  if (s.tideFrom !== undefined) return;
  const { w, h } = s;
  const tidal = new Uint8Array(w * h);
  const known = new Map<number, boolean>();
  for (let i = 0; i < w * h; i++) {
    if (s.terrain[i] !== T_WATER || !free(s, i)) continue;
    const k = levelFor(bedDepth(s, i));
    if (k > 0 && seaAt(s, i, known)) tidal[i] = k;
  }
  s.tidal = tidal;
  s.tideBed = Float32Array.from(s.height);
  layCockles(s);
  s.tideFrom = s.tick;
  s.tideTurns ??= 0;
  s.events.push({ k: 'tide', level: TIDE_TOP, rising: false, bared: 0, covered: 0 });
}

const DRY = Math.fround(TIDE.dry);

/** The four corners of a tile. */
function corners(s: GameState, tile: number): number[] {
  const x = tile % s.w;
  const y = (tile - x) / s.w;
  const W = s.w + 1;
  return [y * W + x, y * W + x + 1, (y + 1) * W + x, (y + 1) * W + x + 1];
}

/** Bare a tile: wet sand anyone walks and no ship sails, its corners raised just over the water line. */
function bare(s: GameState, tile: number): void {
  s.terrain[tile] = T_SAND;
  s.block[tile] &= ~B_TERRAIN;
  for (const c of corners(s, tile)) if (s.height[c] < DRY) s.height[c] = DRY;
}

/** Whether a corner touches a tile the tide has bared. */
function touchesBared(s: GameState, c: number): boolean {
  const W = s.w + 1;
  const cx = c % W;
  const cy = (c - cx) / W;
  for (let ty = cy - 1; ty <= cy; ty++)
    for (let tx = cx - 1; tx <= cx; tx++) if (tx >= 0 && ty >= 0 && tx < s.w && ty < s.h && bared(s, ty * s.w + tx)) return true;
  return false;
}

/** Cover a tile: sea again, and each corner the tide raised (and nothing has moved since) sinks back to its bed. */
function cover(s: GameState, tile: number): void {
  s.terrain[tile] = T_WATER;
  s.block[tile] |= B_TERRAIN;
  const bed = s.tideBed!;
  for (const c of corners(s, tile)) if (s.height[c] === DRY && bed[c] < DRY && !touchesBared(s, c)) s.height[c] = bed[c];
}

/** Set every tidal tile to the level the sea stands at, in tile order. Returns how many were bared and covered. */
function settle(s: GameState, level: number): { bared: number; covered: number; wet: Set<number> } {
  const t = s.tidal!;
  let nb = 0;
  const wet = new Set<number>();
  // A barrage's pond (#748) holds its water at every level.
  recountPonds(s);
  const pond = s.pond;
  // A Tide Gate's scour (#785) holds its flats under until it has run out.
  const held = scourHeld(s);
  for (let i = 0; i < t.length; i++) {
    if (t[i] === 0 || !free(s, i)) continue;
    const out = level < tidalLevel(s, i) && !(pond && pond[i]) && !(held && held.has(i));
    if (out && s.terrain[i] === T_WATER) {
      bare(s, i);
      nb++;
    } else if (!out && s.terrain[i] === T_SAND) {
      cover(s, i);
      wet.add(i);
    }
  }
  if (nb || wet.size) {
    s.blockVersion++;
    s.tideTurns = (s.tideTurns ?? 0) + nb + wet.size;
  }
  return { bared: nb, covered: wet.size, wet };
}

/** Whether a land unit stands in the tide: on tidal ground the water has covered, with no dyke under it. */
function caught(s: GameState, x: number, y: number): boolean {
  const i = Math.floor(y) * s.w + Math.floor(x);
  return i >= 0 && i < s.w * s.h && isTidal(s, i) && s.terrain[i] === T_WATER && s.bldAt[i] === 0;
}

/** The nearest tile within `TIDE.sweep` a unit is swept to: dry land above the tide first, else any ground still bare. -1: none. */
function shoreFor(s: GameState, x: number, y: number, team: number): number {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let best = -1;
  let bestD = Infinity;
  let any = -1;
  let anyD = Infinity;
  const r = TIDE.sweep;
  for (let ty = cy - r; ty <= cy + r; ty++)
    for (let tx = cx - r; tx <= cx + r; tx++) {
      if (!walkable(s, tx, ty, team)) continue;
      const dx = tx + 0.5 - x;
      const dy = ty + 0.5 - y;
      const d = dx * dx + dy * dy;
      if (d > r * r) continue;
      if (!isTidal(s, ty * s.w + tx) && d < bestD) {
        bestD = d;
        best = ty * s.w + tx;
      } else if (d < anyD) {
        anyD = d;
        any = ty * s.w + tx;
      }
    }
  return best >= 0 ? best : any;
}

/**
 * Sweep a land unit the tide caught to the shore, hurt, and send it on its way again from there (or drown it, with no shore near). A Tide
 * Gate's scour (#785) sweeps harder (`hurt`), and says whose gate it was (`by`).
 */
function sweep(s: GameState, u: Unit, hurt: number = TIDE.hurt, by?: number): void {
  const to = shoreFor(s, u.x, u.y, s.players[u.owner]?.team ?? -1);
  if (to < 0) {
    u.hp = 0;
    s.events.push({ k: 'tideSwept', id: u.id, owner: u.owner, x: u.x, y: u.y, drowned: true, ...(by !== undefined ? { by } : {}) });
    return;
  }
  u.x = (to % s.w) + 0.5;
  u.y = Math.floor(to / s.w) + 0.5;
  u.hp = Math.max(0, u.hp - hurt);
  u.path = null;
  if (u.goal) u.wantPath = true;
  s.events.push({ k: 'tideSwept', id: u.id, owner: u.owner, x: u.x, y: u.y, drowned: u.hp <= 0, ...(by !== undefined ? { by } : {}) });
}

// ---- Causeways ---------------------------------------------------------------------------------

/** Why a causeway can't go on this tile, or null where it can: open sea down to `TIDE.causeway` deep, or tidal ground. */
export function causewaySpot(s: GameState, tx: number, ty: number): 'deep' | 'dry' | null {
  const i = ty * s.w + tx;
  if (isCauseway(s, i)) return 'dry';
  if (isTidal(s, i)) return null;
  if (s.terrain[i] !== T_WATER || isChannel(s, i) || isInund(s, i)) return 'dry';
  if (bedDepth(s, i) < TIDE.causeway) return 'deep';
  return seaAt(s, i) ? null : 'dry';
}

/**
 * A finished causeway becomes tidal ground of the top level (#739), and the building is gone, as a dug ditch is: it is the sea's now, a
 * road anyone may walk at every level but high water. Checked every half second, in id order.
 */
function raiseCauseways(s: GameState): void {
  if (!s.tidal) return;
  let done: Building[] | null = null;
  for (const e of s.ents) if (e.kind === 'building' && e.type === 'causeway' && e.built && e.hp > 0) (done ??= []).push(e);
  if (!done) return;
  for (const b of done) {
    stampBuilding(s, b, false);
    s.byId.delete(b.id);
    const t = b.ty * s.w + b.tx;
    s.tidal[t] = TIDE_CAUSEWAY;
    (s.causewayBy ??= new Uint8Array(s.w * s.h))[t] = b.owner + 1;
    // The site held the water off; it is the tide's again, at the level it stands.
    if (s.terrain[t] !== T_WATER && s.terrain[t] !== T_SAND) s.terrain[t] = T_WATER;
    s.block[t] |= s.terrain[t] === T_WATER ? B_TERRAIN : 0;
    const p = s.players[b.owner];
    if (p) p.stats.causeways = (p.stats.causeways ?? 0) + 1;
    s.events.push({ k: 'causeway', owner: b.owner, tile: t, x: b.tx + 0.5, y: b.ty + 0.5 });
  }
  const gone = new Set(done.map((b) => b.id));
  s.ents = s.ents.filter((e) => !gone.has(e.id));
  s.blockVersion++;
  const was = s.pond;
  recountPonds(s, true);
  // A new pond fills at the next turn (#767): whoever's way runs over it works it out again.
  if (s.pond && s.pond !== was) rereadRoutes(s);
}

// ---- Tide Mills --------------------------------------------------------------------------------

/** Whether a Tide Mill grinds: finished, standing, and its people in the Age of Tides, or the mill it kept on leaving. */
export function grinds(s: GameState, b: Building): boolean {
  return b.type === 'tidemill' && b.built && b.hp > 0 && (!!ageDef(s.players[b.owner]).tides || b.keep === 'tides') && !asleep(s, b);
}

/** The tidal tiles within `TIDE.mill.reach` of a footprint, in tile order. */
export function tidalNear(s: GameState, b: { tx: number; ty: number; size: number }): number[] {
  const out: number[] = [];
  if (!s.tidal) return out;
  const r = TIDE.mill.reach;
  for (let y = Math.max(0, b.ty - r); y < Math.min(s.h, b.ty + b.size + r); y++)
    for (let x = Math.max(0, b.tx - r); x < Math.min(s.w, b.tx + b.size + r); x++) if (s.tidal[y * s.w + x] !== 0) out.push(y * s.w + x);
  return out;
}

/**
 * What each working Tide Mill grinds on a turn of the tide (#739): `TIDE.mill.gold` with `TIDE.mill.most` tiles of tidal ground near it,
 * less with fewer. Each tile feeds the first mill (in id order) that reaches it, so two mills on one bay share it.
 */
export function millShares(s: GameState): Map<number, number> {
  const out = new Map<number, number>();
  const taken = new Set<number>();
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'tidemill' || !grinds(s, e)) continue;
    let n = 0;
    let ponded = 0;
    // A barrage's pond (#748) is ground first, and `BARRAGE.mill` times over: on the flood and on the ebb.
    const near = tidalNear(s, e);
    for (const inPond of [true, false])
      for (const t of near) {
        if (n >= TIDE.mill.most) break;
        if (inPond !== isPond(s, t) || taken.has(t)) continue;
        taken.add(t);
        n++;
        if (inPond) ponded++;
      }
    out.set(e.id, (TIDE.mill.gold * (n + (BARRAGE.mill - 1) * ponded)) / TIDE.mill.most);
  }
  return out;
}

/** Why a finished Tide Mill stands idle, or null while it grinds. */
export function tideMillIdle(s: GameState, b: Building): string | null {
  if (!ageDef(s.players[b.owner]).tides && b.keep !== 'tides') return 'Tide Mills grind only in the Age of Tides, or the one your people kept on leaving it';
  if (!tidalNear(s, b).length) return 'No tidal ground within reach: raise it by shallow sea, or lay causeways near it';
  return null;
}

// ---- Harbours aground --------------------------------------------------------------------------

/**
 * Whether a Dock is aground (#739): the tide has bared all the water within `TIDE.harbour` tiles of it, so it launches nothing until the
 * water comes back. The shore's own band bares early; a harbour grounds as the tide runs low, not at every ebb.
 */
export function aground(s: GameState, b: Building): boolean {
  if (b.type !== 'dock' || !s.tidal) return false;
  let tidal = false;
  const r = TIDE.harbour;
  for (let y = b.ty - r; y < b.ty + b.size + r; y++)
    for (let x = b.tx - r; x < b.tx + b.size + r; x++) {
      if (x < 0 || y < 0 || x >= s.w || y >= s.h || (x >= b.tx && x < b.tx + b.size && y >= b.ty && y < b.ty + b.size)) continue;
      const i = y * s.w + x;
      if (s.terrain[i] === T_WATER && s.block[i] & B_TERRAIN) return false;
      if (isTidal(s, i)) tidal = true;
    }
  return tidal;
}

// ---- The step ----------------------------------------------------------------------------------

/**
 * The tide each tick (#739). Wakes it the tick the first people stands in the Age of Tides; on each step of the clock bares or covers the
 * tidal ground, sweeps whoever the water caught, and lets every working Tide Mill grind. Every quarter second it also sweeps a land unit
 * that walked into the tide since (on a route laid while the flats were bare), and every half second raises finished causeways.
 */
export function tideStep(s: GameState): void {
  if (s.tideFrom === undefined) {
    if (s.tick % 10 !== 0) return;
    if (!s.players.some((p) => AGES[ageOf(p)].tides)) return;
    wakeTide(s);
  }
  if (!s.tidal) return;
  if (s.tick % 10 === 0) raiseCauseways(s);
  // A Tide Gate's scour (#785) runs out.
  if (s.scour) endScours(s);
  const level = tideLevel(s);
  const turned = s.tick === s.tideFrom || tideLevel(s, s.tick - 1) !== level;
  if (turned) {
    const { bared: nb, covered, wet } = settle(s, level);
    if (s.tick !== s.tideFrom) {
      s.events.push({ k: 'tide', level, rising: level > tideLevel(s, s.tick - 1), bared: nb, covered });
      if (level === TIDE_TOP) regrowCockles(s);
      for (const [id, gold] of millShares(s)) {
        if (gold <= 0) continue;
        const b = s.byId.get(id) as Building;
        const p = s.players[b.owner];
        p.res.gold += gold;
        p.stats.milled = (p.stats.milled ?? 0) + gold;
        b.milled = s.tick;
        s.events.push({ k: 'milled', id, owner: b.owner, gold, x: b.x, y: b.y });
      }
    }
    if (wet.size) for (const u of s.ents) if (u.kind === 'unit' && u.hp > 0 && !u.inside && domainOf(u.type) === 'land' && wet.has(Math.floor(u.y) * s.w + Math.floor(u.x))) sweep(s, u);
    if (wet.size) drownKegs(s, wet);
    if (s.tick !== s.tideFrom) rereadRoutes(s);
  } else if (s.tick % 5 === 0) {
    for (const u of s.ents) if (u.kind === 'unit' && u.hp > 0 && !u.inside && domainOf(u.type) === 'land' && caught(s, u.x, u.y)) sweep(s, u);
  }
}

// ---- For the computer --------------------------------------------------------------------------

/**
 * The best spot for a Tide Mill within `reach` of a point (#739): where it would reach the most tidal ground no standing mill reaches
 * yet, at least `least` tiles; ties go to the nearer, then the first in tile order. Null when there is none.
 */
export function tideMillSpot(s: GameState, owner: number, cx: number, cy: number, reach: number, least: number, fits: (tx: number, ty: number) => boolean): { tx: number; ty: number } | null {
  if (!s.tidal) return null;
  const claimed = new Set<number>();
  for (const e of s.ents) if (e.kind === 'building' && e.type === 'tidemill' && e.hp > 0) for (const t of tidalNear(s, e)) claimed.add(t);
  let best: { tx: number; ty: number } | null = null;
  let top = least - 1;
  let bestD = Infinity;
  for (let ty = Math.max(1, Math.floor(cy - reach)); ty <= Math.min(s.h - 3, Math.floor(cy + reach)); ty++)
    for (let tx = Math.max(1, Math.floor(cx - reach)); tx <= Math.min(s.w - 3, Math.floor(cx + reach)); tx++) {
      const dx = tx + 1 - cx;
      const dy = ty + 1 - cy;
      const d = dx * dx + dy * dy;
      if (d > reach * reach) continue;
      // Cheap first: a mill stands on the shore, so tidal ground must lie beside it.
      let shore = false;
      for (let y = ty - 1; y <= ty + 2 && !shore; y++) for (let x = tx - 1; x <= tx + 2; x++) if (x >= 0 && y >= 0 && x < s.w && y < s.h && s.tidal[y * s.w + x] !== 0) shore = true;
      if (!shore || !fits(tx, ty)) continue;
      let n = 0;
      for (const t of tidalNear(s, { tx, ty, size: 2 })) if (!claimed.has(t)) n++;
      n = Math.min(n, TIDE.mill.most);
      if (n > top || (n === top && d < bestD)) {
        top = n;
        bestD = d;
        best = { tx, ty };
      }
    }
  void owner;
  return best;
}

/**
 * The tiles of tidal ground the water will cover at the next step of the tide (#739), or none while it falls or stands at high water: what
 * the computer clears its people off before the flood.
 */
export function coveredNext(s: GameState): ((tile: number) => boolean) | null {
  const c = tideClock(s);
  if (!c) return null;
  const now = c.level;
  const next = tideLevel(s, s.tick + Math.ceil(c.next * secs(1)));
  // A barrage's pond (#748) fills at the next turn whichever way the tide runs: its bared flats go under too.
  if (next <= now) return s.pond ? (tile: number) => bared(s, tile) && isPond(s, tile) : null;
  return (tile: number) => bared(s, tile) && (tidalLevel(s, tile) <= next || isPond(s, tile));
}

/** Where to step to off the flats before the flood: dry ground above the tide within `TIDE.sweep`, as the sea would sweep it (-1: none). */
export const shoreNear = (s: GameState, x: number, y: number, team: number): number => shoreFor(s, x, y, team);

// ---- Barrages (#748) ---------------------------------------------------------------------------

/** Whether this tile is tidal ground in a barrage's pond (#748): it stays wet, and the mills grind it twice. */
export const isPond = (s: GameState, tile: number): boolean => !!s.pond && s.pond[tile] === 1;

/** Who raised this causeway tile (#748), or -1. */
export const causewayOwner = (s: GameState, tile: number): number => (s.causewayBy ? s.causewayBy[tile] - 1 : -1);

/** Whether a tile is still water to a pond's body: water or tidal ground, but no causeway, no finished building, polder, channel or flood. */
function holdsWater(s: GameState, i: number): boolean {
  const t = s.tidal![i];
  if (t === TIDE_CAUSEWAY) return false;
  if (t === 0 && s.terrain[i] !== T_WATER) return false;
  if (s.bldAt[i] !== 0) {
    const b = s.byId.get(s.bldAt[i]);
    if (b && b.kind === 'building' && b.built) return false;
  }
  return !isPolder(s, i) && !isChannel(s, i) && !isInund(s, i);
}

const FOUR = [1, 0, -1, 0, 0, 1, 0, -1];
const WAYS4 = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/**
 * The ponds behind the barrages (#748): every body of water and tidal ground (four ways, not through causeways or finished buildings)
 * that touches no map edge, holds no more than `BARRAGE.most` tiles and borders a causeway; its tidal tiles are the pond. Each tile is
 * looked at once, in tile order, so a step asks it cheaply.
 */
export function pondsOf(s: GameState): Uint8Array {
  const { w, h } = s;
  const out = new Uint8Array(w * h);
  if (!s.tidal) return out;
  const seen = new Uint8Array(w * h);
  const body: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || !holdsWater(s, start)) continue;
    body.length = 0;
    body.push(start);
    seen[start] = 1;
    let open = false;
    let dam = false;
    let tidal = false;
    for (let q = 0; q < body.length; q++) {
      const i = body[q];
      const x = i % w;
      const y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) open = true;
      if (s.tidal[i] !== 0) tidal = true;
      for (let d = 0; d < 8; d += 2) {
        const nx = x + FOUR[d];
        const ny = y + FOUR[d + 1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (s.tidal[n] === TIDE_CAUSEWAY) dam = true;
        if (seen[n] || !holdsWater(s, n)) continue;
        seen[n] = 1;
        body.push(n);
      }
    }
    if (open || !dam || !tidal || body.length > BARRAGE.most) continue;
    for (const i of body) if (s.tidal[i] !== 0) out[i] = 1;
  }
  return out;
}

/** Count the ponds again (#748). `tell`: say so of a pond that has just been shut off (one event a pond, by whoever's causeway borders it). */
function recountPonds(s: GameState, tell = false): void {
  if (!s.tidal) return;
  const was = s.pond;
  const now = pondsOf(s);
  // Tide Gates (#785): a pond let out runs with the tide until the flood fills it again behind a shut gate.
  letOut(s, now);
  let any = false;
  let moved = 0;
  for (let i = 0; i < now.length; i++) {
    if (now[i]) any = true;
    if (now[i] !== (was ? was[i] : 0)) moved++;
  }
  if (any) s.pond = now;
  else delete s.pond;
  // The renderer redraws the shore when this moves.
  if (moved) s.tideTurns = (s.tideTurns ?? 0) + moved;
  if (!tell) return;
  // Each new stretch of pond, told once: its first tile in tile order, and the owner of a causeway beside the pond.
  const told = new Uint8Array(now.length);
  for (let i = 0; i < now.length; i++) {
    if (!now[i] || told[i] || (was && was[i])) continue;
    const tiles: number[] = [i];
    told[i] = 1;
    let owner = -1;
    for (let q = 0; q < tiles.length; q++) {
      const j = tiles[q];
      const x = j % s.w;
      const y = (j - x) / s.w;
      for (let d = 0; d < 8; d += 2) {
        const nx = x + FOUR[d];
        const ny = y + FOUR[d + 1];
        if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) continue;
        const n = ny * s.w + nx;
        if (owner < 0 && s.tidal[n] === TIDE_CAUSEWAY) owner = causewayOwner(s, n);
        if (now[n] && !told[n]) {
          told[n] = 1;
          tiles.push(n);
        }
      }
    }
    s.events.push({ k: 'pond', owner, tiles: tiles.length, x: (i % s.w) + 0.5, y: Math.floor(i / s.w) + 0.5 });
  }
}

/** Powder kegs lying on tiles the water has just covered (#748): the fuse drowns, and the keg is lost. */
function drownKegs(s: GameState, wet: Set<number>): void {
  if (!s.kegs) return;
  const left = s.kegs.filter((k) => {
    if (!wet.has(Math.floor(k.y) * s.w + Math.floor(k.x))) return true;
    s.events.push({ k: 'keg', owner: k.owner, x: k.x, y: k.y, what: 'drowned' });
    return false;
  });
  if (left.length) s.kegs = left;
  else delete s.kegs;
}

/** The level of tidal ground a tile was before anything was laid on it: from its bed as the tide found it (0: open sea). */
function bedLevel(s: GameState, tile: number): number {
  const bed = s.tideBed;
  if (!bed) return levelFor(bedDepth(s, tile));
  let sum = 0;
  for (const c of corners(s, tile)) sum += bed[c];
  return levelFor(sum / 4);
}

/**
 * A blast breaches the causeways round it (#748): every rival causeway tile whose middle lies within `r` of the point sinks back to the
 * tidal ground (or open sea) it was laid on, at the level the sea stands; whoever stands on one the water now covers is swept, and a
 * pond it held drains at the next turn of the tide. Called by a keg's blast and a warhead's. Returns how many tiles were breached.
 */
export function breachAt(s: GameState, x: number, y: number, r: number, by: number): number {
  if (!s.tidal) return 0;
  const level = tideLevel(s);
  const wet = new Set<number>();
  let n = 0;
  for (let ty = Math.max(0, Math.floor(y - r)); ty <= Math.min(s.h - 1, Math.floor(y + r)); ty++)
    for (let tx = Math.max(0, Math.floor(x - r)); tx <= Math.min(s.w - 1, Math.floor(x + r)); tx++) {
      const t = ty * s.w + tx;
      if (s.tidal[t] !== TIDE_CAUSEWAY) continue;
      const dx = tx + 0.5 - x;
      const dy = ty + 0.5 - y;
      // A Tide Gate stands over its whole tile (#792): a blast that reaches any of it reaches the road under it. A keg is laid by the gate.
      const on = s.bldAt[t] ? s.byId.get(s.bldAt[t]) : undefined;
      const gated = !!on && on.kind === 'building' && on.type === 'tidegate';
      if (gated ? distToTile(x, y, t, s.w) > r : dx * dx + dy * dy > r * r) continue;
      const owner = causewayOwner(s, t);
      if (owner >= 0 && !isEnemy(s, by, owner)) continue;
      let ponded = false;
      for (let d = 0; d < 8; d += 2) {
        const nx = tx + FOUR[d];
        const ny = ty + FOUR[d + 1];
        if (nx >= 0 && ny >= 0 && nx < s.w && ny < s.h && isPond(s, ny * s.w + nx)) ponded = true;
      }
      s.tidal[t] = bedLevel(s, t);
      if (s.causewayBy) s.causewayBy[t] = 0;
      // A Tide Gate set in it (#785) goes with the road under it.
      const g = s.bldAt[t] ? s.byId.get(s.bldAt[t]) : undefined;
      if (g && g.kind === 'building' && g.type === 'tidegate') g.hp = 0;
      const k = s.tidal[t];
      if (k > 0 && level < k && !isPond(s, t)) {
        if (s.terrain[t] !== T_SAND) bare(s, t);
      } else if (s.terrain[t] === T_SAND || !(s.block[t] & B_TERRAIN)) {
        cover(s, t);
        wet.add(t);
      }
      n++;
      s.events.push({ k: 'breached', owner, by, tile: t, x: tx + 0.5, y: ty + 0.5, pond: ponded });
    }
  if (!n) return 0;
  s.blockVersion++;
  s.tideTurns = (s.tideTurns ?? 0) + n;
  const p = s.players[by];
  if (p) p.stats.breached = (p.stats.breached ?? 0) + n;
  if (wet.size) {
    for (const u of s.ents) if (u.kind === 'unit' && u.hp > 0 && !u.inside && domainOf(u.type) === 'land' && wet.has(Math.floor(u.y) * s.w + Math.floor(u.x))) sweep(s, u);
    drownKegs(s, wet);
  }
  recountPonds(s);
  return n;
}

/** Why a people can't carry a keg to this tile (#748), or null: it must be a rival's causeway, and the people a Sapper's with kegs in store. */
export function kegTileProblem(s: GameState, owner: number, tile: number): string | null {
  const p = s.players[owner];
  if (!sappers(p)) return 'Only a people of the Age of Sappers lays powder kegs';
  if (kegsOf(p) < 1) return 'No kegs in store: they are ground at the mills in the Age of Alchemy';
  if (peace(s)) return 'Not while the peace holds';
  if (tile < 0 || tile >= s.w * s.h || !isCauseway(s, tile)) return 'Pick a rival building, or a rival causeway';
  const by = causewayOwner(s, tile);
  if (by >= 0 && !isEnemy(s, owner, by)) return 'That causeway is your own side\'s';
  return null;
}

/** Whether a carrier stands close enough to a causeway tile to lay its keg on it (#748). */
export const atTile = (s: GameState, u: Unit, tile: number, radius: number): boolean => distToTile(u.x, u.y, tile, s.w) - radius <= KEG.lay;

/**
 * The barrage the computer would lay by a Tide Mill (#748): every tile within `reach` of the mill a causeway may go on is tried as the
 * middle of a straight line (four ways) running to land or a causeway on both sides, `line` tiles at most in all, every tile of it fit
 * for a causeway; the line (as `walls` lays it) must shut off a body of tidal ground as `pondsOf` judges it, and `least` of that ground within
 * a mill's reach of `mill`. Scored by those tiles less `cost` for each tile of line; ties go to the first found, in tile order.
 */
export function barragePlan(
  s: GameState,
  mill: { tx: number; ty: number; size: number },
  opts: { reach: number; line: number; least: number; cost: number },
  walls: (x0: number, y0: number, x1: number, y1: number) => { x: number; y: number }[],
): BarragePlan | null {
  if (!s.tidal) return null;
  const { w, h } = s;
  const near = new Set(tidalNear(s, mill));
  const cx = mill.tx + mill.size / 2;
  const cy = mill.ty + mill.size / 2;
  const r = opts.reach;
  const fit = (i: number) => s.bldAt[i] === 0 && s.res[i] === R_NONE && causewaySpot(s, i % w, Math.floor(i / w)) === null;
  // A shore end: land a causeway runs up onto (no rock, no building), or a causeway already laid.
  const bank = (i: number) => isCauseway(s, i) || (s.terrain[i] !== T_WATER && !isTidal(s, i) && s.bldAt[i] === 0 && walkable(s, i % w, Math.floor(i / w), -1));
  let best: BarragePlan | null = null;
  let bestScore = -Infinity;
  const tried = new Set<number>();
  const before = s.tidal;
  for (let y = Math.max(1, Math.floor(cy - r)); y <= Math.min(h - 2, Math.floor(cy + r)); y++)
    for (let x = Math.max(1, Math.floor(cx - r)); x <= Math.min(w - 2, Math.floor(cx + r)); x++) {
      const dx0 = x + 0.5 - cx;
      const dy0 = y + 0.5 - cy;
      if (dx0 * dx0 + dy0 * dy0 > r * r || !fit(y * w + x)) continue;
      // The four ways: along x, along y, and the two diagonals.
      for (const way of WAYS4) {
        const end = (sgn: number): { x: number; y: number } | null => {
          for (let k = 1; k <= opts.line; k++) {
            const ex = x + way[0] * k * sgn;
            const ey = y + way[1] * k * sgn;
            if (ex < 1 || ey < 1 || ex >= w - 1 || ey >= h - 1) return null;
            const e = ey * w + ex;
            if (bank(e)) return { x: ex, y: ey };
            if (!fit(e)) return null;
          }
          return null;
        };
        const a = end(-1);
        const b = a && end(1);
        if (!a || !b) continue;
        const key = ((a.y * w + a.x) * w + b.x) * h + b.y;
        if (tried.has(key)) continue;
        tried.add(key);
        const line: number[] = [];
        let ok = true;
        for (const p of walls(a.x, a.y, b.x, b.y)) {
          const i = p.y * w + p.x;
          if (bank(i)) continue;
          if (!fit(i)) ok = false;
          line.push(i);
        }
        if (!ok || !line.length || line.length > opts.line) continue;
        // Try the line as laid: the ponds it would make, and how much of them a mill here would grind.
        const trial = before.slice();
        for (const i of line) trial[i] = TIDE_CAUSEWAY;
        s.tidal = trial;
        const ponds = pondsOf(s);
        s.tidal = before;
        let pond = 0;
        for (const t of near) if (ponds[t] && !isPond(s, t)) pond++;
        if (pond < opts.least) continue;
        const score = pond - opts.cost * line.length;
        if (score > bestScore) {
          bestScore = score;
          best = { from: a, to: b, line, pond };
        }
      }
    }
  return best;
}

/**
 * The march across the flats (#748), for the computer: where a straight line from `from` to `to` crosses tidal ground with no open sea on
 * it, each tidal tile on it (how far along the line, and the level that covers it), the lowest level among them, and the far shore past
 * the last. Null where it crosses open sea or a pond, or no tidal ground.
 */
export function flatsCrossing(s: GameState, from: { x: number; y: number }, to: { x: number; y: number }): { tiles: number; level: number; flats: { d: number; level: number }[]; far: { x: number; y: number } } | null {
  if (!s.tidal) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;
  const steps = Math.ceil(len * 2);
  let last = -1;
  let level = TIDE_TOP;
  let lastAt = -1;
  const flats: { d: number; level: number }[] = [];
  for (let k = 0; k <= steps; k++) {
    const x = from.x + (dx * k) / steps;
    const y = from.y + (dy * k) / steps;
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= s.w || ty >= s.h) continue;
    const i = ty * s.w + tx;
    if (i === last) continue;
    last = i;
    if (isTidal(s, i)) {
      if (isPond(s, i)) return null;
      const k2 = tidalLevel(s, i);
      flats.push({ d: (len * k) / steps, level: k2 });
      level = Math.min(level, k2);
      lastAt = k;
    } else if (s.terrain[i] === T_WATER && s.bldAt[i] === 0) return null;
  }
  if (!flats.length) return null;
  return { tiles: flats.length, level, flats, far: { x: from.x + (dx * (lastAt + 2)) / steps, y: from.y + (dy * (lastAt + 2)) / steps } };
}

/** Whether the sea stands below `level` (the flats of that level bare) through every tick from `t0` to `t1` (#748). The clock is public. */
export function bareThrough(s: GameState, level: number, t0: number, t1: number): boolean {
  if (s.tideFrom === undefined) return false;
  const st = stepTicks();
  for (let t = t0; t < t1; t += st) if (tideLevel(s, t) >= level) return false;
  return tideLevel(s, t1) < level;
}

/**
 * The low-water strike (#748): whether a march from `from` to `to` at `pace` tiles a second should set out now. Null where the tide is
 * nothing to it: it crosses fewer than `AI_EBB.across` tiles of tidal ground (or open sea), or no start within `AI_EBB.hold` seconds would
 * find its flats bare. Otherwise `go` says whether, setting out now, it would find each tile of flats bare as it reaches it, with
 * `AI_EBB.margin` seconds to spare; `level` (the lowest of them) and `far` are the crossing's, for turning back short of it.
 */
export function ebbTiming(s: GameState, from: { x: number; y: number }, to: { x: number; y: number }, pace: number): { go: boolean; level: number; far: { x: number; y: number } } | null {
  const c = flatsCrossing(s, from, to);
  if (!c || c.tiles < AI_EBB.across || pace <= 0) return null;
  const per = secs(AI_EBB.slack / pace + AI_EBB.margin);
  const fits = (start: number) => c.flats.every((f) => {
    const at = start + Math.ceil(secs((f.d * AI_EBB.slack) / pace));
    return bareThrough(s, f.level, at, at + per);
  });
  if (fits(s.tick)) return { go: true, level: c.level, far: c.far };
  for (let t = s.tick + secs(1); t <= s.tick + secs(AI_EBB.hold); t += secs(1)) if (fits(t)) return { go: false, level: c.level, far: c.far };
  return null;
}

// ---- Routes that read the tide (#755) ----------------------------------------------------------

/** A tidal tile on a route: how far along it lies, and the tile. */
interface Flat {
  d: number;
  tile: number;
}

/**
 * How a route crosses the tide (#755): walking from `x, y` through the waypoints `pts` (from point `from` on), each tidal tile it steps
 * onto (bared now, so walkable, with no building on it) and how far along; the first of them the water would cover before it is past
 * (`doom`, -1: none) when it sets out at tick `t0` at `pace` tiles a second; and the middle of the last dry tile before that one (`stop`,
 * with `n`, the waypoints before it), where it can wait for the tide. The tile it stands on now it can't help, so it is never doomed.
 */
function passage(
  s: GameState,
  x: number,
  y: number,
  pts: readonly number[],
  from: number,
  pace: number,
  t0: number,
  risk: ((tile: number) => boolean) | null = null,
): { flats: Flat[]; doom: number; stop: { x: number; y: number; d: number; n: number } | null; length: number } {
  const w = s.w;
  const here = Math.floor(y) * w + Math.floor(x);
  const flats: Flat[] = [];
  let doom = -1;
  let stop: { x: number; y: number; d: number; n: number } | null = here >= 0 && here < w * s.h && !isTidal(s, here) ? { x, y, d: 0, n: 0 } : null;
  let last = here;
  let d = 0;
  let ax = x;
  let ay = y;
  for (let k = from; k * 2 < pts.length; k++) {
    const bx = pts[k * 2];
    const by = pts[k * 2 + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.sqrt(dx * dx + dy * dy);
    const n = Math.max(1, Math.ceil(len * 4));
    for (let j = 1; j <= n; j++) {
      const px = ax + (dx * j) / n;
      const py = ay + (dy * j) / n;
      const tx = Math.floor(px);
      const ty = Math.floor(py);
      if (tx < 0 || ty < 0 || tx >= w || ty >= s.h) continue;
      const i = ty * w + tx;
      if (i === last) continue;
      last = i;
      const at = d + (len * j) / n;
      if (isTidal(s, i) && s.bldAt[i] === 0 && s.terrain[i] !== T_WATER) {
        flats.push({ d: at, tile: i });
        if (doom < 0 && (!safeOver(s, i, t0, at, pace) || (risk && risk(i)))) doom = at;
      } else if (doom < 0 && !isTidal(s, i)) stop = { x: tx + 0.5, y: ty + 0.5, d: at, n: k };
    }
    d += len;
    ax = bx;
    ay = by;
  }
  return { flats, doom, stop, length: d };
}

/** Whether a tidal tile `at` tiles along a walk setting out at `t0`, at `pace`, is bare from then until `TIDE_ROUTE.margin` seconds after it's crossed. */
function safeOver(s: GameState, tile: number, t0: number, at: number, pace: number): boolean {
  if (isPond(s, tile)) return false;
  const a = t0 + Math.ceil(secs(at / pace));
  return bareThrough(s, tidalLevel(s, tile), a, a + Math.ceil(secs(1.5 / pace + TIDE_ROUTE.margin)));
}

/** The pace a land unit's route is timed at (#755): its speed, less `TIDE_ROUTE.slack`. */
const routePace = (s: GameState, u: Unit): number => statsOf(s, u).speed / TIDE_ROUTE.slack;

/**
 * The first tick from `t` (on, at most `TIDE_ROUTE.hold` seconds) a walk from `stop` can set out and find every tidal tile beyond it bare
 * from that moment until it has crossed it (#755), so the way it was laid is open the whole time. -1: none.
 */
function ebbFrom(s: GameState, flats: Flat[], stop: number, pace: number, t: number, until: number, risk: ((tile: number) => boolean) | null = null): number {
  const ahead = flats.filter((f) => f.d > stop);
  // Below a rival's loaded Tide Gate (#785) no hour is safe.
  if (risk && ahead.some((f) => risk(f.tile))) return -1;
  for (let at = t; at <= until; at += secs(1)) {
    let ok = true;
    for (const f of ahead) {
      if (isPond(s, f.tile) || !bareThrough(s, tidalLevel(s, f.tile), at, at + Math.ceil(secs((f.d - stop + 1.5) / pace + TIDE_ROUTE.margin)))) {
        ok = false;
        break;
      }
    }
    if (ok) return at;
  }
  return -1;
}

/**
 * Read the tide into a land unit's new route (#755), called as `routeUnits` lays it. A route that finds every tidal tile on it bare as it
 * gets there stands. One the water would cover first goes round, by a path the tide lets it walk, or walks to the last dry ground before
 * the flats and waits there (`Unit.tideWait`) for the first moment it can cross, whichever reaches the goal sooner; with neither (no way
 * round, and no crossing within `TIDE_ROUTE.hold` seconds) it goes as ordered. Every rule reads only the tick and the state, so online
 * play sees the same choice. Returns the route budget it spent.
 */
export function tideRoute(s: GameState, u: Unit, team: number, budget: number): number {
  if (!u.path || !u.goal || !tideAwake(s) || domainOf(u.type) !== 'land') return 0;
  const pace = routePace(s, u);
  if (pace <= 0) return 0;
  const t0 = s.tick;
  // The flats below a rival's loaded Tide Gate (#785) count as unsafe at every hour.
  const risk = gateRisk(s, u.owner);
  const p = passage(s, u.x, u.y, u.path, 0, pace, t0, risk);
  if (p.doom < 0) return 0;
  let cost = 0;
  // Round: a path that turns down every tidal tile the water would cover before the unit is past it.
  let round: { pts: number[]; time: number } | null = null;
  const limit = Math.min(12000, Math.max(800, budget));
  const r = findPath(s, u.x, u.y, u.goal, limit, team, (i, g) => isTidal(s, i) && s.bldAt[i] === 0 && (!safeOver(s, i, t0, g, pace) || (!!risk && risk(i))));
  cost += r.cost;
  if (r.complete && r.points.length) {
    const q = passage(s, u.x, u.y, r.points, 0, pace, t0, risk);
    if (q.doom < 0) round = { pts: r.points, time: q.length / pace };
  }
  // Wait: on the last dry ground before the flats, for the first moment the whole crossing stays bare.
  let wait: { at: number; time: number } | null = null;
  if (p.stop) {
    const reach = t0 + Math.ceil(secs(p.stop.d / pace));
    const at = ebbFrom(s, p.flats, p.stop.d, pace, reach, t0 + secs(TIDE_ROUTE.hold), risk);
    if (at >= 0) wait = { at, time: (at - t0) / secs(1) + (p.length - p.stop.d) / pace };
  }
  if (round && (!wait || round.time <= wait.time)) {
    u.path = round.pts;
    u.pathI = 0;
    return cost;
  }
  if (wait && p.stop) {
    const pts = u.path.slice(0, p.stop.n * 2);
    pts.push(p.stop.x, p.stop.y);
    u.path = pts;
    u.pathI = 0;
    u.wantPath = true;
    u.tideWait = wait.at;
    s.events.push({ k: 'tideHold', id: u.id, owner: u.owner, x: p.stop.x, y: p.stop.y, until: wait.at });
  }
  return cost;
}

/**
 * At each turn of the tide (#755): a land unit already on its way whose route ahead the water would now cover before it is past (held up
 * on the way, or laid before the turn) works it out again, to go round or wait.
 */
function rereadRoutes(s: GameState): void {
  for (const u of s.ents) {
    if (u.kind !== 'unit' || u.hp <= 0 || u.inside || !u.path || u.wantPath || !u.goal || domainOf(u.type) !== 'land') continue;
    const pace = routePace(s, u);
    if (pace <= 0) continue;
    if (passage(s, u.x, u.y, u.path, u.pathI, pace, s.tick, gateRisk(s, u.owner)).doom >= 0) u.wantPath = true;
  }
}

/** Whether a unit is waiting on the shore for the tide (#755), and for how many seconds more (0: not waiting). */
export function tideWaitLeft(s: GameState, u: Unit): number {
  return u.tideWait !== undefined && u.wantPath && u.tideWait > s.tick ? (u.tideWait - s.tick) / secs(1) : 0;
}

// ---- Cockle beds, and work on the flats that reads the tide (#767) ------------------------------

const FOUR_OF = (s: GameState, i: number): number[] => {
  const x = i % s.w;
  const y = (i - x) / s.w;
  const out: number[] = [];
  for (let d = 0; d < 8; d += 2) {
    const nx = x + FOUR[d];
    const ny = y + FOUR[d + 1];
    if (nx >= 0 && ny >= 0 && nx < s.w && ny < s.h) out.push(ny * s.w + nx);
  }
  return out;
};

/**
 * Lay the cockle beds (#767), once, as the tide wakes: round each tile of the deeper flats (level `COCKLE.deep` or lower) the map's seed
 * picks, one in `COCKLE.chance`, a patch of beds on it and on the ground as deep beside it four ways. In tile order, from the seed alone.
 */
function layCockles(s: GameState): void {
  const t = s.tidal!;
  const n = s.w * s.h;
  const open = (i: number) => t[i] !== 0 && t[i] !== TIDE_CAUSEWAY && t[i] <= COCKLE.deep && s.res[i] === R_NONE && s.bldAt[i] === 0;
  let beds: Uint8Array | null = null;
  for (let i = 0; i < n; i++) {
    if (!open(i)) continue;
    const x = i % s.w;
    if (hash2(x, (i - x) / s.w, s.seed + 767) >= COCKLE.chance) continue;
    for (const j of [i, ...FOUR_OF(s, i)]) {
      if (!open(j)) continue;
      (beds ??= new Uint8Array(n))[j] = 1;
      s.res[j] = R_COCKLE;
      s.amount[j] = COCKLE.amount;
    }
  }
  if (beds) s.cockles = beds;
}

/** Whether a cockle bed lies open to the sea (#767): no site or building on it, no causeway over it, not shut in a barrage's pond. */
export const bedOpen = (s: GameState, tile: number): boolean =>
  !!s.cockles && s.cockles[tile] === 1 && !!s.tidal && s.tidal[tile] !== 0 && s.tidal[tile] !== TIDE_CAUSEWAY && s.bldAt[tile] === 0 && !isPond(s, tile) && (s.res[tile] === R_NONE || s.res[tile] === R_COCKLE);

/** High water brings the cockles back (#767): each open bed, picked out or not, gains `COCKLE.regrow` (`COCKLER.regrow` by a hut, #779), up to `COCKLE.amount`. */
function regrowCockles(s: GameState): void {
  const beds = s.cockles;
  if (!beds) return;
  const tended = tendedBeds(s);
  let n = 0;
  let food = 0;
  for (let i = 0; i < beds.length; i++) {
    if (!beds[i] || !bedOpen(s, i)) continue;
    const was = s.res[i] === R_COCKLE ? s.amount[i] : 0;
    const now = Math.min(COCKLE.amount, was + (tended?.[i] ? COCKLER.regrow : COCKLE.regrow));
    if (now <= was) continue;
    s.res[i] = R_COCKLE;
    s.amount[i] = now;
    n++;
    food += now - was;
  }
  if (n) s.events.push({ k: 'cockles', beds: n, food });
}

/** The first tick from `t` on that the sea stands below `level`, so ground of that level is bare (#767); -1 where it never is. */
export function baresAt(s: GameState, level: number, t: number): number {
  if (s.tideFrom === undefined) return -1;
  if (tideLevel(s, t) < level) return t;
  const st = stepTicks();
  let at = s.tideFrom + (Math.floor((Math.max(t, s.tideFrom) - s.tideFrom) / st) + 1) * st;
  for (let k = 0; k < 2 * TIDE_TOP; k++, at += st) if (tideLevel(s, at) < level) return at;
  return -1;
}

/** The first tick from `t` on that the sea stands at or above `level`, covering ground of that level (#767); -1 where it never does. */
function coversAt(s: GameState, level: number, t: number): number {
  if (s.tideFrom === undefined) return -1;
  if (tideLevel(s, t) >= level) return t;
  const st = stepTicks();
  let at = s.tideFrom + (Math.floor((Math.max(t, s.tideFrom) - s.tideFrom) / st) + 1) * st;
  for (let k = 0; k < 2 * TIDE_TOP; k++, at += st) if (tideLevel(s, at) >= level) return at;
  return -1;
}

/** The tick a bared tidal tile goes under (#767): when the tide reaches its level, or, in a barrage's pond, at the next turn. -1: not soon. */
function wetAt(s: GameState, tile: number): number {
  if (s.tideFrom === undefined) return -1;
  if (isPond(s, tile)) {
    const st = stepTicks();
    return s.tideFrom + (Math.floor((s.tick - s.tideFrom) / st) + 1) * st;
  }
  return coversAt(s, tidalLevel(s, tile), s.tick);
}

/** A cockle bed's state for the HUD (#767): bared (and for how many seconds more) or under water (and bared in how many). */
export function bedClock(s: GameState, tile: number): { bare: boolean; secs: number; pond: boolean } | null {
  if (!s.cockles || !s.cockles[tile] || !s.tidal) return null;
  const level = tidalLevel(s, tile);
  if (isPond(s, tile)) return { bare: false, secs: 0, pond: true };
  if (bared(s, tile)) {
    const at = coversAt(s, level, s.tick);
    return { bare: true, secs: at < 0 ? 0 : (at - s.tick) / secs(1), pond: false };
  }
  const at = baresAt(s, level, s.tick);
  return { bare: false, secs: at < 0 ? 0 : (at - s.tick) / secs(1), pond: false };
}

const walkingNow = (u: Unit): boolean => u.path !== null || u.wantPath;

/**
 * A picker turned for home with its basket (#779): it drops the way it was walking to the bed, and any wait on the shore for crossing to
 * it (`Unit.tideWait`), so its next step routes it to the drop.
 */
function homeward(u: Unit, o: Extract<Order, { k: 'gather' }> | Extract<Order, { k: 'build' }>): void {
  if (o.k !== 'gather' || o.phase === 'drop') return;
  o.phase = 'drop';
  u.path = null;
  u.wantPath = false;
  u.tideWait = undefined;
  u.miss = 0;
}

/** Send a worker ashore (#767): to `to` (a tile; -1 stays where it stands), there to wait until tick `until`. */
function goAshore(s: GameState, u: Unit, to: number, until: number): void {
  if (to >= 0) {
    u.goal = goalForPoint(s, (to % s.w) + 0.5, Math.floor(to / s.w) + 0.5, s.players[u.owner]?.team ?? -1);
    u.path = null;
    u.wantPath = true;
    u.tideWait = undefined;
    u.stuck = 0;
  } else {
    u.path = null;
    u.goal = null;
    u.wantPath = false;
  }
  u.ashore = until;
  s.events.push({ k: 'tideAshore', id: u.id, owner: u.owner, x: to >= 0 ? (to % s.w) + 0.5 : u.x, y: to >= 0 ? Math.floor(to / s.w) + 0.5 : u.y, until });
}

/**
 * Work on the flats that reads the tide (#767), asked by a gatherer's and a builder's step before it works. A worker sent ashore waits
 * there until its tick. A cockle bed under water sends its picker to the dry ground by it (or keeps it where it stands, if near), to wait
 * until the bed bares. A worker standing on the flats (a picker walking home with its basket too), every `TIDE_WORK.check` ticks, looks at
 * the clock: if the water would cover its ground before it could walk to the nearest dry ground with `TIDE_WORK.margin` seconds to spare,
 * it goes there, and comes back once that ground bares again; a picker with cockles in its basket goes on home with them from the shore.
 * Reads only the tick and the state. True: it holds off its work this tick.
 */
export function tideWorkHold(s: GameState, u: Unit, o: Extract<Order, { k: 'gather' }> | Extract<Order, { k: 'build' }>): boolean {
  if (!s.tidal) return false;
  if (u.ashore !== undefined) {
    if (u.ashore > s.tick) return true;
    u.ashore = undefined;
  }
  const drop = o.k === 'gather' && o.phase === 'drop';
  const bed = o.k === 'gather' && !drop && s.res[o.tile] === R_COCKLE ? o.tile : -1;
  const here = Math.floor(u.y) * s.w + Math.floor(u.x);
  const flats = here >= 0 && here < s.w * s.h && isTidal(s, here) && s.terrain[here] === T_SAND && s.bldAt[here] === 0;
  if (bed < 0 && !flats) return false;
  const team = s.players[u.owner]?.team ?? -1;
  const basket = o.k === 'gather' && u.carry > 0;
  /** Step to dry ground `to`: a picker with a basket then goes home with it; anyone else waits there until `until`. */
  const ashore = (to: number, until: number): boolean => {
    if (basket) {
      (o as Extract<Order, { k: 'gather' }>).phase = 'drop';
      const dx = (to % s.w) + 0.5 - u.x;
      const dy = Math.floor(to / s.w) + 0.5 - u.y;
      goAshore(s, u, to, s.tick + Math.max(1, Math.ceil(secs(Math.sqrt(dx * dx + dy * dy) / Math.max(0.1, routePace(s, u))))));
      return true;
    }
    goAshore(s, u, to, until);
    return true;
  };
  // The bed is under water: wait by it, on dry ground, until it bares. One in a pond never bares; the usual search finds another.
  if (bed >= 0 && !bared(s, bed)) {
    if (isPond(s, bed)) return false;
    const until = baresAt(s, tidalLevel(s, bed), s.tick);
    // By a Cockler's Hut near the bed (#779), on the dry ground beside it; else on the nearest shore.
    const hut = hutWait(s, u, bed);
    const to = hut >= 0 ? hut : shoreFor(s, flats ? u.x : (bed % s.w) + 0.5, flats ? u.y : Math.floor(bed / s.w) + 0.5, team);
    const dry = to >= 0 && !isTidal(s, to);
    if (basket && !flats) {
      homeward(u, o);
      return false;
    }
    const near = dry && Math.abs((to % s.w) + 0.5 - u.x) + Math.abs(Math.floor(to / s.w) + 0.5 - u.y) < 2;
    if (!dry || near) {
      if (basket) {
        homeward(u, o);
        return false;
      }
      goAshore(s, u, -1, until < 0 ? s.tick + secs(TIDE.period) : until);
      return true;
    }
    return ashore(to, until < 0 ? s.tick + secs(TIDE.period) : until);
  }
  // Below a rival's loaded Tide Gate (#785): a picker keeps off its bed, and waits ashore by it a while before looking again.
  const risk = bed >= 0 || flats ? gateRisk(s, u.owner) : null;
  if (risk && bed >= 0 && !basket && risk(bed)) {
    const hut = hutWait(s, u, bed);
    const to = hut >= 0 ? hut : shoreFor(s, flats ? u.x : (bed % s.w) + 0.5, flats ? u.y : Math.floor(bed / s.w) + 0.5, team);
    const until = s.tick + secs(TIDE_GATE.wary);
    if (to < 0 || isTidal(s, to) || Math.abs((to % s.w) + 0.5 - u.x) + Math.abs(Math.floor(to / s.w) + 0.5 - u.y) < 2) {
      if (flats) return false;
      goAshore(s, u, -1, until);
      return true;
    }
    return ashore(to, until);
  }
  if (!flats || (walkingNow(u) && !drop) || (s.tick + u.id) % TIDE_WORK.check !== 0) return false;
  const go = fleeFlood(s, u, here);
  if (!go) return false;
  const back = isPond(s, here) ? -1 : baresAt(s, tidalLevel(s, here), go.wet);
  return ashore(go.to, back < 0 ? s.tick + secs(TIDE.period) : back);
}

/**
 * Whether a land unit standing on bared flats at `here` must leave for the flood now (#767): the dry tile to walk to, and the tick the
 * water reaches it, when the water would cover its ground before it could walk there (at its route's pace) with `TIDE_WORK.margin`
 * seconds to spare. Null: it can stay, or there is no dry ground within `TIDE.sweep` to go to.
 */
function fleeFlood(s: GameState, u: Unit, here: number): { to: number; wet: number } | null {
  const pace = routePace(s, u);
  if (pace <= 0) return null;
  // Standing below a rival's loaded Tide Gate (#785): off the flats now, and a look again in a while.
  const risk = gateRisk(s, u.owner);
  if (risk && risk(here)) {
    const to = shoreFor(s, u.x, u.y, s.players[u.owner]?.team ?? -1);
    return to < 0 || isTidal(s, to) ? null : { to, wet: s.tick + secs(TIDE_GATE.wary) };
  }
  const wet = wetAt(s, here);
  // Cheap first: bare long enough to walk the farthest the shore is looked for.
  if (wet < 0 || wet - s.tick > Math.ceil(secs((TIDE.sweep * 1.5) / pace + TIDE_WORK.margin))) return null;
  const to = shoreFor(s, u.x, u.y, s.players[u.owner]?.team ?? -1);
  if (to < 0 || isTidal(s, to)) return null;
  const dx = (to % s.w) + 0.5 - u.x;
  const dy = Math.floor(to / s.w) + 0.5 - u.y;
  if (wet - s.tick > Math.ceil(secs(Math.sqrt(dx * dx + dy * dy) / pace + TIDE_WORK.margin))) return null;
  return { to, wet };
}

/**
 * An idle citizen standing on the flats (#767), one whose work out there is done, walks to dry ground before the flood: every
 * `TIDE_WORK.check` ticks, as a worker reads the clock. Called from an idle citizen's step.
 */
export function idleAshore(s: GameState, u: Unit): void {
  if (!s.tidal || (s.tick + u.id) % TIDE_WORK.check !== 0 || u.path !== null || u.wantPath) return;
  const here = Math.floor(u.y) * s.w + Math.floor(u.x);
  if (here < 0 || here >= s.w * s.h || !isTidal(s, here) || s.terrain[here] !== T_SAND || s.bldAt[here] !== 0) return;
  const go = fleeFlood(s, u, here);
  if (!go) return;
  u.order = { k: 'move', x: (go.to % s.w) + 0.5, y: Math.floor(go.to / s.w) + 0.5, amove: false, started: false };
  u.stuck = 0;
  u.miss = 0;
  s.events.push({ k: 'tideAshore', id: u.id, owner: u.owner, x: u.order.x, y: u.order.y, until: s.tick });
}

/** Whether a worker stands ashore for the tide (#767), and for how many seconds more (0: not). */
export function ashoreLeft(s: GameState, u: Unit): number {
  return u.ashore !== undefined && u.ashore > s.tick ? (u.ashore - s.tick) / secs(1) : 0;
}

// ---- The Cockler's Hut, and shore waits that hold their ground (#779) ----------------------------

/** Whether a Cockler's Hut works (#779): finished, standing, and its people in the Age of Tides (or keeping the hut). */
export const hutWorks = (s: GameState, b: Building): boolean => b.type === 'cockler' && b.built && b.hp > 0 && !asleep(s, b);

/** Why a Cockler's Hut can't go here, or null where it can (#779): it wants a cockle bed within `COCKLER.reach` tiles. */
export function cocklerSpot(s: GameState, tx: number, ty: number, n: number): 'beds' | null {
  const beds = s.cockles;
  if (!beds) return 'beds';
  const r = COCKLER.reach;
  for (let y = Math.max(0, ty - r); y < Math.min(s.h, ty + n + r); y++)
    for (let x = Math.max(0, tx - r); x < Math.min(s.w, tx + n + r); x++) if (beds[y * s.w + x] && distToRect(x + 0.5, y + 0.5, { tx, ty, size: n }) <= r) return null;
  return 'beds';
}

/** The cockle beds a working hut tends (#779): those within `COCKLER.reach` tiles of one, by tile. Null: none. */
export function tendedBeds(s: GameState): Uint8Array | null {
  const beds = s.cockles;
  if (!beds) return null;
  let out: Uint8Array | null = null;
  const r = COCKLER.reach;
  for (const e of s.ents) {
    if (e.kind !== 'building' || !hutWorks(s, e)) continue;
    for (let y = Math.max(0, e.ty - r); y < Math.min(s.h, e.ty + e.size + r); y++)
      for (let x = Math.max(0, e.tx - r); x < Math.min(s.w, e.tx + e.size + r); x++) {
        const i = y * s.w + x;
        if (beds[i] && distToRect(x + 0.5, y + 0.5, e) <= r) (out ??= new Uint8Array(beds.length))[i] = 1;
      }
  }
  return out;
}

/** How many cockle beds a hut tends (#779), for its panel. */
export function hutBeds(s: GameState, b: Building): number {
  const beds = s.cockles;
  if (!beds) return 0;
  let n = 0;
  const r = COCKLER.reach;
  for (let y = Math.max(0, b.ty - r); y < Math.min(s.h, b.ty + b.size + r); y++)
    for (let x = Math.max(0, b.tx - r); x < Math.min(s.w, b.tx + b.size + r); x++) if (beds[y * s.w + x] && distToRect(x + 0.5, y + 0.5, b) <= r) n++;
  return n;
}

/**
 * Where a picker with a basket of cockles empties it (#779): the nearest of its people's working huts, when nearer than `drop` (the
 * nearest food store), else `drop`. A hut takes cockles only: anyone else, or a basket of other food, keeps to `drop`.
 */
export function cocklerDrop(s: GameState, u: Unit, drop: Building | null): Building | null {
  if (u.order.k !== 'gather' || !u.order.cockle || u.carryRes !== 'food' || u.type !== 'citizen') return drop;
  let best = drop;
  let bestD = drop ? distToRect(u.x, u.y, drop) : Infinity;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== u.owner || !hutWorks(s, e)) continue;
    const d = distToRect(u.x, u.y, e);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/**
 * The tile a picker waits on for its bed to bare (#779), by the nearest of its people's working huts within `COCKLER.wait` tiles of the
 * bed: a dry tile that can be walked on in the ring round the hut, among the three nearest the bed, picked by the picker's id so a crew
 * stands spread. -1: no hut near.
 */
function hutWait(s: GameState, u: Unit, bed: number): number {
  const bx = (bed % s.w) + 0.5;
  const by = Math.floor(bed / s.w) + 0.5;
  let hut: Building | null = null;
  let hutD = COCKLER.wait;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== u.owner || !hutWorks(s, e)) continue;
    const d = distToRect(bx, by, e);
    if (d <= hutD) {
      hutD = d;
      hut = e;
    }
  }
  if (!hut) return -1;
  const team = s.players[u.owner]?.team ?? -1;
  const ring: { i: number; d: number }[] = [];
  for (let y = hut.ty - 1; y <= hut.ty + hut.size; y++)
    for (let x = hut.tx - 1; x <= hut.tx + hut.size; x++) {
      if (x >= hut.tx && x < hut.tx + hut.size && y >= hut.ty && y < hut.ty + hut.size) continue;
      const i = y * s.w + x;
      if (!walkable(s, x, y, team) || isTidal(s, i)) continue;
      ring.push({ i, d: (x + 0.5 - bx) * (x + 0.5 - bx) + (y + 0.5 - by) * (y + 0.5 - by) });
    }
  if (!ring.length) return -1;
  ring.sort((a, b) => a.d - b.d || a.i - b.i);
  return ring[u.id % Math.min(3, ring.length)].i;
}

/**
 * The best tile for a Cockler's Hut by a bed (#779), for the computer: the spot within `COCKLER.reach` tiles of the bed, nearest it, that
 * `fits` (ties by tile order). Null: none.
 */
export function cocklerSpotNear(s: GameState, bed: number, fits: (tx: number, ty: number) => boolean): { tx: number; ty: number } | null {
  const bx = (bed % s.w) + 0.5;
  const by = Math.floor(bed / s.w) + 0.5;
  const r = COCKLER.reach;
  let best: { tx: number; ty: number } | null = null;
  let bestD = Infinity;
  for (let ty = Math.max(1, Math.floor(by) - r - 1); ty <= Math.min(s.h - 3, Math.floor(by) + r); ty++)
    for (let tx = Math.max(1, Math.floor(bx) - r - 1); tx <= Math.min(s.w - 3, Math.floor(bx) + r); tx++) {
      const d = distToRect(bx, by, { tx, ty, size: 2 });
      if (d > r - 1 || d >= bestD || !fits(tx, ty)) continue;
      bestD = d;
      best = { tx, ty };
    }
  return best;
}

/**
 * A land unit standing still to wait for the tide (#779): on the shore for a crossing (#755, `Unit.tideWait`), or ashore off its work
 * (#767, `Unit.ashore`). The crowd round it may jostle it (`separate`), but never off dry ground onto tidal ground, where the flood would
 * sweep it: called after `collide`, it slides it back along the edge of the flats, or, pushed right over, back onto the dry tile it stood
 * on. So does one on the last stretch (`1.5` tiles) of its walk to the spot it waits on, crowded by those already there. Ground it chose
 * to stand on stays its own: one already standing on the flats as the tick began is left to the tide's other rules.
 */
export function holdShore(s: GameState, u: Unit): void {
  if (!s.tidal || u.inside || domainOf(u.type) !== 'land') return;
  const waits = u.tideWait !== undefined && u.tideWait > s.tick && u.wantPath;
  if (!waits && !(u.ashore !== undefined && u.ashore > s.tick)) return;
  // Walking: only on the last stretch to the spot it waits on, so the safe flats it crosses on the way stay its to walk.
  if (u.path) {
    const n = u.path.length;
    const dx = u.path[n - 2] - u.x;
    const dy = u.path[n - 1] - u.y;
    if (!waits || dx * dx + dy * dy > 1.5 * 1.5) return;
  }
  const wet = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < s.w && y < s.h && isTidal(s, y * s.w + x) && s.bldAt[y * s.w + x] === 0;
  const fx = Math.floor(u.px);
  const fy = Math.floor(u.py);
  if (wet(fx, fy)) return;
  const r = statsOf(s, u).radius;
  const team = passOf(s, u);
  const cx = Math.floor(u.x);
  const cy = Math.floor(u.y);
  if (wet(cx, cy)) {
    // Pushed right over: back to the nearest point of the tile it stood on.
    u.x = Math.max(fx + r, Math.min(fx + 1 - r, u.x));
    u.y = Math.max(fy + r, Math.min(fy + 1 - r, u.y));
    return;
  }
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || !wet(cx + dx, cy + dy)) continue;
      const qx = Math.max(cx + dx, Math.min(cx + dx + 1, u.x));
      const qy = Math.max(cy + dy, Math.min(cy + dy + 1, u.y));
      const ox = u.x - qx;
      const oy = u.y - qy;
      const d2 = ox * ox + oy * oy;
      if (d2 >= r * r || d2 < 1e-10) continue;
      const d = Math.sqrt(d2);
      const nx = qx + (ox / d) * r;
      const ny = qy + (oy / d) * r;
      if (!walkable(s, Math.floor(nx), Math.floor(ny), team)) continue;
      u.x = nx;
      u.y = ny;
    }
}

// ---- Tide Gates (#785) ---------------------------------------------------------------------------

/** Whether a Tide Gate works (#785): finished, standing, and its people in the Age of Tides. A sleeping gate stays shut. */
export const gateWorks = (s: GameState, b: Building): boolean => b.type === 'tidegate' && b.built && b.hp > 0 && !asleep(s, b);

/**
 * The pond behind a gate (#785): the tidal tiles of every body of water beside the gate, four ways, that is shut off from the sea as
 * `pondsOf` judges it (touches no map edge, holds no more than `BARRAGE.most` tiles). In the order a walk from the gate finds them.
 */
export function pondBehind(s: GameState, b: { tx: number; ty: number }): number[] {
  const out: number[] = [];
  if (!s.tidal) return out;
  const { w, h } = s;
  const seen = new Set<number>();
  for (const n of FOUR_OF(s, b.ty * w + b.tx)) {
    if (seen.has(n) || !holdsWater(s, n)) continue;
    const body = [n];
    seen.add(n);
    let open = false;
    for (let q = 0; q < body.length && !open; q++) {
      const i = body[q];
      const x = i % w;
      const y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || body.length > BARRAGE.most) open = true;
      for (const j of FOUR_OF(s, i)) {
        if (seen.has(j) || !holdsWater(s, j)) continue;
        seen.add(j);
        body.push(j);
      }
    }
    if (open) continue;
    for (const i of body) if (s.tidal[i] !== 0) out.push(i);
  }
  return out;
}

/** The head of water a gate holds (#785): the tiles of its pond the barrage keeps wet that the sea outside would leave bare now. */
export function gateHead(s: GameState, b: Building): number[] {
  const level = tideLevel(s);
  return pondBehind(s, b).filter((t) => isPond(s, t) && tidalLevel(s, t) > level);
}

/** Whether a gate's pond would scour if it were opened now (#785): working, shut, and a head of `TIDE_GATE.least` tiles or more. */
export function gateLoaded(s: GameState, b: Building): boolean {
  return gateWorks(s, b) && !b.open && !s.scour?.some((c) => c.gate === b.id) && gateHead(s, b).length >= TIDE_GATE.least;
}

/**
 * The flats a gate's scour runs over (#785): from the gate's sea side, through open water and bared flats (never the pond, a causeway, a
 * building or dry land), within `TIDE_GATE.reach` tiles of the gate, the first `most` tiles of bared flats found, nearest first, four ways.
 */
function scourTiles(s: GameState, b: Building, most: number): number[] {
  const out: number[] = [];
  if (!s.tidal || most <= 0) return out;
  const pond = new Set(pondBehind(s, b));
  const gx = b.tx + 0.5;
  const gy = b.ty + 0.5;
  const r = TIDE_GATE.reach;
  const seen = new Set<number>([b.ty * s.w + b.tx]);
  const queue: number[] = [];
  const pass = (i: number): boolean => {
    if (pond.has(i) || isPond(s, i) || s.bldAt[i] !== 0) return false;
    const k = s.tidal![i];
    if (k === TIDE_CAUSEWAY) return false;
    if (k !== 0) return true;
    return s.terrain[i] === T_WATER && !isPolder(s, i) && !isChannel(s, i) && !isInund(s, i);
  };
  for (const n of FOUR_OF(s, b.ty * s.w + b.tx)) {
    if (seen.has(n) || !pass(n)) continue;
    seen.add(n);
    queue.push(n);
  }
  for (let q = 0; q < queue.length && out.length < most; q++) {
    const i = queue[q];
    if (bared(s, i) && free(s, i)) out.push(i);
    for (const j of FOUR_OF(s, i)) {
      if (seen.has(j) || !pass(j)) continue;
      const dx = (j % s.w) + 0.5 - gx;
      const dy = Math.floor(j / s.w) + 0.5 - gy;
      if (dx * dx + dy * dy > r * r) continue;
      seen.add(j);
      queue.push(j);
    }
  }
  return out;
}

/** The flats a gate would scour if it were opened now (#785): none unless it is loaded. Public, as the tide clock is. */
export function gateReach(s: GameState, b: Building): number[] {
  if (!gateLoaded(s, b)) return [];
  return scourTiles(s, b, gateHead(s, b).length * TIDE_GATE.spread);
}

/** The tiles every running scour holds under water (#785): its flats, and the pond still pouring out behind them. Null: none. */
function scourHeld(s: GameState): Set<number> | null {
  if (!s.scour) return null;
  const out = new Set<number>();
  for (const c of s.scour) {
    for (const t of c.tiles) out.add(t);
    for (const t of c.pond) out.add(t);
  }
  return out;
}

/**
 * The ponds let out (#785), as `recountPonds` counts them again (`now`, the ponds the barrages shut): a tile let out fills again once the
 * sea stands over it with no open gate on its pond; every working open gate's pond is let out; and a tile let out is no pond till then.
 */
function letOut(s: GameState, now: Uint8Array): void {
  let out = s.pondOut;
  const level = tideLevel(s);
  if (out) for (let i = 0; i < out.length; i++) if (out[i] && (!now[i] || level >= tidalLevel(s, i))) out[i] = 0;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'tidegate' || !e.open || !gateWorks(s, e)) continue;
    for (const t of pondBehind(s, e)) if (now[t]) (out ??= new Uint8Array(now.length))[t] = 1;
  }
  if (!out) return;
  let any = false;
  for (let i = 0; i < out.length; i++)
    if (out[i]) {
      any = true;
      now[i] = 0;
    }
  if (any) s.pondOut = out;
  else delete s.pondOut;
}

/** Why a gate can't be opened or shut now (#785), or null. */
export function tideGateProblem(s: GameState, b: Building): string | null {
  if (!b.built) return 'The gate is not finished';
  if (!s.tidal || !gateWorks(s, b)) return 'A Tide Gate works only in the Age of Tides';
  if (s.scour?.some((c) => c.gate === b.id)) return 'The pond is still pouring out through the gate';
  return null;
}

/**
 * Open a gate, or shut it (#785). Shut, its pond fills again on the flood. Opened, its pond runs with the tide; opened on a head of
 * `TIDE_GATE.least` tiles or more, the pond rushes out as a scour: the flats below (`scourTiles`, `TIDE_GATE.spread` for each tile of
 * head) go under at once and stay under `TIDE_GATE.secs` seconds, the pond pouring out behind them, and whoever stands on them is swept,
 * `TIDE_GATE.hurt` health lost, or drowned with no shore near. The gate's own people too.
 */
export function toggleGate(s: GameState, b: Building): void {
  if (b.open) {
    b.open = undefined;
    s.tideTurns = (s.tideTurns ?? 0) + 1;
    recountPonds(s);
    s.events.push({ k: 'tideGate', owner: b.owner, id: b.id, open: false, scour: 0, swept: 0, x: b.x, y: b.y });
    return;
  }
  const level = tideLevel(s);
  const pond = pondBehind(s, b);
  const head = pond.filter((t) => isPond(s, t) && tidalLevel(s, t) > level);
  b.open = true;
  const tiles = head.length >= TIDE_GATE.least ? scourTiles(s, b, head.length * TIDE_GATE.spread) : [];
  const wet = new Set<number>();
  for (const t of tiles) {
    cover(s, t);
    wet.add(t);
  }
  if (tiles.length) (s.scour ??= []).push({ gate: b.id, owner: b.owner, tiles, pond: head, until: s.tick + secs(TIDE_GATE.secs) });
  recountPonds(s);
  // No scour: the pond runs out at once to the level the sea stands at.
  let n = tiles.length;
  if (!tiles.length)
    for (const t of pond)
      if (free(s, t) && !isPond(s, t) && level < tidalLevel(s, t) && s.terrain[t] === T_WATER) {
        bare(s, t);
        n++;
      }
  let swept = 0;
  if (wet.size) {
    for (const u of s.ents)
      if (u.kind === 'unit' && u.hp > 0 && !u.inside && domainOf(u.type) === 'land' && wet.has(Math.floor(u.y) * s.w + Math.floor(u.x))) {
        sweep(s, u, TIDE_GATE.hurt, b.owner);
        swept++;
      }
    drownKegs(s, wet);
  }
  const p = s.players[b.owner];
  if (p && swept) p.stats.scoured = (p.stats.scoured ?? 0) + swept;
  s.blockVersion++;
  s.tideTurns = (s.tideTurns ?? 0) + n + 1;
  s.events.push({ k: 'tideGate', owner: b.owner, id: b.id, open: true, scour: tiles.length, swept, x: b.x, y: b.y });
  rereadRoutes(s);
}

/** Scours that have run their time (#785): their flats and the pond behind them settle to the level the sea stands at, in tile order. */
function endScours(s: GameState): void {
  const done = s.scour!.filter((c) => c.until <= s.tick);
  if (!done.length) return;
  const left = s.scour!.filter((c) => c.until > s.tick);
  if (left.length) s.scour = left;
  else delete s.scour;
  const level = tideLevel(s);
  const held = scourHeld(s);
  const tiles = [...new Set(done.flatMap((c) => [...c.tiles, ...c.pond]))].sort((a, b) => a - b);
  let n = 0;
  for (const t of tiles) {
    if (!free(s, t) || (held && held.has(t))) continue;
    const out = level < tidalLevel(s, t) && !isPond(s, t);
    if (out && s.terrain[t] === T_WATER) {
      bare(s, t);
      n++;
    }
  }
  s.blockVersion++;
  s.tideTurns = (s.tideTurns ?? 0) + n + 1;
  rereadRoutes(s);
}

/** Each working shut gate's scour reach, worked out once a tick (and again whenever the shore moves): what workers and routes read. */
const reachMemo = new WeakMap<GameState, { tick: number; turns: number; zones: { owner: number; gate: number; tiles: Set<number> }[] }>();

function gateZones(s: GameState): { owner: number; gate: number; tiles: Set<number> }[] {
  const m = reachMemo.get(s);
  const turns = s.tideTurns ?? 0;
  if (m && m.tick === s.tick && m.turns === turns) return m.zones;
  const zones: { owner: number; gate: number; tiles: Set<number> }[] = [];
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'tidegate') continue;
    const tiles = gateReach(s, e);
    if (tiles.length) zones.push({ owner: e.owner, gate: e.id, tiles: new Set(tiles) });
  }
  reachMemo.set(s, { tick: s.tick, turns, zones });
  return zones;
}

/**
 * The flats below a rival's loaded Tide Gate (#785), as a people's workers and routes read them: a test of a tile, or null where no rival
 * gate is loaded. The gate's own side walks them as it likes; its owner knows when it will open.
 */
export function gateRisk(s: GameState, owner: number): ((tile: number) => boolean) | null {
  if (!s.tidal || !s.pond) return null;
  const zones = gateZones(s).filter((z) => isEnemy(s, owner, z.owner));
  if (!zones.length) return null;
  return (tile: number) => zones.some((z) => z.tiles.has(tile));
}

/**
 * The first tile of a rival's loaded gate's reach a walk from `x, y` along the waypoints `pts` (from point `from` on) steps onto (#792),
 * and whose gate it is. The tile it stands on now is not counted: it can't help that. Null: none.
 */
export function gateAhead(s: GameState, owner: number, x: number, y: number, pts: readonly number[], from = 0): { gate: number; tile: number } | null {
  if (!s.tidal || !s.pond) return null;
  const zones = gateZones(s).filter((z) => isEnemy(s, owner, z.owner));
  if (!zones.length) return null;
  const w = s.w;
  let last = Math.floor(y) * w + Math.floor(x);
  let ax = x;
  let ay = y;
  for (let k = from; k * 2 < pts.length; k++) {
    const bx = pts[k * 2];
    const by = pts[k * 2 + 1];
    const n = Math.max(1, Math.ceil(Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)) * 4));
    for (let j = 1; j <= n; j++) {
      const tx = Math.floor(ax + ((bx - ax) * j) / n);
      const ty = Math.floor(ay + ((by - ay) * j) / n);
      if (tx < 0 || ty < 0 || tx >= w || ty >= s.h) continue;
      const i = ty * w + tx;
      if (i === last) continue;
      last = i;
      for (const z of zones) if (z.tiles.has(i)) return { gate: z.gate, tile: i };
    }
    ax = bx;
    ay = by;
  }
  return null;
}

/** How long a walk from `x, y` along the waypoints `pts` is, in tiles. */
function walkLength(x: number, y: number, pts: readonly number[]): number {
  let d = 0;
  for (let k = 0; k * 2 < pts.length; k++) {
    const dx = pts[k * 2] - x;
    const dy = pts[k * 2 + 1] - y;
    d += Math.sqrt(dx * dx + dy * dy);
    x = pts[k * 2];
    y = pts[k * 2 + 1];
  }
  return d;
}

/**
 * The rival's loaded Tide Gate a march from `from` to `to` would walk under (#792), as the computer reads it before it sets out: the gate
 * whose reach the plain way there steps onto first, unless a way round that keeps off every rival gate's reach is no more than
 * `AI_GATE_ANSWER.round` times as long (then the march just goes round, as each soldier's own route does). Null: no gate on the way.
 */
export function gateOnWay(s: GameState, owner: number, team: number, from: { x: number; y: number }, to: { x: number; y: number }): Building | null {
  const risk = gateRisk(s, owner);
  if (!risk) return null;
  const goal = goalForPoint(s, to.x, to.y, team);
  const plain = findPath(s, from.x, from.y, goal, AI_GATE_ANSWER.search, team);
  if (!plain.points.length) return null;
  const hit = gateAhead(s, owner, from.x, from.y, plain.points);
  if (!hit) return null;
  const round = findPath(s, from.x, from.y, goal, AI_GATE_ANSWER.search, team, (i) => risk(i));
  if (round.complete && round.points.length && walkLength(from.x, from.y, round.points) <= walkLength(from.x, from.y, plain.points) * AI_GATE_ANSWER.round) return null;
  const g = s.byId.get(hit.gate);
  return g && g.kind === 'building' ? g : null;
}

/** Why a Tide Gate can't go on this tile (#785), or null: it goes on a causeway tile of its owner's own, beside a barrage's pond. */
export function tideGateSpot(s: GameState, tx: number, ty: number, owner: number): 'barrage' | null {
  const i = ty * s.w + tx;
  if (!s.tidal || !isCauseway(s, i) || s.bldAt[i] !== 0) return 'barrage';
  if (owner >= 0 && causewayOwner(s, i) !== owner) return 'barrage';
  return pondBehind(s, { tx, ty }).length ? null : 'barrage';
}

/**
 * Where the computer sets its gate (#785): of its barrage's tiles that would take one, the one nearest the line's middle with the sea on
 * the other side from the pond (some flats to scour); ties to the first in the line. Null: none.
 */
export function tideGateSpotIn(s: GameState, line: readonly number[], owner: number): { tx: number; ty: number } | null {
  let best: { tx: number; ty: number } | null = null;
  let bestD = Infinity;
  const mid = (line.length - 1) / 2;
  for (let k = 0; k < line.length; k++) {
    const t = line[k];
    const tx = t % s.w;
    const ty = Math.floor(t / s.w);
    if (tideGateSpot(s, tx, ty, owner)) continue;
    const pond = new Set(pondBehind(s, { tx, ty }));
    const sea = FOUR_OF(s, t).some((n) => !pond.has(n) && s.tidal![n] !== 0 && s.tidal![n] !== TIDE_CAUSEWAY && !isPond(s, n));
    if (!sea) continue;
    const d = Math.abs(k - mid);
    if (d < bestD) {
      bestD = d;
      best = { tx, ty };
    }
  }
  return best;
}
