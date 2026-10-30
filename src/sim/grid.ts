import { ventSpot } from './forge';
import { hallowed } from './henge';
import { BUILDINGS, LANDMARKS, RUINS, TRADE } from './data';
import { ageDef } from './ages';
import { landOwnerAt } from './borders';
import { isEnemy } from './world';
import { snareSpot } from './snares';
import { hiveSpot } from './hive';
import { bridgeSpot, dykeSpot, isChannel, isDug, isInund, parched } from './water';
import { bared, causewaySpot, cocklerSpot } from './tides';
import { tideGateSpot } from './tides';
import { adrift, pontoonSpot } from './floating';
import type { Building, BuildingType, GameState } from './types';
import { B_BUILDING, B_GATE, B_RES, B_TERRAIN, R_BLOODIRON, R_GOLD, R_NONE, R_SALT, R_SALTPETRE, R_STONE, T_ROCK, T_WATER } from './types';

/** Tile helpers shared by the rules, the pathfinder and the computer opponent. */

export const inBounds = (s: GameState, x: number, y: number) => x >= 0 && y >= 0 && x < s.w && y < s.h;

/**
 * How a unit passes, as the `team` argument of the tile tests: a team number for people on foot (their
 * own gates let them through), -1 for "on foot, anyone" (no gate lets them through), NAVAL for ships
 * (open water only) and AIR for aircraft (anywhere on the map).
 */
export const NAVAL = -2;
export const AIR = -3;
/** A shallow boat (the gun-barge, #701 s4): open water as a ship sails it, and the wadeable water too (channels, a sluice's flood). */
export const BARGE = -4;

/**
 * Whether a tile can be crossed: on foot, nothing on it (or a gate of the walker's team); by ship, open
 * water with no fish shoal; by air, anywhere.
 */
export function walkable(s: GameState, x: number, y: number, team = -1): boolean {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
  const i = y * s.w + x;
  const b = s.block[i];
  if (team === NAVAL) return sails(s, i);
  if (team === BARGE) return s.terrain[i] === T_WATER && (b === B_TERRAIN || b === 0 || (b === B_GATE && lock(s, i)));
  if (team === AIR) return true;
  return b === 0 || (b === B_GATE && team >= 0 && s.gateTeam[i] === team);
}

/**
 * Whether a finished sluice stands on this tile (#701 s4): a gun-barge passes through it, as through a lock. So it does under a finished
 * bridge (#701 s5), as every ship does.
 */
export function lock(s: GameState, i: number): boolean {
  const b = s.byId.get(s.bldAt[i]);
  return !!b && b.kind === 'building' && (b.type === 'sluice' || b.type === 'bridge') && b.built && b.hp > 0;
}

/** Whether a finished bridge stands on this tile (#701 s5): it swings for ships. */
export function underBridge(s: GameState, i: number): boolean {
  const b = s.byId.get(s.bldAt[i]);
  return !!b && b.kind === 'building' && b.type === 'bridge' && b.built && b.hp > 0;
}

/**
 * Whether a ship sails this tile: open water (`B_TERRAIN` water with nothing on it), a canal (#701 s5: water a people dug deep, no
 * `B_TERRAIN`, that land units swim), or under a finished bridge. The path fields (`path.ts`) read the same test.
 */
