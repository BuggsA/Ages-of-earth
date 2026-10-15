import { GALVANIC, secs } from './data';
import { inField } from './ages';
import { modsOf } from './stats';
import type { GameState } from './types';

/**
 * Galvanic Revival (#240): an ancient ruin a player dug out keeps paying `GALVANIC.gold` every
 * `GALVANIC.every` seconds while it lies in the field of one of that player's Watch Towers.
 */
export function galvanicStep(s: GameState): void {
  if (!s.ruins || s.tick % secs(GALVANIC.every) !== 0) return;
  for (const r of s.ruins) {
    if (r.by < 0 || !modsOf(s, r.by).galvanic || !inField(s, { x: r.x, y: r.y, owner: r.by })) continue;
    const p = s.players[r.by];
    p.res.gold += GALVANIC.gold;
    p.stats.gathered += GALVANIC.gold;
  }
}
