import { WAY, WAYS, WAY_IDS, secs } from './data';
import { canAfford, isEnemy, pay, restat, townCenters } from './world';
import { R_BERRY } from './types';
import type { GameState, Player, WayId } from './types';

/** Ways (#336): why a people can't take this one now, or null if they can. */
export function wayProblem(s: GameState, p: Player, way: WayId): string | null {
  if (!WAYS[way]) return 'No such Way';
  if (p.way) return `Your people already live by ${WAYS[p.way].name}`;
  if (p.epoch > WAY.until) return 'A Way is chosen in the Stone Age; the moment has passed';
  if (!townCenters(s, p.id).some((b) => b.built)) return 'A Way is chosen at a Town Center';
  return null;
}

/** Take a Way: its numbers apply to the people from now on, and everyone is told which one. */
export function takeWay(s: GameState, p: Player, way: WayId): void {
  restat(s, p, () => {
    p.way = way;
  });
  s.events.push({ k: 'way', owner: p.id, way });
}

/**
 * Which Way suits a computer's home: the deer within reach feed the Hunters, the berry patches the
 * Hearth, and a rival close by (or a people who fight on foot or horse) the Warband. Ties go in
 * `WAY_IDS` order, so the choice is the same every run.
 */
export function wayFor(s: GameState, p: Player): WayId {
  const tc = townCenters(s, p.id)[0];
  if (!tc) return 'hearth';
  const r2 = WAY.near * WAY.near;
  let deer = 0;
  for (const a of s.animals) if (a.kind === 'deer' && a.hp > 0 && (a.x - tc.x) * (a.x - tc.x) + (a.y - tc.y) * (a.y - tc.y) <= r2) deer++;
  let berries = 0;
  const reach = Math.ceil(WAY.near);
  for (let y = Math.max(0, Math.floor(tc.y) - reach); y <= Math.min(s.h - 1, Math.floor(tc.y) + reach); y++) {
    for (let x = Math.max(0, Math.floor(tc.x) - reach); x <= Math.min(s.w - 1, Math.floor(tc.x) + reach); x++) {
      if (s.res[y * s.w + x] === R_BERRY && (x + 0.5 - tc.x) * (x + 0.5 - tc.x) + (y + 0.5 - tc.y) * (y + 0.5 - tc.y) <= r2) berries++;
    }
  }
  let foe = Infinity;
  for (const q of s.players) {
    if (q.defeated || !isEnemy(s, p.id, q.id)) continue;
    for (const b of townCenters(s, q.id)) foe = Math.min(foe, Math.sqrt((b.x - tc.x) * (b.x - tc.x) + (b.y - tc.y) * (b.y - tc.y)));
  }
  const score: Record<WayId, number> = {
    hunt: deer * 2,
    hearth: berries,
    warband: (foe < 50 ? 6 : 0) + (p.civ === 'romans' || p.civ === 'greeks' || p.civ === 'mongols' ? 4 : 0),
  };
  let best: WayId = WAY_IDS[0];
  for (const w of WAY_IDS) if (score[w] > score[best]) best = w;
  return best;
}

/** The computer's turn: a clever one picks once its first minute is out, while still in the Stone Age. */
export function aiWay(s: GameState, p: Player): WayId | null {
  if (s.tick < secs(WAY.aiAfter)) return null;
  const way = wayFor(s, p);
  return wayProblem(s, p, way) ? null : way;
}

/**
 * Vows (#338): in the Bronze Age a people may deepen its Way (`way` unset) or turn to another, once.
 * Why it can't be done now, or null.
 */
export function vowProblem(s: GameState, p: Player, way?: WayId): string | null {
  if (!p.way) return 'Your people live by no Way';
  if (p.vowed) return 'Your people have made their vow';
  if (p.epoch !== WAY.vow) return 'A vow is made in the Bronze Age';
  if (!townCenters(s, p.id).some((b) => b.built)) return 'A vow is made at a Town Center';
  if (way) {
    if (!WAYS[way]) return 'No such Way';
    if (way === p.way) return 'Your people already live by that Way';
  }
  const cost = way ? WAY.turnCost : WAY.deepenCost;
  return canAfford(p, cost) ? null : 'Not enough resources';
}

/** Deepen the Way, or turn from it; either way the vow is spent. */
export function takeVow(s: GameState, p: Player, way?: WayId): void {
  pay(p, way ? WAY.turnCost : WAY.deepenCost);
  restat(s, p, () => {
    p.vowed = true;
    if (way) {
      p.way = way;
      p.deep = false;
    } else p.deep = true;
  });
  s.events.push({ k: 'way', owner: p.id, way: p.way!, deep: !way, turned: !!way });
}

/** A clever computer deepens its Way once it can pay and still keep a stock for the age after. */
export function aiVow(s: GameState, p: Player): boolean {
  return !vowProblem(s, p) && p.res.food >= WAY.deepenCost.food! + 150 && p.res.wood >= WAY.deepenCost.wood! + 100;
}
