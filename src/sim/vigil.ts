import { VIGIL } from './data';
import { ageDef } from './ages';
import type { Building, GameState } from './types';

/** Gold a relic Temple adds to each payment from the priests keeping vigil beside it (the Age of Pilgrims, or its keepsake), else 0. */
export function vigilGold(s: GameState, temple: Building): number {
  // A Temple kept as the Pilgrims' keepsake (#555 s11) keeps its vigils on any road.
  if (!temple.built || (!ageDef(s.players[temple.owner]).vigils && temple.keep !== 'pilgrim')) return 0;
  const r2 = VIGIL.reach * VIGIL.reach;
  let n = 0;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.owner !== temple.owner || e.hp <= 0 || e.inside > 0 || e.type !== 'priest') continue;
    if ((e.x - temple.x) * (e.x - temple.x) + (e.y - temple.y) * (e.y - temple.y) <= r2 && ++n >= VIGIL.most) break;
  }
  return n * VIGIL.each;
}
