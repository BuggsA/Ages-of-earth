import { BUILDINGS, RUINS, TRADE } from './data';
import { landOwnerAt } from './borders';
import { isEnemy } from './world';
import type { Building, BuildingType, GameState } from './types';
import { B_BUILDING, B_GATE, B_RES, B_TERRAIN, R_NONE, T_ROCK, T_WATER } from './types';

/** Tile helpers shared by the rules, the pathfinder and the computer opponent. */

export const inBounds = (s: GameState, x: number, y: number) => x >= 0 && y >= 0 && x < s.w && y < s.h;

/**
 * How a unit passes, as the `team` argument of the tile tests: a team number for people on foot (their
 * own gates let them through), -1 for "on foot, anyone" (no gate lets them through), NAVAL for ships
 * (open water only) and AIR for aircraft (anywhere on the map).
 */
export const NAVAL = -2;
export const AIR = -3;

/**
 * Whether a tile can be crossed: on foot, nothing on it (or a gate of the walker's team); by ship, open
 * water with no fish shoal; by air, anywhere.
 */
export function walkable(s: GameState, x: number, y: number, team = -1): boolean {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
  const i = y * s.w + x;
  const b = s.block[i];
  if (team === NAVAL) return b === B_TERRAIN && s.terrain[i] === T_WATER;
  if (team === AIR) return true;
  return b === 0 || (b === B_GATE && team >= 0 && s.gateTeam[i] === team);
}

/** Open water tiles beside a footprint (a dock needs some). */
export function shoreWater(s: GameState, tx: number, ty: number, size: number): number {
  let n = 0;
  for (let y = ty - 1; y <= ty + size; y++) {
    for (let x = tx - 1; x <= tx + size; x++) {
      if (x >= tx && x < tx + size && y >= ty && y < ty + size) continue;
      if (walkable(s, x, y, NAVAL)) n++;
    }
  }
  return n;
}

export function cornerHeight(s: GameState, x: number, y: number): number {
  return s.height[y * (s.w + 1) + x];
}

