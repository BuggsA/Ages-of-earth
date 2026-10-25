import { CONVOY, LIGHTHOUSE, PRIZE } from './data';
import { ageDef, asleep } from './ages';
import { statsOf } from './world';
import type { GameState, Unit } from './types';

/**
 * What a merchant ship's cargo is multiplied by as it loads: `CONVOY.pay` with an own warship within `CONVOY.reach` (the Age of Sail,
 * or on any road when it trades from the Dock kept as the Sail's keepsake, #555 s11), else `LIGHTHOUSE.pay` within reach of a lit Lighthouse, else 1.
 */
export function convoyShare(s: GameState, ship: Unit, dock?: { keep?: string }): number {
  if (!ageDef(s.players[ship.owner]).convoys && dock?.keep !== 'sail') return 1;
  const r2 = CONVOY.reach * CONVOY.reach;
  const l2 = LIGHTHOUSE.reach * LIGHTHOUSE.reach;
  let lit = false;
  for (const e of s.ents) {
    if (e.kind === 'building' && e.type === 'lighthouse' && e.built && e.hp > 0 && s.players[e.owner].team === s.players[ship.owner].team && !asleep(s, e)) {
      if ((e.x - ship.x) * (e.x - ship.x) + (e.y - ship.y) * (e.y - ship.y) <= l2) lit = true;
      continue;
    }
    if (e.kind !== 'unit' || e.owner !== ship.owner || e.hp <= 0 || e.inside > 0 || e.id === ship.id) continue;
    if (e.type !== 'warship' || statsOf(s, e).attack <= 0) continue;
    if ((e.x - ship.x) * (e.x - ship.x) + (e.y - ship.y) * (e.y - ship.y) <= r2) return CONVOY.pay;
  }
  return lit ? LIGHTHOUSE.pay : 1;
}

/** The gold a sunk merchant ship's killer keeps: `PRIZE.share` of its cargo, if the killer's people are in the Age of Sail. */
export function prizeOf(s: GameState, target: Unit, by: number): number {
  if (target.type !== 'cog' || target.carryRes !== 'gold' || target.carry <= 0) return 0;
  if (!ageDef(s.players[by]).prizes) return 0;
  return Math.floor(target.carry * PRIZE.share);
}