export function sails(s: GameState, i: number): boolean {
  if (s.terrain[i] !== T_WATER) return false;
  const b = s.block[i];
  if (b === B_TERRAIN) return true;
  if (!s.channel || s.channel[i] !== 2) return false;
  return b === 0 || (b === B_GATE && underBridge(s, i));
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

export type PlaceProblem = null | 'hallowed' | 'edge' | 'water' | 'rock' | 'blocked' | 'slope' | 'shore' | 'foreign' | 'woods' | 'snares' | 'deep' | 'dry' | 'parched' | 'bare' | 'hives' | 'tidal' | 'adrift' | 'beds' | 'barrage' | 'vent' | 'hot';

/** Whether a building of this type could go with its top-left corner on this tile. */
export function placeProblem(s: GameState, type: BuildingType, tx: number, ty: number, ignoreUnits = true, owner = -1): PlaceProblem {
  const n = BUILDINGS[type].size;
  if (tx < 1 || ty < 1 || tx + n > s.w - 1 || ty + n > s.h - 1) return 'edge';
  let lo = Infinity;
  let hi = -Infinity;
  // The computer asks this of hundreds of tiles a search; most are nowhere near a relic, post, ruin or landmark.
  const near = keepClearNear(s, tx, ty, n);
  // A Tide Gate (#785) goes on a causeway tile of its owner's barrage, beside the pond, and nowhere else.
  if (type === 'tidegate') return tideGateSpot(s, tx, ty, owner);
  // A dyke (#701) goes on shallow water, or on the shore beside it; so does a sluice (#701 s4), on a channel too, or into its own dyke line.
  // A dam (#701 s5) goes where a sluice does; a bridge over water a people dug, and a channel, in the Age of Locks, over an old channel
  // to dig it deep.
  const dyke = type === 'dyke' || type === 'sluice' || type === 'dam';
  if (dyke) {
    const why = dykeSpot(s, tx, ty);
    if (why) return why;
  }
  if (type === 'bridge') {
    const why = bridgeSpot(s, tx, ty);
    if (why) return why;
  }
  const deepen = type === 'channel' && owner >= 0 && !!s.players[owner] && !!ageDef(s.players[owner]).canals;
  // A causeway (#739) goes on the shallow sea or the tidal flats; nothing else is raised on ground the tide comes back to.
  const cause = type === 'causeway';
  if (cause) {
    const why = causewaySpot(s, tx, ty);
    if (why) return why;
  }
  // A Pontoon (#770) is moored on open water a ship sails, and nowhere else.
  const float = type === 'pontoon';
  if (float) {
    const why = pontoonSpot(s, tx, ty, n);
    if (why) return why;
  }
  for (let y = ty; y < ty + n; y++) {
    for (let x = tx; x < tx + n; x++) {
      const i = y * s.w + x;
      if (!cause && !dyke && bared(s, i)) return 'tidal';
      if (s.terrain[i] === T_WATER && !cause && !float && ((!dyke && type !== 'bridge' && !(deepen && isChannel(s, i))) || isInund(s, i))) return 'water';
      if (s.terrain[i] === T_ROCK) return 'rock';
      if (s.res[i] !== R_NONE || (near && (relicOnTile(s, x, y) || postOnTile(s, x, y) || ruinOnTile(s, x, y) || landmarkOnTile(s, x, y)))) return 'blocked';
      // A gate may go into its owner's own wall, replacing the pieces it covers.
      if (s.bldAt[i] !== 0 && !(type === 'gate' && ownWall(s, s.bldAt[i], owner)) && !(type === 'sluice' && ownDyke(s, s.bldAt[i], owner))) return 'blocked';
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
  if (!float && hi - lo > (type === 'wall' || type === 'gate' || type === 'dock' || type === 'channel' || type === 'bridge' || dyke || cause ? 2.2 : 1.1)) return 'slope';
  if (BUILDINGS[type].shore && shoreWater(s, tx, ty, n) < 3) return 'shore';
  // A Snare goes only among standing trees, and apart from the others (#485).
  if (type === 'snare') {
    const why = snareSpot(s, tx, ty);
    if (why) return why;
  }
  // A Hive goes only among standing trees, and apart from the others (the Age of the Hive).
  if (type === 'hive') {
    const why = hiveSpot(s, tx, ty);
    if (why) return why;
  }
  // A Cockler's Hut (#779) goes only by the cockle beds.
  if (type === 'cockler') {
    const why = cocklerSpot(s, tx, ty, n);
    if (why) return why;
  }
  // The Age of Rivers (#701): its fields go only by water.
  if (type === 'farm' && owner >= 0 && parched(s, owner, tx, ty, n)) return 'parched';
  // A rival's Henge (#877) holds its ring: nothing at all is raised in it, not even a Tower or a War Camp.
  if (owner >= 0 && hallowed(s, owner, tx, ty, n)) return 'hallowed';
  // Borders (#132 s3): no building in an enemy's land, but a Tower may be raised there as a foothold,
  // and a War Camp pitched where the army stands (#303).
  if (owner >= 0 && type !== 'tower' && type !== 'warcamp') {
    const o = landOwnerAt(s, tx + (n >> 1), ty + (n >> 1));
    if (o >= 0 && isEnemy(s, owner, o)) return 'foreign';
  }
  // A vent (#884) takes a Vent Forge over it; once a people is on the Deep Road, nothing else goes on it or the ground round it.
  const hot = ventSpot(s, type, tx, ty, n);
  if (hot) return hot;
  // A spring head (#701) is left open, for the channel dug from it.
  if (s.springs) for (const t of s.springs) if (t % s.w >= tx && t % s.w < tx + n && Math.floor(t / s.w) >= ty && Math.floor(t / s.w) < ty + n) return 'blocked';
  // Its builders need a foothold beside it, the shore or a deck of their own; a tow moors anywhere (`pitchSpot` lets this one pass).
  if (float && owner >= 0 && adrift(s, owner, tx, ty, n)) return 'adrift';
  void ignoreUnits;
  return null;
}

/** Whether a relic, trading post, ruin or landmark keeps any tile of this n-by-n square clear: the tile-by-tile checks below, asked once for the whole square. */
function keepClearNear(s: GameState, tx: number, ty: number, n: number): boolean {
  for (const r of s.relics) if (!r.carrier && !r.temple && inBox(r.x, r.y, 0, tx, ty, n)) return true;
  for (const p of s.posts) if (inBox(p.x, p.y, TRADE.plaza + 1, tx, ty, n)) return true;
  if (s.ruins) for (const r of s.ruins) if (inBox(r.x, r.y, RUINS.clear, tx, ty, n)) return true;
  if (s.landmarks) for (const m of s.landmarks) if (inBox(m.x, m.y, LANDMARKS.clear, tx, ty, n)) return true;
  return false;
}

/** Whether the tile under a point, grown by `r` tiles each way, overlaps the n-by-n square at (tx, ty). */
function inBox(px: number, py: number, r: number, tx: number, ty: number, n: number): boolean {
  const x = Math.floor(px);
  const y = Math.floor(py);
  return x - r <= tx + n - 1 && x + r >= tx && y - r <= ty + n - 1 && y + r >= ty;
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

/** A contested landmark on this tile or right beside it: nothing is built there. */
export function landmarkOnTile(s: GameState, tx: number, ty: number): boolean {
  if (!s.landmarks) return false;
  for (const m of s.landmarks) if (Math.abs(tx - Math.floor(m.x)) <= LANDMARKS.clear && Math.abs(ty - Math.floor(m.y)) <= LANDMARKS.clear) return true;
  return false;
}

/** An ancient ruin (#64) on this tile or right beside it: nothing is built there. */
export function ruinOnTile(s: GameState, tx: number, ty: number): boolean {
  if (!s.ruins) return false;
  for (const r of s.ruins) if (Math.abs(tx - Math.floor(r.x)) <= RUINS.clear && Math.abs(ty - Math.floor(r.y)) <= RUINS.clear) return true;
  return false;
}

/** A finished dyke of this owner's: a sluice may take its place in the line (#701 s4). */
function ownDyke(s: GameState, id: number, owner: number): boolean {
  const b = s.byId.get(id);
  return !!b && b.kind === 'building' && b.type === 'dyke' && b.built && b.owner === owner && owner >= 0;
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
  // A dyke (#701) is a gate along its whole length: its own team walks its crown, over water too, and nothing else passes.
  // So is a dam, and a bridge (#701 s5) for those who walk it; a ship passes under a bridge (`sails`). So is a Pontoon's deck (#770).
  const dyke = b.type === 'dyke' || b.type === 'sluice' || b.type === 'dam' || b.type === 'bridge' || b.type === 'pontoon' || b.type === 'tidegate';
  // A Thornwall (the Age of the Grove) parts for its own team as a gate does.
  const gate = b.type === 'gate' || b.type === 'thornwall' || dyke;
  if (dyke) s.blockVersion++;
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
        // Water or rock under a dyke is crossed while it stands, and is water or rock again once it is gone.
        if (dyke) s.block[i] = on && b.built ? s.block[i] & ~B_TERRAIN : (s.terrain[i] === T_WATER && !isDug(s, i)) || s.terrain[i] === T_ROCK ? s.block[i] | B_TERRAIN : s.block[i];
      } else if (!open) s.block[i] = on ? s.block[i] | B_BUILDING : s.block[i] & ~B_BUILDING;
    }
  }
}

/** Take a gathered-out resource off its tile. */
export function clearResource(s: GameState, tile: number): void {
  // A worked-out stone, gold or rare-ore deposit leaves old workings, where a Mine Shaft digs best (#681).
  const k = s.res[tile];
  if (k === R_STONE || k === R_GOLD || k === R_SALT || k === R_SALTPETRE || k === R_BLOODIRON) (s.spent ??= new Uint8Array(s.w * s.h))[tile] = k;
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
