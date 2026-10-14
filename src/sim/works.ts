import { WORK, WORKS, secs } from './data';
import { townCenters, restat } from './world';
import type { GameState, Player } from './types';

/** Great works (seed #133): why a player can't call theirs now, or null if they can. */
export function workProblem(s: GameState, p: Player): string | null {
  const w = WORKS[p.civ];
  if (p.epoch < WORK.from) return `${w.name} waits for the next epoch`;
  if (p.workEnd !== undefined) return `${w.name} is already at hand`;
  if (p.works?.includes(p.epoch)) return `${w.name} has been called in this epoch`;
  if (!townCenters(s, p.id).some((b) => b.built)) return 'A great work is called from a Town Center';
  return null;
}

/** Call a people's great work: it lasts `WORK.duration` seconds and is spent for this epoch. */
export function callWork(s: GameState, p: Player): void {
  restat(s, p, () => {
    p.works = [...(p.works ?? []), p.epoch];
    p.workEnd = s.tick + secs(WORK.duration);
  });
  s.events.push({ k: 'greatWork', owner: p.id, on: true });
}

/** Let a great work run out. Cheap: one comparison per player a tick. */
export function workStep(s: GameState): void {
  for (const p of s.players) {
    if (p.workEnd === undefined || s.tick < p.workEnd) continue;
    restat(s, p, () => {
      p.workEnd = undefined;
    });
    s.events.push({ k: 'greatWork', owner: p.id, on: false });
  }
}
