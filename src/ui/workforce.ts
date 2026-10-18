import { legionary } from '../sim/legion';
import type { GameState, Unit } from '../sim/types';

/** Job categories are exhaustive for living citizens, with no change to their orders. */
export const WORKFORCE_JOBS = [
  { key: 'food', label: 'Food', icon: '🍎' },
  { key: 'wood', label: 'Wood', icon: '🪵' },
  { key: 'stone', label: 'Stone', icon: '🪨' },
  { key: 'gold', label: 'Gold', icon: '🪙' },
  { key: 'build', label: 'Building & digging', icon: '🔨' },
  { key: 'idle', label: 'Idle', icon: '💤' },
  { key: 'shelter', label: 'Sheltered / aboard', icon: '🏰' },
  { key: 'other', label: 'Traveling & other', icon: '👣' },
] as const;
export type WorkforceJob = (typeof WORKFORCE_JOBS)[number]['key'];

export function citizenJob(u: Unit): WorkforceJob {
  if (u.inside) return 'shelter';
  switch (u.order.k) {
    case 'gather': return u.order.res;
    case 'farm':
    case 'hunt': return 'food';
    case 'build':
    case 'dig':
    case 'salvage': return 'build';
    case 'idle': return u.queue.length ? 'other' : 'idle';
    default: return 'other';
  }
}

/** Ordered ids for selection: this player's living citizens, and a legion's foot soldiers, who are its hands too (#501). */
export function workforce(s: GameState, owner: number): Map<string, number[]> {
  const jobs = new Map<string, number[]>(WORKFORCE_JOBS.map((job) => [job.key, []]));
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.owner !== owner || e.hp <= 0 || (e.type !== 'citizen' && !legionary(s, e))) continue;
    jobs.get(citizenJob(e))!.push(e.id);
  }
  return jobs;
}
