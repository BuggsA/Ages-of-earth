import { LABOR, SPREAD } from './data';
import { legionKind, legionary } from './legion';
import { mineable } from './household';
import type { GameState, Job, Unit } from './types';
import { R_BERRY, R_GOLD, R_MEAT, R_STONE, R_TREE } from './types';
import { RES_OF_TILE, findResource, freeFarm, giveOrder } from './units';

/** The jobs a citizen can be sent to by `reassign`; building and shelter are chosen on the map. */
export const SEND_JOBS: readonly Job[] = ['food', 'wood', 'stone', 'gold'];
/** The jobs citizens can be pulled from. */
export const PULL_JOBS: readonly Job[] = ['food', 'wood', 'stone', 'gold', 'build', 'idle'];

/** What a living unit is doing, by its order. */
export function citizenJob(u: Unit): Job {
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

/** Ordered ids for selection: this player's living citizens, and a legion's foot soldiers, who are its hands too. */
export function workforce(s: GameState, owner: number): Map<Job, number[]> {
  const jobs = new Map<Job, number[]>((['food', 'wood', 'stone', 'gold', 'build', 'idle', 'shelter', 'other'] as const).map((k) => [k, []]));
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.owner !== owner || e.hp <= 0 || (e.type !== 'citizen' && !legionary(s, e))) continue;
    jobs.get(citizenJob(e))!.push(e.id);
  }
  return jobs;
}

const KIND_OF_JOB: Partial<Record<Job, number>> = { wood: R_TREE, stone: R_STONE, gold: R_GOLD };

/** Whether this unit may work this kind of node: citizens by their people's customs, a legion's foot by its own (as in `gather`). */
function canWork(s: GameState, u: Unit, kind: number): boolean {
  return (u.type === 'citizen' && mineable(s.players[u.owner], kind)) || (legionary(s, u) && legionKind(kind));
}

/** Whoever is easiest to spare first: idle hands, then those carrying nothing, then the rest; each in id order. */
function sparest(s: GameState, p: number, from: Job): Unit[] {
  const out: Unit[] = [];
  for (const id of workforce(s, p).get(from) ?? []) {
    const u = s.byId.get(id);
    if (u && u.kind === 'unit') out.push(u);
  }
  const rank = (u: Unit) => (u.order.k === 'idle' ? 0 : u.carry > 0 ? 2 : 1);
  return out.sort((a, b) => rank(a) - rank(b) || a.id - b.id);
}

/** Why `reassign` can't be done, in words, or null. */
export function reassignProblem(from: Job, to: Job): string | null {
  if (from === to) return 'They already do that';
  if (!PULL_JOBS.includes(from) || !SEND_JOBS.includes(to)) return 'Not a job to move people between';
  return null;
}

/**
 * Send up to `n` of a player's citizens from one job to another, wherever they are: each takes the nearest free node
 * of the new kind within `LABOR.reach` tiles (nodes with `SPREAD.perNode` workers are passed over). Food means berries,
 * then a free field, then meat nearby. Returns how many were moved and, if fewer than asked, why.
 */
export function reassign(s: GameState, p: number, from: Job, to: Job, n: number): { moved: number; why: string | null } {
  const bad = reassignProblem(from, to);
  if (bad) return { moved: 0, why: bad };
  const want = Math.max(0, Math.min(LABOR.most, Math.floor(n)));
  const pool = sparest(s, p, from);
  if (!pool.length) return { moved: 0, why: `No one is ${from === 'idle' ? 'idle' : `working ${from}`}` };
  const load = new Map<number, number>();
  const busy = (i: number) => (load.get(i) ?? 0) >= SPREAD.perNode;
  const fields = new Set<number>();
  for (const e of s.ents) {
    if (e.kind === 'unit' && e.owner === p && e.hp > 0 && e.order.k === 'gather' && !pool.includes(e)) load.set(e.order.tile, (load.get(e.order.tile) ?? 0) + 1);
    if (e.kind === 'unit' && e.owner === p && e.hp > 0 && e.order.k === 'farm' && !pool.includes(e)) fields.add(e.order.target);
  }
  let moved = 0;
  for (const u of pool) {
    if (moved >= want) break;
    if (to === 'food') {
      if (u.type !== 'citizen') continue;
      const berry = findResource(s, R_BERRY, u.x, u.y, LABOR.reach, busy);
      const field = berry < 0 ? freeFarm(s, p, u.x, u.y, LABOR.reach, fields) : null;
      const meat = berry < 0 && !field ? findResource(s, R_MEAT, u.x, u.y, 8, busy) : -1;
      if (berry >= 0 || meat >= 0) {
        const tile = berry >= 0 ? berry : meat;
        load.set(tile, (load.get(tile) ?? 0) + 1);
        giveOrder(u, { k: 'gather', tile, res: RES_OF_TILE[s.res[tile]], phase: 'go' });
      } else if (field) {
        fields.add(field.id);
        giveOrder(u, { k: 'farm', target: field.id, phase: 'go' });
      } else continue;
    } else {
      const kind = KIND_OF_JOB[to]!;
      if (!canWork(s, u, kind)) continue;
      const tile = findResource(s, kind, u.x, u.y, LABOR.reach, busy);
      if (tile < 0) continue;
      load.set(tile, (load.get(tile) ?? 0) + 1);
      giveOrder(u, { k: 'gather', tile, res: RES_OF_TILE[kind], phase: 'go' });
    }
    moved++;
  }
  if (moved >= Math.min(want, pool.length)) return { moved, why: null };
  return { moved, why: moved ? `Only ${moved} could reach ${to}` : `No free ${to === 'food' ? 'food' : to} within reach` };
}
