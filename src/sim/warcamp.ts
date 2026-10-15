import { TICK_HZ, WARCAMP, domainOf } from './data';
import { buildBarred } from './ages';
import { maxHp } from './world';
import type { Building, GameState, UnitType } from './types';

/**
 * War Camps (#303), the Age of Iron and Blood's own building: pitched by foot soldiers where the army
 * stands, enemy land too (`placeProblem`), training foot soldiers at the front and holding a little land
 * (`BORDERS.warcamp`), so the army round it is fed (attrition, #132). The price is that a camp is only as
 * strong as the army keeping it: one left without its people's soldiers burns, and a people that leaves
 * the path strikes its camps (they burn at once).
 */

/** Units that keep a camp: the people's land fighters, not its citizens, priests or traders. */
const KEEPERS_NOT = new Set<UnitType>(['citizen', 'priest', 'trader']);

/** Whether some of the camp's own soldiers stand within `WARCAMP.watch` tiles of it. */
export function kept(s: GameState, b: Building): boolean {
  const r2 = WARCAMP.watch * WARCAMP.watch;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.owner !== b.owner || e.hp <= 0 || e.inside || KEEPERS_NOT.has(e.type) || domainOf(e.type) !== 'land') continue;
    const dx = e.x - b.x;
    const dy = e.y - b.y;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

/** Whole seconds left before an unkept camp catches fire, or 0 once it burns (or while it is kept). */
export function campGrace(b: Building): number {
  return b.alone === undefined ? 0 : Math.max(0, WARCAMP.grace - b.alone);
}

/** Once a second: camps with their soldiers near are kept; the rest count down, then burn. In id order. */
export function warCampStep(s: GameState): void {
  if (s.tick === 0 || s.tick % TICK_HZ !== 0) return;
  for (const b of s.ents) {
    if (b.kind !== 'building' || b.type !== 'warcamp' || !b.built || b.hp <= 0) continue;
    const struck = !!buildBarred(s.players[b.owner], b.type);
    if (!struck && kept(s, b)) {
      if (b.alone !== undefined) delete b.alone;
      continue;
    }
    const alone = (b.alone ?? 0) + 1;
    b.alone = alone;
    if (alone === 1) s.events.push({ k: 'campAlone', owner: b.owner, id: b.id, x: b.x, y: b.y, struck });
    if (!struck && alone <= WARCAMP.grace) continue;
    b.hp -= Math.max(1, maxHp(s, b) * WARCAMP.burn);
  }
}