/** Ground height at a point (bilinear between tile corners). */
export function groundAt(s: GameState, x: number, y: number): number {
  const cx = Math.max(0, Math.min(s.w - 0.0001, x));
  const cy = Math.max(0, Math.min(s.h - 0.0001, y));
  const ix = Math.floor(cx);
  const iy = Math.floor(cy);
  const fx = cx - ix;
  const fy = cy - iy;
  const W = s.w + 1;
  const a = s.height[iy * W + ix];
  const b = s.height[iy * W + ix + 1];
  const c = s.height[(iy + 1) * W + ix];
  const d = s.height[(iy + 1) * W + ix + 1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

export type PlaceProblem = null | 'edge' | 'water' | 'rock' | 'blocked' | 'slope' | 'shore' | 'foreign';

/** Whether a building of this type could go with its top-left corner on this tile. */
export function placeProblem(s: GameState, type: BuildingType, tx: number, ty: number, ignoreUnits = true, owner = -1): PlaceProblem {
  const n = BUILDINGS[type].size;
  if (tx < 1 || ty < 1 || tx + n > s.w - 1 || ty + n > s.h - 1) return 'edge';
  let lo = Infinity;
  let hi = -Infinity;
  for (let y = ty; y < ty + n; y++) {
    for (let x = tx; x < tx + n; x++) {
      const i = y * s.w + x;
      if (s.terrain[i] === T_WATER) return 'water';
      if (s.terrain[i] === T_ROCK) return 'rock';
      if (s.res[i] !== R_NONE || relicOnTile(s, x, y) || postOnTile(s, x, y) || ruinOnTile(s, x, y)) return 'blocked';
      // A gate may go into its owner's own wall, replacing the pieces it covers.
      if (s.bldAt[i] !== 0 && !(type === 'gate' && ownWall(s, s.bldAt[i], owner))) return 'blocked';
    }
  }
  for (let y = ty; y <= ty + n; y++) {
    for (let x = tx; x <= tx + n; x++) {
      const h = cornerHeight(s, x, y);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
  }
  // Walls follow the land (and docks the shore); everything else wants it fairly level.
  if (hi - lo > (type === 'wall' || type === 'gate' || type === 'dock' ? 2.2 : 1.1)) return 'slope';
  if (BUILDINGS[type].shore && shoreWater(s, tx, ty, n) < 3) return 'shore';
  // Borders (#132 s3): no building in an enemy's land, but a Tower may be raised there as a foothold.
  if (owner >= 0 && type !== 'tower') {
    const o = landOwnerAt(s, tx + (n >> 1), ty + (n >> 1));
    if (o >= 0 && isEnemy(s, owner, o)) return 'foreign';
  }
  void ignoreUnits;
  return null;
}

/** A relic on the ground on this tile (buildings can't go over one). */
export function relicOnTile(s: GameState, tx: number, ty: number): boolean {
  for (const r of s.relics) if (!r.carrier && !r.temple && Math.floor(r.x) === tx && Math.floor(r.y) === ty) return true;
  return false;
}

/** A trading post whose plaza (with a tile's margin round it) covers this tile: nothing is built there. */
export function postOnTile(s: GameState, tx: number, ty: number): boolean {
  const r = TRADE.plaza + 1;
  for (const p of s.posts) if (Math.abs(tx - Math.floor(p.x)) <= r && Math.abs(ty - Math.floor(p.y)) <= r) return true;
  return false;
}

/** An ancient ruin (#64) on this tile or right beside it: nothing is built there. */
export function ruinOnTile(s: GameState, tx: number, ty: number): boolean {
  if (!s.ruins) return false;
  for (const r of s.ruins) if (Math.abs(tx - Math.floor(r.x)) <= RUINS.clear && Math.abs(ty - Math.floor(r.y)) <= RUINS.clear) return true;
  return false;
}

function ownWall(s: GameState, id: number, owner: number): boolean {
  const b = s.byId.get(id);
  return !!b && b.kind === 'building' && b.type === 'wall' && b.owner === owner && owner >= 0;
}

/** Mark or clear a building's footprint on the grid. */
export function stampBuilding(s: GameState, b: Building, on: boolean): void {
  const open = BUILDINGS[b.type].open;
  // Only new blockages matter to cached distance fields: an opened tile just leaves a route a little long.
  if (!open && on) s.blockVersion++;
  const gate = b.type === 'gate';
  const team = s.players[b.owner]?.team ?? -1;
  for (let y = b.ty; y < b.ty + b.size; y++) {
    for (let x = b.tx; x < b.tx + b.size; x++) {
      const i = y * s.w + x;
      s.bldAt[i] = on ? b.id : 0;
      if (gate) {
        // A finished gate lets its own team through; a gate site blocks everyone.
        s.block[i] &= ~(B_BUILDING | B_GATE);
        s.gateTeam[i] = -1;
        if (on && b.built) {
          s.block[i] |= B_GATE;
          s.gateTeam[i] = team;
        } else if (on) s.block[i] |= B_BUILDING;
      } else if (!open) s.block[i] = on ? s.block[i] | B_BUILDING : s.block[i] & ~B_BUILDING;
    }
  }
}

/** Take a gathered-out resource off its tile. */
export function clearResource(s: GameState, tile: number): void {
  s.res[tile] = R_NONE;
  s.amount[tile] = 0;
  s.block[tile] &= ~B_RES;
}

/** Distance from a point to a building's footprint rectangle (0 inside). */
export function distToRect(px: number, py: number, b: { tx: number; ty: number; size: number }): number {
  const dx = Math.max(b.tx - px, 0, px - (b.tx + b.size));
  const dy = Math.max(b.ty - py, 0, py - (b.ty + b.size));
  return Math.sqrt(dx * dx + dy * dy);
}

/** Distance from a point to a tile square. */
export function distToTile(px: number, py: number, tile: number, w: number): number {
  return distToRect(px, py, { tx: tile % w, ty: Math.floor(tile / w), size: 1 });
}

/** The nearest walkable tile to a point (searching outward in rings), or -1. */
export function nearestWalkable(s: GameState, x: number, y: number, maxR = 12, team = -1): number {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (walkable(s, cx, cy, team)) return cy * s.w + cx;
  let best = -1;
  let bestD = Infinity;
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = cx + dx;
        const ty = cy + dy;
        if (!walkable(s, tx, ty, team)) continue;
        const ddx = tx + 0.5 - x;
        const ddy = ty + 0.5 - y;
        const d = ddx * ddx + ddy * ddy;
        if (d < bestD) {
          bestD = d;
          best = ty * s.w + tx;
        }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

/** Whether a tile has a walkable neighbor (so it can be reached to gather from). */
export function reachableTile(s: GameState, tile: number): boolean {
  const x = tile % s.w;
  const y = Math.floor(tile / s.w);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && walkable(s, x + dx, y + dy)) return true;
  return false;
}

/** Straight-line walkability between two points, through the tiles the segment touches. */
export function lineClear(s: GameState, x0: number, y0: number, x1: number, y1: number, team = -1): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-6) return walkable(s, Math.floor(x0), Math.floor(y0), team);
  const steps = Math.ceil(len * 3);
  // Also check a little to each side, so routes don't scrape past corners.
  const nx = (-dy / len) * 0.22;
  const ny = (dx / len) * 0.22;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    if (!walkable(s, Math.floor(px), Math.floor(py), team)) return false;
    if (!walkable(s, Math.floor(px + nx), Math.floor(py + ny), team)) return false;
    if (!walkable(s, Math.floor(px - nx), Math.floor(py - ny), team)) return false;
  }
  return true;
}
