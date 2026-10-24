import { BEGGARS, domainOf } from './data';
import { ageDef, asleep } from './ages';
import type { Building, GameState, Unit } from './types';
import { statsOf } from './world';

/**
 * The Age of the Sea Beggars (#783, s8 of the Water Road): ships boarded and taken rather than sunk, and dykes cut from the sea.
 * A crossing of the Age of Dykes and the Age of Sail.
 */

/** Whether `by`'s people boards a ship beaten down at (x, y): in the age (or a Golden Age woven with it), or within its kept Dock's haven. */
export function boardsAt(s: GameState, by: number, x: number, y: number): boolean {
  const p = s.players[by];
  if (!p) return false;
  if (ageDef(p).boards) return true;
  const r2 = BEGGARS.haven * BEGGARS.haven;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== by || e.keep !== 'beggars' || !e.built || e.hp <= 0 || asleep(s, e)) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

/**
 * A rival ship `credit` (a ship of `by`'s) has just beaten to nothing: boarded and taken instead of sunk, when `by` boards there. It keeps
 * `BEGGARS.left` of its health and whatever it carries, and forgets its orders. A district under tow, or a ship with soldiers aboard (they
 * fight to the last), goes down as any other. Returns whether it was taken.
 */
export function board(s: GameState, target: Unit, by: number, credit: Unit | null): boolean {
  if (by === target.owner || !credit || credit.owner !== by || credit.hp <= 0 || domainOf(credit.type) !== 'water') return false;
  if (domainOf(target.type) !== 'water' || target.type === 'tow' || target.cargo.length > 0) return false;
  if (!boardsAt(s, by, target.x, target.y)) return false;
  const from = target.owner;
  target.owner = by;
  target.hp = Math.max(1, statsOf(s, target).hp * BEGGARS.left);
  target.queue = [];
  // Its orders are forgotten, as `setOrder` forgets them.
  target.order = { k: 'idle' };
  target.path = null;
  target.goal = null;
  target.wantPath = false;
  target.stuck = 0;
  target.miss = 0;
  target.ashore = undefined;
  target.resume = null;
  target.hurt = s.tick;
  const p = s.players[by];
  p.stats.boarded = (p.stats.boarded ?? 0) + 1;
  s.events.push({ k: 'boarded', id: target.id, from, to: by, x: target.x, y: target.y, type: target.type });
  return true;
}

/**
 * The ship a shot's splash is credited to for boarding (#783): its shooter, when that is a ship of a people that boards somewhere (the age, or a
 * kept Dock); otherwise null, so splash credits no one, as before.
 */
export function boarder(s: GameState, shooter: Unit | null): Unit | null {
  if (!shooter || domainOf(shooter.type) !== 'water') return null;
  const p = s.players[shooter.owner];
  if (p && ageDef(p).boards) return shooter;
  return s.ents.some((e) => e.kind === 'building' && e.owner === shooter.owner && e.keep === 'beggars') ? shooter : null;
}

/** How hard a ship of `owner`'s strikes a water-work (dyke, sluice, dam, causeway): `BEGGARS.cut` for a boarding people, else 0 (the usual wall rule). */
export function cuts(s: GameState, owner: number, b: Building): number {
  if (b.type !== 'dyke' && b.type !== 'sluice' && b.type !== 'dam' && b.type !== 'causeway') return 0;
  const p = s.players[owner];
  return p && ageDef(p).boards ? BEGGARS.cut : 0;
}
