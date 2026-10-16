import { RECLAIM, secs } from './data';
import { ageDef } from './ages';
import { buildingCostFor, buildingMaxHp } from './stats';
import type { Building, BuildingType, Cost, GameState } from './types';
import { RES } from './types';

/**
 * Foundations (the Age of Reclaimers): "build tomorrow from yesterday". A building of a reclaiming
 * people that falls leaves its footprint remembered for `RECLAIM.window` seconds; raising the same kind
 * of building on the same spot again costs `RECLAIM.cost` of its price and starts half built. So a
 * raid or a siege hurts a reclaimer less in gold and more in time, and a tower line that is knocked
 * down can be set back up under the next wave's nose. It does nothing outside the age.
 */

/** A building fell: if its people reclaims, remember where it stood. */
export function remember(s: GameState, b: Building): void {
  const p = s.players[b.owner];
  if (!ageDef(p).reclaim || !b.built || RECLAIM.skip.includes(b.type)) return;
  const fallen = s.fallen ?? (s.fallen = []);
  fallen.push({ owner: b.owner, type: b.type, tx: b.tx, ty: b.ty, until: s.tick + secs(RECLAIM.window) });
  s.events.push({ k: 'foundation', owner: b.owner, type: b.type, x: b.x, y: b.y, what: 'kept' });
}

/** The foundations a new site of this kind would stand on, if the owner still reclaims. */
export function foundationAt(s: GameState, owner: number, type: BuildingType, tx: number, ty: number): number {
  if (!s.fallen || !ageDef(s.players[owner]).reclaim) return -1;
  return s.fallen.findIndex((f) => f.owner === owner && f.type === type && f.tx === tx && f.ty === ty && f.until > s.tick);
}

/** What raising this building here costs: a fraction of the usual price on old foundations. */
export function raiseCost(s: GameState, owner: number, type: BuildingType, tx: number, ty: number): Cost {
  const cost = buildingCostFor(s, owner, type);
  if (foundationAt(s, owner, type, tx, ty) < 0) return cost;
  const out: Cost = {};
  for (const r of RES) if (cost[r]) out[r] = Math.ceil((cost[r] ?? 0) * RECLAIM.cost);
  return out;
}

/** A site was just placed: if it stands on old foundations, use them up and give it its head start. */
export function raise(s: GameState, b: Building): boolean {
  const i = foundationAt(s, b.owner, b.type, b.tx, b.ty);
  if (i < 0) return false;
  s.fallen!.splice(i, 1);
  b.progress = RECLAIM.head;
  b.hp = Math.max(1, Math.round(buildingMaxHp(s, b.owner, b.type) * RECLAIM.head));
  s.events.push({ k: 'foundation', owner: b.owner, type: b.type, x: b.x, y: b.y, what: 'raised' });
  return true;
}

/** Forget foundations whose time has run out, and those of a people that left the age. */
export function reclaimStep(s: GameState): void {
  if (!s.fallen || s.tick % 20 !== 0) return;
  s.fallen = s.fallen.filter((f) => f.until > s.tick && ageDef(s.players[f.owner]).reclaim);
  if (!s.fallen.length) delete s.fallen;
}
