import { BUILDINGS, TERRAIN, domainOf, secs, type UnitStats } from './data';
import { borderMap } from './borders';
import { groundAt, walkable } from './grid';
import type { Spatial } from './spatial';
import { R_TREE, type Building, type Ent, type GameState, type Unit } from './types';
import { isEnemy, statsOf } from './world';

/**
 * The lay of the land (`docs/lay-of-the-land.md`). Every number is `TERRAIN`'s.
 * - t1, high ground (#925): shooting down reaches further and shooting up falls short; a unit on a rise sees further; climbing is slow.
 * - t2, forest cover (#934): a soldier in a wood is hidden from rivals beyond a few tiles (`Unit.cover`); woods slow an army, riders most,
 *   and blunt a rider's blow.
 */

/** The height a unit stands at, with water counted at the sea's face. */
export function standAt(s: GameState, x: number, y: number): number {
  return Math.max(TERRAIN.sea, groundAt(s, x, y));
}

/** How many tiles further (or, below zero, shorter) a shot reaches from (x, y) to (tx, ty) for the height between them. */
export function heightReach(s: GameState, x: number, y: number, tx: number, ty: number): number {
  const drop = standAt(s, x, y) - standAt(s, tx, ty);
  if (drop > TERRAIN.rise) return Math.min(TERRAIN.reachUp, (drop - TERRAIN.rise) * TERRAIN.reachPer);
  if (drop < -TERRAIN.rise) return Math.max(-TERRAIN.reachDown, (drop + TERRAIN.rise) * TERRAIN.reachPer);
  return 0;
}

/** Whether the ground's height counts for this shooter: a ranged unit on land or water, not an aircraft. */
export function feelsHeight(u: Unit, st: UnitStats): boolean {
  return !!st.shot && st.range > 0 && domainOf(u.type) !== 'air';
}

/** A unit's reach at a target: its range, more when it shoots down at the target and less when up (an aircraft target is level with nothing). */
export function reachAt(s: GameState, u: Unit, st: UnitStats, t: Ent): number {
  if (!feelsHeight(u, st) || (t.kind === 'unit' && domainOf(t.type) === 'air')) return st.range;
  return st.range + heightReach(s, u.x, u.y, t.x, t.y);
}

/** Offsets of the ring of points a rise is measured against: `TERRAIN.ring` points round a circle of radius one. */
const RING: number[] = [1, 0, 0.7071, 0.7071, 0, 1, -0.7071, 0.7071, -1, 0, -0.7071, -0.7071, 0, -1, 0.7071, -0.7071];

/** How far a point stands above the ground round it: its height less the mean of the ring `TERRAIN.around` tiles out. */
export function prominence(s: GameState, x: number, y: number): number {
  const r = TERRAIN.around;
  let sum = 0;
  for (let k = 0; k < RING.length; k += 2) sum += standAt(s, x + RING[k] * r, y + RING[k + 1] * r);
  return standAt(s, x, y) - sum / (RING.length / 2);
}

/** How many tiles further a land or water unit at (x, y) sees for standing on a rise. */
export function heightSight(s: GameState, x: number, y: number): number {
  const p = prominence(s, x, y) - TERRAIN.sightFrom;
  return p > 0 ? Math.min(TERRAIN.sightMax, p * TERRAIN.sightPer) : 0;
}

/** A land unit's pace, as a share of its own, walking from where it stands toward (tx, ty): slower uphill. */
export function climbPace(s: GameState, u: Unit, tx: number, ty: number): number {
  const dx = tx - u.x;
  const dy = ty - u.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-4) return 1;
  const look = TERRAIN.look;
  const slope = (standAt(s, u.x + (dx / d) * look, u.y + (dy / d) * look) - standAt(s, u.x, u.y)) / look;
  if (slope <= TERRAIN.climbFrom) return 1;
  return Math.max(TERRAIN.climbMin, 1 / (1 + (slope - TERRAIN.climbFrom) * TERRAIN.climb));
}

/**
 * The highest open ground within `reach` tiles of a point, if it stands at least `gain` above the point (else null): where an army
 * waiting there should stand. Tiles are tried row by row, the first of equal height kept.
 */
export function ridgeNear(s: GameState, x: number, y: number, reach: number, gain: number): { x: number; y: number } | null {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let best: { x: number; y: number } | null = null;
  let top = standAt(s, x, y) + gain;
  for (let ty = cy - reach; ty <= cy + reach; ty++) {
    for (let tx = cx - reach; tx <= cx + reach; tx++) {
      if ((tx - cx) * (tx - cx) + (ty - cy) * (ty - cy) > reach * reach || !walkable(s, tx, ty)) continue;
      const h = standAt(s, tx + 0.5, ty + 0.5);
      if (h < top) continue;
      top = h + 1e-6;
      best = { x: tx + 0.5, y: ty + 0.5 };
    }
  }
  return best;
}

