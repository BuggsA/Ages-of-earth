import { SPOILS, TICK_HZ } from './data';
import { ageDef } from './ages';
import { distToRect } from './grid';
import type { Building, GameState, Unit } from './types';

/**
 * Spoils (#502), the Age of the Warband's own verb: its plunder is not paid where the enemy falls but carried. The soldier who
 * lands the killing blow packs the gold (`SPOILS.cap` at most) and the people only has it once that soldier walks within
 * `SPOILS.bank` tiles of a Town Center or Barracks. A rival who fells a laden soldier takes everything in its pack.
 */

/** Whether `owner`'s age hauls its plunder home rather than paying it at once. */
export const hauls = (s: GameState, owner: number): boolean => !!ageDef(s.players[owner]).haul;

/** A kill by `credit` earns `gold`: pack what fits, leave the rest. Returns whether it was packed (false: pay it at once). */
export function pack(s: GameState, credit: Unit | null, by: number, gold: number): boolean {
  if (!credit || credit.hp <= 0 || credit.owner !== by || !hauls(s, by)) return false;
  credit.spoils = Math.min(SPOILS.cap, (credit.spoils ?? 0) + gold);
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

/** Total spoils the people's soldiers carry, and how many soldiers carry any. */
export function carried(s: GameState, owner: number): { gold: number; n: number } {
  let gold = 0;
  let n = 0;
  for (const e of s.ents) if (e.kind === 'unit' && e.owner === owner && e.hp > 0 && e.spoils) { gold += e.spoils; n++; }
  return { gold, n };
}

/** Once a second, in id order: a soldier at home banks its pack; a people that leaves the age banks every pack where it stands. */
export function spoilsStep(s: GameState): void {
  if (s.tick === 0 || s.tick % TICK_HZ !== 0) return;
  for (const u of s.ents) {
    if (u.kind !== 'unit' || !u.spoils || u.hp <= 0) continue;
    const kept = hauls(s, u.owner);
    if (kept && !homeNear(s, u)) continue;
    const p = s.players[u.owner];
    p.res.gold += u.spoils;
    p.stats.plunder = (p.stats.plunder ?? 0) + u.spoils;
    s.events.push({ k: 'plunder', owner: u.owner, x: u.x, y: u.y, gold: u.spoils });
    delete u.spoils;
  }
}
