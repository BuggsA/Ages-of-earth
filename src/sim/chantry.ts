import { CHANTRY, secs } from './data';
import { asleep } from './ages';
import { maxHp } from './world';
import type { Building, GameState, Unit } from './types';

/**
 * The Pilgrims' Wayside Chantry (#727). A priest within `CHANTRY.reach` tiles of a finished, awake chantry of its team chants
 * `CHANTRY.voice` louder (`chantryBoost`, used by `consecrate.ts`) and is mended `CHANTRY.mend` health every `CHANTRY.every` seconds.
 * The numbers are in `data.ts`.
 */
export const chantries = (s: GameState): Building[] => s.ents.filter((e): e is Building => e.kind === 'building' && e.type === 'chantry' && e.built && e.hp > 0 && !asleep(s, e));

const near = (s: GameState, u: Unit, list: Building[]): boolean => {
  const r2 = CHANTRY.reach * CHANTRY.reach;
  return list.some((b) => s.players[u.owner].team === s.players[b.owner].team && (u.x - b.x) * (u.x - b.x) + (u.y - b.y) * (u.y - b.y) <= r2);
};

/** How much louder a priest sings for standing at its team's chantry (1 when it doesn't). */
export function chantryBoost(s: GameState, u: Unit): number {
  return near(s, u, chantries(s)) ? 1 + CHANTRY.voice : 1;
}

export function chantryStep(s: GameState): void {
  if (s.tick === 0 || s.tick % secs(CHANTRY.every) !== 0) return;
  const list = chantries(s);
  if (!list.length) return;
  for (const u of s.ents) {
    if (u.kind !== 'unit' || u.type !== 'priest' || u.hp <= 0 || u.inside) continue;
    const top = maxHp(s, u);
    if (u.hp < top && near(s, u, list)) u.hp = Math.min(top, u.hp + CHANTRY.mend * CHANTRY.every);
  }
}
