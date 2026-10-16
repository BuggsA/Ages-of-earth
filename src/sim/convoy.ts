import { CONVOY } from './data';
import { ageDef } from './ages';
import { statsOf } from './world';
import type { GameState, Unit } from './types';

/** What a merchant ship's cargo is multiplied by as it loads: `CONVOY.pay` with an own warship within `CONVOY.reach` (the Age of Sail), else 1. */
export function convoyShare(s: GameState, ship: Unit): number {
  if (!ageDef(s.players[ship.owner]).convoys) return 1;
  const r2 = CONVOY.reach * CONVOY.reach;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.owner !== ship.owner || e.hp <= 0 || e.inside > 0 || e.id === ship.id) continue;
    if (e.type !== 'warship' || statsOf(s, e).attack <= 0) continue;
    if ((e.x - ship.x) * (e.x - ship.x) + (e.y - ship.y) * (e.y - ship.y) <= r2) return CONVOY.pay;
  }
  return 1;
}
