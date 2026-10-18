import { CIVS, HOUSEHOLD, secs } from './data';
import { R_BOG, R_GOLD } from './types';
import { isNomad, nomadSpurns } from './nomad';
import type { Building, GameState, Player } from './types';

/**
 * The household tax (#501, the Chinese): a people whose gold is not mined but owed. Its citizens never work a gold seam or a bog
 * (`mineable`); instead every finished house pays by the second at `HOUSEHOLD.gold`, in proportion to how full the town's houses are,
 * and `HOUSEHOLD.street` more for each house on its street. The treasury is the layout.
 */
export const isHousehold = (p: Player): boolean => !!CIVS[p.civ].household;

/** Whether this player's citizens may work a tile of this kind: a household people mines no gold and digs no bog iron; a nomad people no stone either. */
export const mineable = (p: Player, kind: number): boolean => (!isHousehold(p) || (kind !== R_GOLD && kind !== R_BOG)) && (!isNomad(p) || !nomadSpurns(kind));


/** The finished houses of a player, and its finished Markets, in id order. */
function homes(s: GameState, owner: number): { houses: Building[]; markets: Building[] } {
  const houses: Building[] = [];
  const markets: Building[] = [];
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== owner || e.hp <= 0 || !e.built) continue;
    if (e.type === 'house') houses.push(e);
    else if (e.type === 'market') markets.push(e);
  }
  return { houses, markets };
}

/** How many neighbours a house has on its street: other finished houses within `reach` tiles, a Market counting as `market`. */
function street(b: Building, houses: Building[], markets: Building[]): number {
  const r = HOUSEHOLD.reach;
  let n = 0;
  for (const h of houses) if (h !== b && Math.abs(h.tx - b.tx) <= r && Math.abs(h.ty - b.ty) <= r) n++;
  for (const m of markets) if (Math.abs(m.tx - b.tx) <= r + 1 && Math.abs(m.ty - b.ty) <= r + 1) n += HOUSEHOLD.market;
  return Math.min(HOUSEHOLD.streetMax, n);
}

/** How full the town's room is: its people over its houses' room, at most 1. */
export const occupancy = (p: Player): number => (p.cap > 0 ? Math.min(1, p.pop / p.cap) : 0);

/** What one house pays a second now. */
export function payOf(p: Player, b: Building, houses: Building[], markets: Building[]): number {
  return (HOUSEHOLD.gold + HOUSEHOLD.street * street(b, houses, markets)) * occupancy(p);
}

/** The gold a second a household people's houses pay now (zero for any other people), for the HUD and the computer. */
export function taxRate(s: GameState, owner: number): number {
  const p = s.players[owner];
  if (!p || !isHousehold(p) || p.defeated) return 0;
  const { houses, markets } = homes(s, owner);
  let sum = 0;
  for (const b of houses) sum += payOf(p, b, houses, markets);
  return sum;
}

/** The neighbours a house has on its street now (for the HUD's hover text). */
export function streetOf(s: GameState, b: Building): number {
  const { houses, markets } = homes(s, b.owner);
  return street(b, houses, markets);
}

/** Every `HOUSEHOLD.every` seconds, in id order: each household people's houses pay their tax into its treasury. */
export function householdStep(s: GameState): void {
  if (s.tick === 0 || s.tick % secs(HOUSEHOLD.every) !== 0) return;
  for (const p of s.players) {
    if (!isHousehold(p) || p.defeated) continue;
    const { houses, markets } = homes(s, p.id);
    let gold = 0;
    const ids: number[] = [];
    for (const b of houses) {
      const due = payOf(p, b, houses, markets) * HOUSEHOLD.every;
      if (due <= 0) continue;
      gold += due;
      ids.push(b.id);
    }
    if (gold <= 0) continue;
    p.res.gold += gold;
    p.stats.taxed = (p.stats.taxed ?? 0) + gold;
    s.events.push({ k: 'tax', owner: p.id, gold, ids });
  }
}

/** What a rival gains by razing this house: `HOUSEHOLD.raid` of a household people's gold, as much as it has (zero for anything else). */
export function raided(s: GameState, b: { type: string; owner: number }): number {
  const p = s.players[b.owner];
  if (b.type !== 'house' || !p || !isHousehold(p)) return 0;
  return Math.min(HOUSEHOLD.raid, Math.max(0, p.res.gold));
}

