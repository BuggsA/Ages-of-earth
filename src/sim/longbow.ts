import { CIVS, LONGBOW, secs, unitStats, type UnitStats } from './data';
import type { GameState, Unit } from './types';

/**
 * The set line (#501, the Britons): a bowman of a longbow people who has stood still `LONGBOW.after` seconds is set. A set bowman
 * draws the longbow to the full (`LONGBOW.range` farther, `LONGBOW.attack` harder) until he takes a step. `longbowStep` notes
 * where each bowman rests; `isSet` reads it; `statsOf` (`world.ts`) then hands back the set numbers.
 */

/** Whether a unit is a bowman the set line applies to: a longbow people's ranged soldier (siege is its own class). */
export const bowman = (s: GameState, u: Unit): boolean => unitStats(u.type, 0).cls === 'ranged' && !!CIVS[s.players[u.owner].civ].longbow;

/** Whether a bowman has stood still long enough to be set. */
export const isSet = (s: GameState, u: Unit): boolean => !!u.rest && s.tick - u.rest.at >= secs(LONGBOW.after) && bowman(s, u);

/** A bowman's numbers once set: the reach and the blow of the full draw. */
const setCache = new WeakMap<UnitStats, UnitStats>();
export function setStats(st: UnitStats): UnitStats {
  let r = setCache.get(st);
  if (!r) {
    r = { ...st, range: st.range + LONGBOW.range, attack: st.attack + LONGBOW.attack, sight: Math.max(st.sight, st.range + LONGBOW.range + 1) };
    setCache.set(st, r);
  }
  return r;
}

/** Run each tick: a longbow people's bowmen note where they stand; any step restarts the count. */
export function longbowStep(s: GameState): void {
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || !bowman(s, e)) continue;
    if (!e.rest || e.rest.x !== e.x || e.rest.y !== e.y) e.rest = { x: e.x, y: e.y, at: s.tick };
  }
}
