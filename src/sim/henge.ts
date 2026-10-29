import { AGES, HENGE, MEGALITH, SEASON, secs } from './data';
import { ageDef, ageOf, asleep } from './ages';
import { seasonAt } from './seasons';
import { isEnemy } from './world';
import type { Building, BuildingType, Cost, GameState } from './types';
import { RES } from './types';

/**
 * The Age of Megaliths (#877, the Deep Road's first age): a town raised in stone, and Henges that hold the ground and gather the people
 * at each turn of the year. The numbers are `MEGALITH` and `HENGE` in `data.ts`.
 */

/** A building's price for a people building in stone (`Age.stonework`): its timber paid as stone, but for `MEGALITH.timber`. */
export function inStone(type: BuildingType, cost: Cost): Cost {
  if (!cost.wood || MEGALITH.timber.includes(type)) return cost;
  const out: Cost = {};
  for (const r of RES) if (cost[r] && r !== 'wood') out[r] = cost[r];
  out.stone = (out.stone ?? 0) + Math.round(cost.wood * MEGALITH.stone);
  return out;
}

// The Henges standing this tick, found once: placement asks `hallowed` for every spot it tries. Derived from the state, so no machine differs.
let seen: { s: GameState | null; tick: number; n: number; list: Building[] } = { s: null, tick: -1, n: -1, list: [] };
function hengesOf(s: GameState): Building[] {
  if (seen.s !== s || seen.tick !== s.tick || seen.n !== s.ents.length) {
    const list: Building[] = [];
    for (const e of s.ents) if (e.kind === 'building' && e.type === 'henge') list.push(e);
    seen = { s, tick: s.tick, n: s.ents.length, list };
  }
  return seen.list;
}

/** Whether a Henge is working: finished, standing, and its people in the age or keeping it (`asleep`). */
const working = (s: GameState, b: Building) => b.type === 'henge' && b.built && b.hp > 0 && !asleep(s, b);

/**
 * Whether a rival's Henge holds this ground (`HENGE.hold` tiles from its edge): no building of `owner`'s is raised in it at all, a Tower
 * or a War Camp included (the borders let those two into enemy land elsewhere).
 */
export function hallowed(s: GameState, owner: number, tx: number, ty: number, n: number): boolean {
  const cx = tx + n / 2, cy = ty + n / 2;
  for (const e of hengesOf(s)) {
    if (!isEnemy(s, owner, e.owner) || !working(s, e)) continue;
    const r = HENGE.hold + e.size / 2 + n / 2;
    const dx = e.tx + e.size / 2 - cx, dy = e.ty + e.size / 2 - cy;
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

/** The citizens a Henge would count now: its people's own, standing (not inside) within `HENGE.reach` tiles, at most `HENGE.most`. */
export function gathered(s: GameState, b: Building): number {
  const cx = b.tx + b.size / 2, cy = b.ty + b.size / 2;
  const r = HENGE.reach + b.size / 2;
  let n = 0;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.owner !== b.owner || e.type !== 'citizen' || e.hp <= 0 || e.inside) continue;
    const dx = e.x - cx, dy = e.y - cy;
    if (dx * dx + dy * dy <= r * r && ++n >= HENGE.most) break;
  }
  return n;
}

/** Whether the season that has just begun (or `season`) is summer or winter: the solstice gathering, `HENGE.solstice` times the gift. */
export const solstice = (season: number) => season === 1 || season === 3;

/** What a Henge brings in for `n` citizens at the turn into `season`. */
export function giftFor(n: number, season: number): Cost {
  const k = n * (solstice(season) ? HENGE.solstice : 1);
  const out: Cost = {};
  for (const r of RES) if (HENGE.gift[r]) out[r] = HENGE.gift[r]! * k;
  return out;
}

/** The year's gathering: as the season turns, every working Henge banks its gift for the citizens standing in its ring. */
export function hengeStep(s: GameState): void {
  if (s.tick === 0 || s.tick % secs(SEASON.len) !== 0) return;
  const season = seasonAt(s);
  for (const e of s.ents) {
    if (e.kind !== 'building' || !working(s, e)) continue;
    const n = gathered(s, e);
    if (!n) continue;
    const p = s.players[e.owner];
    if (p.defeated) continue;
    const gift = giftFor(n, season);
    for (const r of RES) if (gift[r]) p.res[r] += gift[r]!;
    p.stats.gathering = (p.stats.gathering ?? 0) + (gift.food ?? 0) + (gift.gold ?? 0);
    s.events.push({ k: 'gathering', id: e.id, owner: e.owner, n, solstice: solstice(season), x: e.x, y: e.y });
  }
}

/** Whether this people builds in stone now (its own age only: a Golden Age weaves in the Henges, never the door). */
export const buildsInStone = (s: GameState, owner: number): boolean => !!AGES[ageOf(s.players[owner])].stonework;

/** Whether this people's Mine Shafts dig stone at `MEGALITH.grade` at the least (the age's guarantee; the Golden Age keeps it too). */
export const deepQuarry = (s: GameState, owner: number): boolean => !!ageDef(s.players[owner]).henges;
