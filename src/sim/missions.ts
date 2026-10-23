import { MISSION, secs } from './data';
import { asleep } from './ages';
import type { Building, GameState } from './types';

/**
 * Missions (the Age of Missions, #555 s12): priests raise them on far shores, and each pays a tithe that grows with its distance from
 * home. The numbers are `MISSION` in `data.ts`.
 */

/** Tiles from a finished Town Center of the same people to the nearest one, or 0 with none standing. */
export function homeDistance(s: GameState, b: Building): number {
  let best = Infinity;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'towncenter' || e.owner !== b.owner || !e.built || e.hp <= 0) continue;
    const dx = e.x - b.x;
    const dy = e.y - b.y;
    best = Math.min(best, dx * dx + dy * dy);
  }
  return best === Infinity ? 0 : Math.sqrt(best);
}

/** Gold one finished Mission pays each time (the tithe), before the people's limit on how many are counted. */
export const tithe = (s: GameState, b: Building): number => Math.min(MISSION.cap, MISSION.base + MISSION.perTile * homeDistance(s, b));

/** A people's finished, awake Missions that pay a tithe: the `MISSION.most` farthest, farthest first (id order breaks ties). */
export function paying(s: GameState, owner: number): Building[] {
  const out: { b: Building; d: number }[] = [];
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'mission' || e.owner !== owner || !e.built || e.hp <= 0 || asleep(s, e)) continue;
    out.push({ b: e, d: homeDistance(s, e) });
  }
  out.sort((a, b) => b.d - a.d || a.b.id - b.b.id);
  return out.slice(0, MISSION.most).map((x) => x.b);
}

/** Every `MISSION.every` seconds: a missionary people's farthest Missions pay their tithe into its treasury. */
export function missionStep(s: GameState): void {
  if (s.tick === 0 || s.tick % secs(MISSION.every) !== 0) return;
  for (const p of s.players) {
    if (p.defeated) continue;
    for (const b of paying(s, p.id)) {
      const gold = Math.round(tithe(s, b));
      p.res.gold += gold;
      p.stats.gathered += gold;
      p.stats.tithe = (p.stats.tithe ?? 0) + gold;
    }
  }
}
