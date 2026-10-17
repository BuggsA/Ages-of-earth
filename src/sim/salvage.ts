import { RECLAIM, SALVAGE, secs } from './data';
import { ageDef } from './ages';
import { buildingCostFor } from './stats';
import type { Building, Cost, GameState, Rubble } from './types';
import { RES } from './types';

/**
 * Salvage (the Age of Reclaimers, #503): "build tomorrow from yesterday" taken one step further. While any
 * reclaiming people is in the match, a building that falls (anyone's) leaves rubble for `SALVAGE.window` seconds.
 * A reclaimer's citizens strip it, shared work like a dig, and the stock gets `SALVAGE.share` of the price.
 * Rubble of your own fall is a choice: strip it now, or leave the foundations (`reclaim.ts`) to raise again for
 * 40% of the price. Stripping a rival's takes citizens out to a battlefield, and wants an escort.
 */

export const rubbleAt = (s: GameState, id: number): Rubble | undefined => s.rubble?.find((r) => r.id === id);

/** Whether this people's citizens may strip rubble. */
export const salvages = (s: GameState, owner: number): boolean => !!ageDef(s.players[owner]).salvage;

/** A building fell: if a salvaging people is about, rubble is left where it stood. */
export function leaveRubble(s: GameState, b: Building): void {
  if (!b.built || RECLAIM.skip.includes(b.type) || !s.players.some((p) => !p.defeated && ageDef(p).salvage)) return;
  const worth: Cost = {};
  const cost = buildingCostFor(s, b.owner, b.type);
  for (const r of RES) if (cost[r]) worth[r] = Math.floor((cost[r] ?? 0) * SALVAGE.share);
  (s.rubble ??= []).push({ id: s.nextId++, x: b.x, y: b.y, owner: b.owner, type: b.type, tx: b.tx, ty: b.ty, worth, done: 0, until: s.tick + secs(SALVAGE.window) });
  s.events.push({ k: 'salvage', owner: b.owner, x: b.x, y: b.y, type: b.type, what: 'left' });
}

/** One citizen's tick of stripping. Returns true when this stroke cleared the rubble. */
export function strip(s: GameState, r: Rubble, by: number): boolean {
  r.done++;
  if (r.done < secs(SALVAGE.work)) return false;
  const p = s.players[by];
  for (const k of RES) {
    const n = r.worth[k] ?? 0;
    p.res[k] += n;
    if (k === 'gold') p.stats.gathered += n;
  }
  // The foundations go with the stones: stripped, they cannot be raised cheaply any more.
  if (r.owner === by && s.fallen) {
    const i = s.fallen.findIndex((f) => f.owner === r.owner && f.type === r.type && f.tx === r.tx && f.ty === r.ty);
    if (i >= 0) s.fallen.splice(i, 1);
  }
  s.rubble = s.rubble!.filter((q) => q.id !== r.id);
  if (!s.rubble.length) delete s.rubble;
  s.events.push({ k: 'salvage', owner: by, x: r.x, y: r.y, type: r.type, what: 'stripped', gain: r.worth });
  return true;
}

/** Clear away the rubble whose time has run out. */
export function salvageStep(s: GameState): void {
  if (!s.rubble || s.tick % 20 !== 0) return;
  s.rubble = s.rubble.filter((r) => r.until > s.tick);
  if (!s.rubble.length) delete s.rubble;
}
