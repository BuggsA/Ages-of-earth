import { GATHER, LABOR, SPREAD } from './data';
import { legionKind, legionary } from './legion';
import { mineable } from './household';
import { canRaise } from './ages';
import type { Building, GameState, Job, Unit } from './types';
import { R_BERRY, R_GOLD, R_MEAT, R_STONE, R_TREE } from './types';
import { RES_OF_TILE, findResource, freeFarm, freeShaft, giveOrder } from './units';
import { seamOf, seamProblem } from './shafts';
import { milkable } from './flocks';

/** The jobs a citizen can be sent to by `reassign`; building and shelter are chosen on the map. */
export const SEND_JOBS: readonly Job[] = ['food', 'wood', 'stone', 'gold', 'build'];
/** The jobs citizens can be pulled from. */
export const PULL_JOBS: readonly Job[] = ['food', 'wood', 'stone', 'gold', 'build', 'idle'];

/** What a living unit is doing, by its order. */
export function citizenJob(u: Unit): Job {
  if (u.inside) return 'shelter';
  switch (u.order.k) {
    case 'gather':
    case 'shaft': return u.order.res;
    case 'farm':
    case 'hunt':
    case 'snare':
    case 'milk': return 'food';
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

/** This player's unfinished buildings, in id order, with the builders already sent to each (counting those not being moved). */
function sites(s: GameState, p: number, moving: readonly Unit[]): Map<Building, number> {
  const out = new Map<Building, number>();
  for (const e of s.ents) if (e.kind === 'building' && e.owner === p && e.hp > 0 && !e.built) out.set(e, 0);
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.owner !== p || e.hp <= 0 || e.order.k !== 'build' || moving.includes(e)) continue;
    const b = s.byId.get(e.order.target);
    if (b && b.kind === 'building' && out.has(b)) out.set(b, out.get(b)! + 1);
  }
  return out;
}

/** The nearest finished snare of `p`'s within `LABOR.reach` tiles that nobody walks and isn't in `taken`, or null (#344). */
function freeSnare(s: GameState, p: number, x: number, y: number, taken: Set<number>): Building | null {
  let best: Building | null = null;
  let bestD = LABOR.reach * LABOR.reach;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'snare' || e.owner !== p || !e.built || e.hp <= 0 || taken.has(e.id)) continue;
    const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** The nearest site with room in its crew, else the least crowded one; null when nothing is being built. */
function nearestSite(u: Unit, crew: Map<Building, number>): Building | null {
  let best: Building | null = null;
  let bestKey = Infinity;
  for (const [b, n] of crew) {
    const d = (b.x - u.x) * (b.x - u.x) + (b.y - u.y) * (b.y - u.y);
    const key = (n >= LABOR.crew ? 1e9 + n * 1e6 : 0) + d;
    if (key < bestKey) {
      bestKey = key;
      best = b;
    }
  }
  return best;
}

/** How many hands, put on a resource now, make up `need` within `LABOR.window` seconds (a field's pace for food, the slowest honest guess); at least one. */
export function handsFor(res: Job, need: number): number {
  const rate = res === 'food' ? GATHER.farm : res === 'wood' ? GATHER.tree : res === 'stone' ? GATHER.stone : GATHER.gold;
  return Math.max(1, Math.min(LABOR.most, Math.ceil(need / (rate * LABOR.window))));
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
  const pits = new Set<number>();
  const lines = new Set<number>();
  const ewes = new Set<number>();
  for (const e of s.ents) {
    if (e.kind === 'unit' && e.owner === p && e.hp > 0 && e.order.k === 'gather' && !pool.includes(e)) load.set(e.order.tile, (load.get(e.order.tile) ?? 0) + 1);
    // A field someone farms, or is still raising (they farm it once it stands, #344), is passed over.
    if (e.kind === 'unit' && e.owner === p && e.hp > 0 && (e.order.k === 'farm' || e.order.k === 'build') && !pool.includes(e)) fields.add(e.order.target);
    if (e.kind === 'unit' && e.owner === p && e.hp > 0 && e.order.k === 'snare' && !pool.includes(e)) lines.add(e.order.target);
    if (e.kind === 'unit' && e.owner === p && e.hp > 0 && e.order.k === 'milk' && !pool.includes(e)) ewes.add(e.order.target);
  }
  const crew = to === 'build' ? sites(s, p, pool) : null;
  if (crew && !crew.size) return { moved: 0, why: 'Nothing is being built' };
  let moved = 0;
  for (const u of pool) {
    if (moved >= want) break;
    if (crew) {
      const site = nearestSite(u, crew);
      if (!site || u.thrall || !canRaise(u.type, site.type, s.players[p].civ)) continue;
      const o = u.order;
      // Remember the work they leave, so they go back to it once the building stands (as when a builder is called over).
      const back = o.k === 'gather' || o.k === 'farm' || o.k === 'snare' || o.k === 'shaft' || o.k === 'milk' ? { ...o, phase: 'go' as const } : null;
      giveOrder(u, { k: 'build', target: site.id });
      u.resume = back ?? u.resume;
      crew.set(site, crew.get(site)! + 1);
    } else if (to === 'food') {
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
      } else {
        // A people without fields (#344): a snare line nobody walks (the Britons, the Deep Wood), else a sheep in milk (a flock).
        const snare = freeSnare(s, p, u.x, u.y, lines);
        const ewe = snare ? null : milkable(s, p, u.x, u.y, LABOR.reach, undefined, ewes);
        if (snare) {
          lines.add(snare.id);
          giveOrder(u, { k: 'snare', target: snare.id, phase: 'go' });
        } else if (ewe) {
          ewes.add(ewe.id);
          giveOrder(u, { k: 'milk', target: ewe.id, phase: 'go' });
        } else continue;
      }
    } else {
      const kind = KIND_OF_JOB[to]!;
      if (!canWork(s, u, kind)) continue;
      const tile = findResource(s, kind, u.x, u.y, LABOR.reach, busy);
      // No deposit in reach: a free Mine Shaft set to (or able to dig) that stock (#681).
      if (tile < 0 && (to === 'stone' || to === 'gold') && u.type === 'citizen') {
        const pit = freeShaft(s, p, u.x, u.y, LABOR.reach, pits);
        if (!pit || seamProblem(s, pit, to)) continue;
        pits.add(pit.id);
        if (seamOf(s, pit) !== to) pit.seam = to;
        giveOrder(u, { k: 'shaft', target: pit.id, res: to, phase: 'go' });
        moved++;
        continue;
      }
      if (tile < 0) continue;
      load.set(tile, (load.get(tile) ?? 0) + 1);
      giveOrder(u, { k: 'gather', tile, res: RES_OF_TILE[kind], phase: 'go' });
    }
    moved++;
  }
  if (moved >= Math.min(want, pool.length)) return { moved, why: null };
  return { moved, why: moved ? `Only ${moved} could reach ${to}` : `No free ${to} within reach` };
}
