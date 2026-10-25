import { WHEELYARD, secs } from './data';
import { asleep } from './ages';
import { maxHp } from './world';
import type { Building, GameState } from './types';

/**
 * The Chariots' Wheelwright's Yard (#727). Every `WHEELYARD.every` seconds a rider (cavalry) of a yard owner's team that stands within
 * `WHEELYARD.rest` tiles of a finished, awake yard is mended `WHEELYARD.heal` health: the people without walls fights out at a forward
 * yard and falls back to it. The numbers are in `data.ts`.
 */
const yards = (s: GameState): Building[] => s.ents.filter((e): e is Building => e.kind === 'building' && e.type === 'wheelyard' && e.built && e.hp > 0 && !asleep(s, e));

export function wheelyardStep(s: GameState): void {
  if (s.tick === 0 || s.tick % secs(WHEELYARD.every) !== 0) return;
  const list = yards(s);
  if (!list.length) return;
  const r2 = WHEELYARD.rest * WHEELYARD.rest;
  for (const u of s.ents) {
    if (u.kind !== 'unit' || u.type !== 'cavalry' || u.hp <= 0 || u.inside) continue;
    const top = maxHp(s, u);
    if (u.hp >= top) continue;
    const near = list.some((b) => s.players[u.owner].team === s.players[b.owner].team && (u.x - b.x) * (u.x - b.x) + (u.y - b.y) * (u.y - b.y) <= r2);
    if (near) u.hp = Math.min(top, u.hp + WHEELYARD.heal * WHEELYARD.every);
  }
}
