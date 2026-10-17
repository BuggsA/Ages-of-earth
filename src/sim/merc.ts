import { MERC, secs } from './data';
import type { GameState } from './types';

/** The hired swords (the Age of Merchants) of a people, living, in id order. */
export function swordsOf(s: GameState, owner: number) {
  const out = [];
  for (const e of s.ents) if (e.kind === 'unit' && e.owner === owner && e.hp > 0 && e.merc !== undefined) out.push(e);
  return out;
}

/** Gold a people's hired swords draw each `MERC.every` seconds. */
export const wageBill = (s: GameState, owner: number): number => swordsOf(s, owner).length * MERC.wage;

/**
 * Payday for hired swords, every `MERC.every` seconds, once the hire price has served `MERC.first` seconds. Each sword in id order is paid `MERC.wage` while the treasury holds it; one
 * that goes unpaid falls a payday behind, and at `MERC.patience` paydays behind it walks off (it is struck from the field like the fallen). A sword that is paid is square again.
 */
export function mercStep(s: GameState): void {
  if (s.tick === 0 || s.tick % secs(MERC.every) !== 0) return;
  for (const p of s.players) {
    let late = 0;
    let gone = 0;
    let any = false;
    for (const u of swordsOf(s, p.id)) {
      // The hire price covers the first stretch.
      if (s.tick - u.born < secs(MERC.first)) continue;
      any = true;
      if (p.res.gold >= MERC.wage) {
        p.res.gold -= MERC.wage;
        p.stats.wages = (p.stats.wages ?? 0) + MERC.wage;
        u.merc = 0;
        continue;
      }
      u.merc = (u.merc ?? 0) + 1;
      late++;
      if (u.merc >= MERC.patience) {
        u.hp = 0;
        gone++;
      }
    }
    if (any && late) s.events.push({ k: 'wages', owner: p.id, late, gone });
  }
}