/** How many of the nine tiles round a point (its own and its eight neighbours) hold standing trees. */
export function treesRound(s: GameState, x: number, y: number): number {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  let n = 0;
  for (let yy = ty - 1; yy <= ty + 1; yy++) {
    if (yy < 0 || yy >= s.h) continue;
    for (let xx = tx - 1; xx <= tx + 1; xx++) if (xx >= 0 && xx < s.w && s.res[yy * s.w + xx] === R_TREE) n++;
  }
  return n;
}

/** Whether a point stands in a wood: at least `TERRAIN.woods` of the nine tiles round it hold standing trees. */
export const inWoods = (s: GameState, x: number, y: number): boolean => treesRound(s, x, y) >= TERRAIN.woods;

/** A land unit's pace in a wood, as a share of its own: soldiers of the line go slower among the trees, riders slowest. */
export function woodsPace(s: GameState, u: Unit): number {
  if (!TERRAIN.climbers.includes(u.type) || !inWoods(s, u.x, u.y)) return 1;
  return statsOf(s, u).cls === 'cavalry' ? TERRAIN.woodsRide : TERRAIN.woodsFoot;
}

/** A rider fighting from a wood strikes softer: no room to close up or charge. 1 for anyone else, or out of the woods. */
export function woodsBlow(s: GameState, u: Unit | null, st: UnitStats): number {
  return u && st.cls === 'cavalry' && inWoods(s, u.x, u.y) ? TERRAIN.rideBlow : 1;
}

/** Whether a unit could hide in a wood it stands in: a soldier on foot or horse, out in the open air, alive. */
function hider(u: Unit): boolean {
  return u.hp > 0 && !u.inside && TERRAIN.hiders.includes(u.type) && domainOf(u.type) === 'land';
}

/** Whether a rival sees into the wood where a unit stands: a rival unit within `TERRAIN.seen` tiles, or a rival's armed building in sight. */
function seenInWoods(s: GameState, sp: Spatial, u: Unit, watch: Building[]): boolean {
  const r = TERRAIN.seen;
  let near = false;
  sp.near(u.x, u.y, r, (o) => {
    if (near || o.hp <= 0 || !isEnemy(s, u.owner, o.owner)) return;
    const dx = o.x - u.x;
    const dy = o.y - u.y;
    if (dx * dx + dy * dy <= r * r) near = true;
  });
  if (near) return true;
  for (const b of watch) {
    if (!isEnemy(s, u.owner, b.owner)) continue;
    const reach = BUILDINGS[b.type].sight + b.size / 2;
    const dx = b.x - u.x;
    const dy = b.y - u.y;
    if (dx * dx + dy * dy <= reach * reach) return true;
  }
  return false;
}

/**
 * Forest cover (#934), read every `TERRAIN.coverEvery` ticks: a soldier standing in a wood, unseen close to and quiet lately, is hidden
 * from every rival (`Unit.cover`). A people knows its own woods: inside a rival's border nothing hides. Units in id order; a rival's
 * towers and other armed buildings (finished, standing, not sunk) watch.
 */
export function coverStep(s: GameState, sp: Spatial): void {
  if (s.tick % TERRAIN.coverEvery !== 0) return;
  let watch: Building[] | null = null;
  let land: Int8Array | null = null;
  const quiet = secs(TERRAIN.shown);
  for (const e of s.ents) {
    if (e.kind !== 'unit') continue;
    let hide = hider(e) && s.tick - e.swing >= quiet && inWoods(s, e.x, e.y);
    if (hide) {
      land ??= borderMap(s);
      const o = land[Math.floor(e.y) * s.w + Math.floor(e.x)];
      hide = o < 0 || !isEnemy(s, e.owner, o);
    }
    if (hide) {
      watch ??= s.ents.filter((b): b is Building => b.kind === 'building' && b.hp > 0 && b.built && !b.sunk && !!BUILDINGS[b.type].guns);
      hide = !seenInWoods(s, sp, e, watch);
    }
    if (hide) e.cover = true;
    else if (e.cover) delete e.cover;
  }
}

/**
 * The nearest open ground in a wood within `reach` tiles of a point, standing no lower than `floor` (or null): where an army lying in
 * wait should stand. Tiles row by row, the first of equal distance kept.
 */
export function woodsNear(s: GameState, x: number, y: number, reach: number, floor = -Infinity): { x: number; y: number } | null {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let best: { x: number; y: number } | null = null;
  let bestD = reach * reach + 1e-6;
  for (let ty = cy - reach; ty <= cy + reach; ty++) {
    for (let tx = cx - reach; tx <= cx + reach; tx++) {
      const d = (tx - cx) * (tx - cx) + (ty - cy) * (ty - cy);
      if (d >= bestD || !walkable(s, tx, ty) || !inWoods(s, tx + 0.5, ty + 0.5) || standAt(s, tx + 0.5, ty + 0.5) < floor) continue;
      bestD = d;
      best = { x: tx + 0.5, y: ty + 0.5 };
    }
  }
  return best;
}
