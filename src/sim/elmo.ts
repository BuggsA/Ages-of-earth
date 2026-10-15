import { ELMO, secs } from './data';
import { inField } from './ages';
import { modsOf, statsFor } from './stats';
import { maxHp } from './world';
import type { GameState } from './types';

/**
 * St. Elmo's Fire (#240): a finished Temple standing in a Watch Tower's reach mends its owner's soldiers
 * within `ELMO.reach` tiles, once the people has learned the heirloom. Citizens and priests are left to their own healers.
 */
export function elmoStep(s: GameState): void {
  if (s.tick % secs(ELMO.every) !== 0) return;
  const r2 = ELMO.reach * ELMO.reach;
  for (const t of s.ents) {
    if (t.kind !== 'building' || t.type !== 'temple' || !t.built || t.hp <= 0 || !modsOf(s, t.owner).elmo || !inField(s, t)) continue;
    for (const e of s.ents) {
      if (e.kind !== 'unit' || e.hp <= 0 || e.inside || e.owner !== t.owner) continue;
      const cls = statsFor(s, e.owner, e.type).cls;
      if (cls === 'citizen' || cls === 'priest' || cls === 'trader') continue;
      const dx = e.x - t.x, dy = e.y - t.y;
      if (dx * dx + dy * dy > r2) continue;
      const top = maxHp(s, e);
      if (e.hp >= top) continue;
      e.hp = Math.min(top, e.hp + top * ELMO.heal);
      if (s.tick % secs(ELMO.every * 3) === 0) s.events.push({ k: 'healed', id: e.id, x: e.x, y: e.y });
    }
  }
}
