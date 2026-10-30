import { TERRAIN, domainOf, type UnitStats } from './data';
import { groundAt, walkable } from './grid';
import type { Ent, GameState, Unit } from './types';

/**
 * The lay of the land t1: high ground (#925, `docs/lay-of-the-land.md`). Shooting down reaches further and shooting up falls
 * short; a unit on a rise sees further; climbing is slow. Every number is `TERRAIN`'s.
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
