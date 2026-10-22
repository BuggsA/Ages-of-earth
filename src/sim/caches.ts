import { BUILDINGS, CACHE, TICK_HZ } from './data';
import { distToRect, nearestWalkable } from './grid';
import type { Building, GameState, OreCache, RareId, Unit } from './types';

/**
 * Take it back (#570, the age road s3): key ore mined and paid in is kept in the people's ore stores (the Town Center and
 * Storehouses, the buildings that take stone in), and it is safe there only while they stand. A store that falls spills
 * `CACHE.share` of each ore the people holds, split across its stores standing, as a cache round the rubble; a fallen
 * digger drops its basket, a fallen carrier its load. Any people's citizens lift it, `CACHE.load` at a time, and bank it at
 * their own store. What spills is taken off the loser's ore door; what is carried home counts toward the taker's.
 */

const ORES: RareId[] = ['salt', 'saltpetre', 'bloodiron'];

export const cacheAt = (s: GameState, id: number): OreCache | undefined => s.caches?.find((c) => c.id === id);

/** Whether a building keeps its people's key ore: a finished land building that takes stone in. */
export const storesOre = (b: Building): boolean => b.built && b.type !== 'dock' && BUILDINGS[b.type].drop.includes('stone');

/** Lay key ore down near a point, on open ground, joined to a cache of the same ore from the same people lying close by. At sea with no shore near, it sinks. */
export function spill(s: GameState, ore: RareId, amount: number, x: number, y: number, from: number): void {
  const n = Math.floor(amount);
  if (n < 1) return;
  const tile = nearestWalkable(s, x, y, 12);
  if (tile < 0) return;
  const cx = (tile % s.w) + 0.5;
  const cy = Math.floor(tile / s.w) + 0.5;
  const near = s.caches?.find((c) => c.ore === ore && c.from === from && Math.abs(c.x - cx) <= CACHE.merge && Math.abs(c.y - cy) <= CACHE.merge);
  if (near) near.n += n;
  else (s.caches ??= []).push({ id: s.nextId++, x: cx, y: cy, ore, n, from });
  s.events.push({ k: 'cache', owner: from, from, ore, n, x: cx, y: cy, what: 'spilled' });
}

/** An ore store fell (still in the state, its footprint cleared): its share of each ore its people holds spills round the rubble. */
export function spillStore(s: GameState, b: Building): void {
  const p = s.players[b.owner];
  if (!p.rare || !storesOre(b)) return;
  let stores = 1;
  for (const e of s.ents) if (e.kind === 'building' && e.id !== b.id && e.owner === b.owner && e.hp > 0 && storesOre(e)) stores++;
  let k = 0;
  for (const ore of ORES) {
    const have = p.rare[ore] ?? 0;
    const n = Math.floor((have * CACHE.share) / stores);
    if (n < 1) continue;
    p.rare[ore] = have - n;
    // Taken off the ore door too: the road it was dug for is that much further off.
    const mined = p.stats.mined;
    if (mined?.[ore]) mined[ore] = Math.max(0, mined[ore]! - n);
    spill(s, ore, n, b.x + k - 1, b.y + b.size / 2, b.owner);
    k++;
  }
}

/** A fallen unit lets go of the key ore it carries: a cache's load, or a digger's basket. */
export function dropOre(s: GameState, u: Unit): void {
  if (u.ore) {
    spill(s, u.ore.id, u.ore.n, u.x, u.y, u.ore.from);
    delete u.ore;
  }
  if (u.carry > 0 && u.carryRare) {
    spill(s, u.carryRare, u.carry, u.x, u.y, u.owner);
    u.carry = 0;
  }
}

/** A citizen lifts a load from a cache. */
export function lift(s: GameState, u: Unit, c: OreCache): void {
  const n = Math.min(c.n, CACHE.load);
  u.ore = { id: c.ore, n, from: c.from };
  c.n -= n;
  if (c.n <= 0) {
    s.caches = s.caches!.filter((q) => q !== c);
    if (!s.caches.length) delete s.caches;
  }
  s.events.push({ k: 'cache', owner: u.owner, from: c.from, ore: c.ore, n, x: c.x, y: c.y, what: 'taken' });
}

/** What a citizen carries is paid into its people's stock, and counts as mined toward its ore doors. */
export function bank(s: GameState, u: Unit): void {
  const o = u.ore;
  if (!o) return;
  const p = s.players[u.owner];
  const stock = (p.rare ??= {});
  stock[o.id] = (stock[o.id] ?? 0) + o.n;
  const mined = (p.stats.mined ??= {});
  mined[o.id] = (mined[o.id] ?? 0) + o.n;
  if (o.from !== u.owner) p.stats.seized = (p.stats.seized ?? 0) + o.n;
  s.events.push({ k: 'cache', owner: u.owner, from: o.from, ore: o.id, n: o.n, x: u.x, y: u.y, what: 'kept' });
  delete u.ore;
}

/** The unit's people's ore store within `CACHE.bank` tiles of it, if any. */
function storeNear(s: GameState, u: Unit): Building | null {
  for (const e of s.ents) if (e.kind === 'building' && e.owner === u.owner && e.hp > 0 && storesOre(e) && distToRect(u.x, u.y, e) <= CACHE.bank) return e;
  return null;
}

/** Ore a people's citizens carry and have not banked yet. */
export function carriedOre(s: GameState, owner: number): number {
  let n = 0;
  for (const e of s.ents) if (e.kind === 'unit' && e.owner === owner && e.hp > 0 && e.ore) n += e.ore.n;
  return n;
}

/** Once a second, in id order: a citizen carrying ore beside one of its people's ore stores banks it, whatever its order. */
export function cacheStep(s: GameState): void {
  if (s.tick === 0 || s.tick % TICK_HZ !== 0) return;
  for (const u of s.ents) if (u.kind === 'unit' && u.ore && u.hp > 0 && storeNear(s, u)) bank(s, u);
}
