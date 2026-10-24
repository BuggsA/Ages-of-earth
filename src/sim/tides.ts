import { AGES, TIDE, domainOf, secs } from './data';
import { ageDef, ageOf, asleep } from './ages';
import { stampBuilding, walkable } from './grid';
import { isChannel, isPolder, seaAt } from './water';
import type { Building, GameState, Unit } from './types';
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

/** The shallowest corner of a tile: what decides how early the falling tide bares it. */
function topCorner(s: GameState, tile: number, h: ArrayLike<number> = s.height): number {
  const x = tile % s.w;
  const y = (tile - x) / s.w;
  const W = s.w + 1;
  const i = y * W + x;
  return Math.min(h[i], h[i + 1], h[i + W], h[i + W + 1]);
}

/** The level of tidal ground a sea tile of this depth would be: the count of `TIDE.flats` depths at or below its shallowest corner. */
function levelFor(depth: number): number {
  let k = 0;
  for (const d of TIDE.flats) if (depth >= d) k++;
  return k;
}

/** Whether nothing on a tile keeps the tide off it: no building or site, no polder or channel, no shoal. */
const free = (s: GameState, i: number): boolean => s.bldAt[i] === 0 && s.res[i] === R_NONE && !isPolder(s, i) && !isChannel(s, i);

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
    const k = levelFor(topCorner(s, i));
    if (k > 0 && seaAt(s, i, known)) tidal[i] = k;
  }
  s.tidal = tidal;
  s.tideBed = Float32Array.from(s.height);
  s.tideFrom = s.tick;
  s.tideTurns ??= 0;
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
  for (let i = 0; i < t.length; i++) {
    if (t[i] === 0 || !free(s, i)) continue;
    const out = level < tidalLevel(s, i);
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
  if (s.terrain[i] !== T_WATER || isChannel(s, i)) return 'dry';
  if (topCorner(s, i) < TIDE.causeway) return 'deep';
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
    for (const t of tidalNear(s, e)) {
      if (n >= TIDE.mill.most) break;
      if (taken.has(t)) continue;
      taken.add(t);
      n++;
    }
    out.set(e.id, (TIDE.mill.gold * n) / TIDE.mill.most);
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

/** Whether a Dock is aground (#739): the tide has bared all the water beside it, so it launches nothing until the water comes back. */
export function aground(s: GameState, b: Building): boolean {
  if (b.type !== 'dock' || !s.tidal) return false;
  let tidal = false;
  for (let y = b.ty - 1; y <= b.ty + b.size; y++)
    for (let x = b.tx - 1; x <= b.tx + b.size; x++) {
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
  } else if (s.tick % 5 === 0) {
    for (const u of s.ents) if (u.kind === 'unit' && u.hp > 0 && !u.inside && domainOf(u.type) === 'land' && caught(s, u.x, u.y)) sweep(s, u);
  }
}
