import { SEA_RAID, SPOILS, STRAND, TICK_HZ, domainOf } from './data';
import { ageDef } from './ages';
import { distToRect } from './grid';
import type { Building, GameState, Unit } from './types';

/**
 * Spoils (#502), the Age of the Warband's own verb: its plunder is not paid where the enemy falls but carried. The soldier who
 * lands the killing blow packs the gold (`SPOILS.cap` at most) and the people only has it once that soldier walks within
 * `SPOILS.bank` tiles of a Town Center or Barracks. A rival who fells a laden soldier takes everything in its pack.
 *
 * The Age of Sea-Raiders (#585) hauls to the ships instead: a soldier's pack goes into the hold of a transport of its people it comes
 * within `SPOILS.bank` tiles of (or rides in), and a ship's hold (its own `spoils`, up to `SEA_RAID.hold`) is banked within `SEA_RAID.dock`
 * tiles of a Dock (or, for `STRAND.cut` of it, of a Raiders' Strand, #727). Town Centers and Barracks bank nothing. A ship sunk pays its hold to the one who sank it, as a felled soldier does.
 */

/** Whether `owner`'s age hauls its plunder rather than paying it at once: the Warband home, the Sea-Raiders to their ships. */
export const hauls = (s: GameState, owner: number): boolean => !!ageDef(s.players[owner]).haul || raids(s, owner);

/** Whether `owner`'s age banks its plunder by ship (#585). */
export const raids = (s: GameState, owner: number): boolean => !!ageDef(s.players[owner]).raid;

/** The most plunder a unit carries: a Sea-Raider ship's hold, else a pack. */
const capOf = (s: GameState, u: Unit): number => (domainOf(u.type) === 'water' && raids(s, u.owner) ? SEA_RAID.hold : SPOILS.cap);

/** A kill by `credit` earns `gold`: pack what fits, leave the rest. Returns whether it was packed (false: pay it at once). */
export function pack(s: GameState, credit: Unit | null, by: number, gold: number): boolean {
  if (!credit || credit.hp <= 0 || credit.owner !== by || !hauls(s, by)) return false;
  credit.spoils = Math.min(capOf(s, credit), (credit.spoils ?? 0) + gold);
  return true;
}

/** Gold a fallen unit's pack pays the one who felled it, if it was laden and the killer is its rival. */
export function looted(u: Unit, by: number): number {
  return by !== u.owner && u.spoils ? u.spoils : 0;
}

/** The home building (Town Center or Barracks, finished) of the unit's people within `SPOILS.bank` tiles of it, if any. */
function homeNear(s: GameState, u: Unit): Building | null {
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== u.owner || !e.built || e.hp <= 0 || !SPOILS.homes.includes(e.type)) continue;
    if (distToRect(u.x, u.y, e) <= SPOILS.bank) return e;
  }
  return null;
}

/** A finished Spoils Stockade (#727) of the unit's people within `SPOILS.bank` tiles of it, if any: a forward bank that keeps a quarter. */
function stockadeNear(s: GameState, u: Unit): Building | null {
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== u.owner || !e.built || e.hp <= 0 || e.type !== 'stockade') continue;
    if (distToRect(u.x, u.y, e) <= SPOILS.bank) return e;
  }
  return null;
}

/**
 * A finished Dock of the ship's people within `SEA_RAID.dock` tiles of it (#585), if any, else a Raiders' Strand (#727) within the same
 * reach, which banks only `STRAND.cut` of the hold.
 */
function dockNear(s: GameState, u: Unit): { b: Building; cut: number } | null {
  let strand: Building | null = null;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== u.owner || !e.built || e.hp <= 0 || (e.type !== 'dock' && e.type !== 'strand')) continue;
    if (distToRect(u.x, u.y, e) > SEA_RAID.dock) continue;
    if (e.type === 'dock') return { b: e, cut: 1 };
    strand ??= e;
  }
  return strand ? { b: strand, cut: STRAND.cut } : null;
}

/**
 * The transport a Sea-Raider soldier hands its pack into (#585): the one it rides in, else the nearest of its people's within
 * `SPOILS.bank` tiles with room in the hold (ties to the lower id).
 */
export function holdFor(s: GameState, u: Unit): Unit | null {
  const room = (t: Unit) => (t.spoils ?? 0) < SEA_RAID.hold;
  const rides = u.inside ? s.byId.get(u.inside) : undefined;
  if (rides && rides.kind === 'unit' && rides.type === 'transport' && rides.hp > 0) return room(rides) ? rides : null;
  let best: Unit | null = null;
  let bestD = SPOILS.bank * SPOILS.bank;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.owner !== u.owner || e.type !== 'transport' || e.hp <= 0 || !room(e)) continue;
    const d = (e.x - u.x) * (e.x - u.x) + (e.y - u.y) * (e.y - u.y);
    if (d <= bestD && (!best || d < bestD)) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

/** Banks a unit's pack or hold where it stands. */
function bank(s: GameState, u: Unit, cut = 1): void {
  const p = s.players[u.owner];
  const gold = Math.round(u.spoils! * cut);
  p.res.gold += gold;
  p.stats.plunder = (p.stats.plunder ?? 0) + gold;
  s.events.push({ k: 'plunder', owner: u.owner, x: u.x, y: u.y, gold });
  delete u.spoils;
}

/** A Sea-Raider's plunder, once a second (#585): a ship at a Dock banks its hold; a soldier by a ship (or aboard) hands its pack in. */
function raidStep(s: GameState, u: Unit): void {
  if (domainOf(u.type) === 'water') {
    const at = dockNear(s, u);
    if (at) bank(s, u, at.cut);
    return;
  }
  const ship = holdFor(s, u);
  if (!ship) return;
  const n = Math.min(u.spoils!, SEA_RAID.hold - (ship.spoils ?? 0));
  ship.spoils = (ship.spoils ?? 0) + n;
  u.spoils! -= n;
  if (u.spoils! <= 0) delete u.spoils;
  s.events.push({ k: 'stow', owner: u.owner, x: u.x, y: u.y, gold: n, ship: ship.id });
}

/** Total spoils the people's soldiers carry, and how many soldiers carry any. */
export function carried(s: GameState, owner: number): { gold: number; n: number } {
  let gold = 0;
  let n = 0;
  for (const e of s.ents) if (e.kind === 'unit' && e.owner === owner && e.hp > 0 && e.spoils) { gold += e.spoils; n++; }
  return { gold, n };
}

/** Once a second, in id order: a soldier at home banks its pack (a Sea-Raider's goes by ship); a people that leaves the age banks every pack where it stands. */
export function spoilsStep(s: GameState): void {
  if (s.tick === 0 || s.tick % TICK_HZ !== 0) return;
  for (const u of s.ents) {
    if (u.kind !== 'unit' || !u.spoils || u.hp <= 0) continue;
    if (raids(s, u.owner)) {
      raidStep(s, u);
      // A Golden Age (#703) that weaves the Warband too banks a pack at home as well as by ship.
      if (!u.spoils || !ageDef(s.players[u.owner]).haul || !homeNear(s, u)) continue;
    }
    if (hauls(s, u.owner)) {
      if (homeNear(s, u)) bank(s, u);
      else if (stockadeNear(s, u)) bank(s, u, SPOILS.stockadeCut);
      continue;
    }
    bank(s, u);
  }
}
