import { RUINS, TECHS, TECH_IDS, secs } from './data';
import { nearestWalkable } from './grid';
import { letGo } from './relics';
import { techProblem } from './stats';
import { restat } from './world';
import type { GameState, Player, Ruin, TechId } from './types';

/**
 * Ancient ruins (#64): tumbled stones of a people older than any on the map. Citizens dig one out,
 * once; whoever's citizen finishes the dig takes what lay beneath, which the seed decided: a hoard of
 * gold, lost knowledge (a technology, free), an old map of the whole land, or a relic.
 */

export const RUIN_FINDS = {
  hoard: { name: 'A buried hoard', blurb: `${RUINS.gold} gold, for whoever digs it up.` },
  lore: { name: 'Lost knowledge', blurb: 'The cheapest technology of your age you don\'t have yet, learned for nothing.' },
  map: { name: 'An old map', blurb: 'The whole lie of the land, laid open (what stands on it you must still go and see).' },
  relic: { name: 'A relic', blurb: 'A gilded relic comes up out of the earth, for a priest to carry to a Temple.' },
} as const;

export function ruinAt(s: GameState, id: number): Ruin | undefined {
  return s.ruins?.find((r) => r.id === id);
}

/** Work a ruin takes, in ticks of one citizen's digging. */
export function digWork(): number {
  return secs(RUINS.dig);
}

/**
 * Lost knowledge: the cheapest technology of the player's age that it could research now and isn't
 * already researching (surveys aside, since their answer belongs to a Storehouse's work), ties to the
 * one listed first. Null when there's none.
 */
export function loreFor(s: GameState, p: Player): TechId | null {
  let best: TechId | null = null;
  let bestCost = Infinity;
  for (const id of TECH_IDS) {
    const t = TECHS[id];
    if (t.survey || techProblem(s, p.id, id)) continue;
    let cost = 0;
    for (const v of Object.values(t.cost)) cost += v ?? 0;
    if (cost < bestCost) {
      bestCost = cost;
      best = id;
    }
  }
  return best;
}

/** One citizen's tick of digging. Returns true when this stroke finished the dig. */
export function dig(s: GameState, r: Ruin, owner: number): boolean {
  if (r.by >= 0) return false;
  r.dug++;
  if (r.dug < digWork()) return false;
  r.by = owner;
  const p = s.players[owner];
  let find = r.find;
  let tech: TechId | undefined;
  if (find === 'lore') {
    tech = loreFor(s, p) ?? undefined;
    if (tech) {
      const t = tech;
      restat(s, p, () => p.techs.push(t));
      p.stats.techs++;
    }
    // Nothing left to learn at this age: the scholars' gold instead.
    else find = 'hoard';
  }
  if (find === 'hoard') {
    p.res.gold += RUINS.gold;
    p.stats.gathered += RUINS.gold;
  } else if (find === 'map') {
    p.seen.fill(1);
  } else if (find === 'relic') {
    const tile = nearestWalkable(s, r.x + 1, r.y, 8);
    const relic = { id: s.nextId++, x: tile >= 0 ? (tile % s.w) + 0.5 : r.x, y: tile >= 0 ? Math.floor(tile / s.w) + 0.5 : r.y, carrier: 0, temple: 0 };
    s.relics.push(relic);
    // Set down properly (clear of other relics), and seen to be.
    letGo(s, relic, relic.x, relic.y, owner);
  }
  s.events.push({ k: 'ruin', id: r.id, owner, find, ...(tech ? { tech } : {}), x: r.x, y: r.y });
  return true;
}
