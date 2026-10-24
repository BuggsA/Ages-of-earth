import { AGES, AI_EBB, BARRAGE, KEG, TIDE, TIDE_ROUTE, domainOf, secs } from './data';
import { ageDef, ageOf, asleep } from './ages';
import { distToTile, stampBuilding, walkable } from './grid';
import { isChannel, isInund, isPolder, seaAt } from './water';
import { isEnemy, statsOf } from './world';
import { findPath } from './path';
import { kegsOf, sappers } from './powder';
import { peace } from './combat';
import type { BarragePlan, Building, GameState, Unit } from './types';
import { B_TERRAIN, R_NONE, T_SAND, T_WATER } from './types';

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
const free = (s: GameState, i: number): boolean => s.bldAt[i] === 0 && s.res[i] === R_NONE && !isPolder(s, i) && !isChannel(s, i) && !isInund(s, i);

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
  for (let i = 0; i < t.length; i++) {
    if (t[i] === 0 || !free(s, i)) continue;
    const out = level < tidalLevel(s, i) && !(pond && pond[i]);
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

/** Sweep a land unit the tide caught to the shore, hurt, and send it on its way again from there (or drown it, with no shore near). */
function sweep(s: GameState, u: Unit): void {
  const to = shoreFor(s, u.x, u.y, s.players[u.owner]?.team ?? -1);
  if (to < 0) {
    u.hp = 0;
    s.events.push({ k: 'tideSwept', id: u.id, owner: u.owner, x: u.x, y: u.y, drowned: true });
    return;
  }
  u.x = (to % s.w) + 0.5;
  u.y = Math.floor(to / s.w) + 0.5;
  u.hp = Math.max(0, u.hp - TIDE.hurt);
  u.path = null;
  if (u.goal) u.wantPath = true;
  s.events.push({ k: 'tideSwept', id: u.id, owner: u.owner, x: u.x, y: u.y, drowned: u.hp <= 0 });
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
  recountPonds(s, true);
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
  const level = tideLevel(s);
  const turned = s.tick === s.tideFrom || tideLevel(s, s.tick - 1) !== level;
  if (turned) {
    const { bared: nb, covered, wet } = settle(s, level);
    if (s.tick !== s.tideFrom) {
      s.events.push({ k: 'tide', level, rising: level > tideLevel(s, s.tick - 1), bared: nb, covered });
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
      if (dx * dx + dy * dy > r * r) continue;
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
        if (doom < 0 && !safeOver(s, i, t0, at, pace)) doom = at;
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
function ebbFrom(s: GameState, flats: Flat[], stop: number, pace: number, t: number, until: number): number {
  const ahead = flats.filter((f) => f.d > stop);
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
  const p = passage(s, u.x, u.y, u.path, 0, pace, t0);
  if (p.doom < 0) return 0;
  let cost = 0;
  // Round: a path that turns down every tidal tile the water would cover before the unit is past it.
  let round: { pts: number[]; time: number } | null = null;
  const limit = Math.min(12000, Math.max(800, budget));
  const r = findPath(s, u.x, u.y, u.goal, limit, team, (i, g) => isTidal(s, i) && s.bldAt[i] === 0 && !safeOver(s, i, t0, g, pace));
  cost += r.cost;
  if (r.complete && r.points.length) {
    const q = passage(s, u.x, u.y, r.points, 0, pace, t0);
    if (q.doom < 0) round = { pts: r.points, time: q.length / pace };
  }
  // Wait: on the last dry ground before the flats, for the first moment the whole crossing stays bare.
  let wait: { at: number; time: number } | null = null;
  if (p.stop) {
    const reach = t0 + Math.ceil(secs(p.stop.d / pace));
    const at = ebbFrom(s, p.flats, p.stop.d, pace, reach, t0 + secs(TIDE_ROUTE.hold));
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
    if (passage(s, u.x, u.y, u.path, u.pathI, pace, s.tick).doom >= 0) u.wantPath = true;
  }
}

/** Whether a unit is waiting on the shore for the tide (#755), and for how many seconds more (0: not waiting). */
export function tideWaitLeft(s: GameState, u: Unit): number {
  return u.tideWait !== undefined && u.wantPath && u.tideWait > s.tick ? (u.tideWait - s.tick) / secs(1) : 0;
}
