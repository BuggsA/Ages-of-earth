import type { Job } from '../sim/types';
export { citizenJob, workforce } from '../sim/labor';

/** Job categories are exhaustive for living citizens. */
export const WORKFORCE_JOBS = [
  { key: 'food', label: 'Food', icon: '🍎' },
  { key: 'wood', label: 'Wood', icon: '🪵' },
  { key: 'stone', label: 'Stone', icon: '🪨' },
  { key: 'gold', label: 'Gold', icon: '🪙' },
  { key: 'build', label: 'Building & digging', icon: '🔨' },
  { key: 'idle', label: 'Idle', icon: '💤' },
  { key: 'shelter', label: 'Sheltered / aboard', icon: '🏰' },
  { key: 'other', label: 'Traveling & other', icon: '👣' },
] as const satisfies readonly { key: Job; label: string; icon: string }[];
export type WorkforceJob = (typeof WORKFORCE_JOBS)[number]['key'];
