/**
 * Where do a whole town's citizens stand idle, and why? (#344) Like `idle-audit.ts`, but the patient player runs
 * a fuller town, for any people: it trains citizens, keeps a split of food, wood, stone and gold through the
 * Workers panel (`reassign`, idle first, a few seconds after one falls idle), raises houses, a storehouse by the
 * nearest wood and one by the nearest stone or gold, and a barracks, each with a hand taken off wood. Every time
 * one of its citizens falls idle on its own the cause is counted: each count is an order a real player must give.
 *   npx tsx scripts/town-audit.ts [civ|all] [seeds] [minutes] [small|medium|large]
 */
import { BUILDINGS, CIV_IDS, LABOR, secs } from '../src/sim/data';
import { findSpot } from '../src/sim/ai';
import { createGame, step } from '../src/sim/game';
import { findResource, freeFarm } from '../src/sim/units';
import { workforce } from '../src/sim/labor';
import { mineable } from '../src/sim/household';
import { townCenters } from '../src/sim/world';
import { snareSpot } from '../src/sim/snares';
import { R_BERRY, R_GOLD, R_STONE, R_TREE } from '../src/sim/types';
import type { BuildingType, CivId, Command, GameState, Job, Order, Unit } from '../src/sim/types';

const REACT = secs(4);
const SPLIT: [Job, number][] = [['food', 0.45], ['wood', 0.33], ['stone', 0.1], ['gold', 0.12]];

export interface TownAudit { causes: Map<string, number>; refused: Map<string, number>; idleSec: number; orders: number; cit: number }

export function townAudit(civ: CivId, seed: number, minutes: number, size: 'small' | 'medium' | 'large'): TownAudit {
  const s: GameState = createGame({ seed, size, peaceMinutes: minutes, players: [{ name: 'You', ai: null, civ }, { name: 'Easy', ai: 'easy' }] });
  const last = new Map<number, string>();
  const idleSince = new Map<number, number>();
  const causes = new Map<string, number>();
  const raised = new Set<string>();
  let idleTicks = 0;
  let orders = 0;
  const label = (o: Order): string => {
    if (o.k === 'gather' || o.k === 'shaft') return `${o.k} ${o.res}`;
    if (o.k === 'build') { const b = s.byId.get(o.target); return `build ${b && b.kind === 'building' ? b.type : '?'}`; }
    return o.k;
  };
  const p = s.players[0];
  const raise = (cmds: Command[], mine: Unit[], type: BuildingType, x: number, y: number, minR: number, maxR: number): boolean => {
    const cost = BUILDINGS[type].cost;
    for (const r of ['food', 'wood', 'stone', 'gold'] as const) if ((cost[r] ?? 0) > p.res[r]) return false;
    const u = mine.find((c) => c.order.k === 'gather' && c.order.res === 'wood') ?? mine.find((c) => c.order.k === 'idle') ?? mine[0];
    // A snare goes among standing trees (`snareSpot`), by the wood nearest the hand.
    const tree = type === 'snare' && u ? findResource(s, R_TREE, u.x, u.y, 30) : -1;
    if (tree >= 0) { x = (tree % s.w) + 0.5; y = Math.floor(tree / s.w) + 0.5; }
    const spot = u && findSpot(s, type, x, y, type === 'snare' ? 0 : minR, maxR, 1, type === 'snare' ? (tx, ty) => !snareSpot(s, tx, ty) : undefined);
    if (!u || !spot) return false;
    cmds.push({ t: 'build', p: 0, ids: [u.id], type, tx: spot.tx, ty: spot.ty });
    orders++;
    return true;
  };
  const farmOf = (): BuildingType => (civ === 'britons' ? 'snare' : 'farm');
  // The Workers panel said last time that it found no food: lay a field (or a snare) as a person would.
  let starved = false;
  const raising = () => new Set(s.ents.flatMap((e) => (e.kind === 'unit' && e.owner === 0 && e.order.k === 'build' ? [e.order.target] : [])));
  const noField = (u: Unit): boolean => findResource(s, R_BERRY, u.x, u.y, LABOR.reach) < 0 && !freeFarm(s, 0, u.x, u.y, LABOR.reach, raising());
  const refused = new Map<string, number>();
  for (let i = 0; i < minutes * 60 * 20 && !s.over; i++) {
    const cmds: Command[] = [];
    const home = townCenters(s, 0).find((b) => b.built);
    const mine = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen' && e.hp > 0);
    if (home && i % 20 === 0) {
      if (home.queue.length < 2 && p.res.food >= 50 && p.pop < p.cap && mine.length < 40) cmds.push({ t: 'train', p: 0, building: home.id, unit: 'citizen' });
      const houses = mine.some((u) => u.order.k === 'build' && (s.byId.get(u.order.target) as { type?: string } | undefined)?.type === 'house');
      if (p.cap - p.pop <= 2 && !houses) raise(cmds, mine, 'house', home.x, home.y, 4, 12);
      const minute = i / 1200;
      if (minute >= 2 && !raised.has('wood')) {
        const t = findResource(s, R_TREE, home.x, home.y, 30);
        if (t >= 0 && raise(cmds, mine, 'storehouse', (t % s.w) + 0.5, Math.floor(t / s.w) + 0.5, 2, 5)) raised.add('wood');
      }
      if (minute >= 4 && !raised.has('mine')) {
        const kind = mineable(p, R_GOLD) ? R_GOLD : R_STONE;
        const t = findResource(s, kind, home.x, home.y, 30);
        if (t < 0) raised.add('mine');
        else if (raise(cmds, mine, 'storehouse', (t % s.w) + 0.5, Math.floor(t / s.w) + 0.5, 2, 5)) raised.add('mine');
      }
      if (minute >= 6 && !raised.has('barracks') && raise(cmds, mine, 'barracks', home.x, home.y, 5, 14)) raised.add('barracks');
      // The Workers panel: an idle hand left a few seconds goes where the split is furthest behind.
      const jobs = workforce(s, 0);
      const ready = mine.filter((u) => idleSince.has(u.id) && s.tick - idleSince.get(u.id)! >= REACT);
      if (ready.length) {
        const total = mine.length;
        const gap = (j: Job, share: number) => share * total - (jobs.get(j)?.length ?? 0);
        const order = SPLIT.filter(([j]) => (j !== 'gold' || mineable(p, R_GOLD))).sort((a, b) => gap(b[0], b[1]) - gap(a[0], a[1]));
        const to = order[0][0];
        // No bush, carcass or free field in reach: a person lays a field (or a snare where fields are barred) with one of them.
        if (to === 'food' && (starved || (civ !== 'britons' && civ !== 'mongols' && noField(ready[0]))) && raise(cmds, [ready[0]], farmOf(), ready[0].x, ready[0].y, 1, 10)) ready.shift();
        // Failing that, the next job behind: hands the first can't place go on to it (the panel moves only the idle).
        if (ready.length) for (const [j] of order) cmds.push({ t: 'reassign', p: 0, from: 'idle', to: j, n: ready.length });
        orders++;
        for (const u of ready) idleSince.delete(u.id);
      }
    }
    for (const u of mine) {
      const now = u.order.k === 'idle' && !u.queue.length && !u.inside;
      const was = last.get(u.id);
      if (now) {
        idleTicks++;
        if (was && was !== 'idle') causes.set(was, (causes.get(was) ?? 0) + 1);
        if (!idleSince.has(u.id)) idleSince.set(u.id, s.tick);
      } else idleSince.delete(u.id);
      last.set(u.id, now ? (was === undefined ? 'new' : 'idle') : label(u.order));
    }
    step(s, cmds);
    for (const e of s.events) if (e.k === 'refused' && e.owner === 0 && e.why !== 'No one is idle') refused.set(e.why, (refused.get(e.why) ?? 0) + 1);
    if (i % 20 === 0) starved = s.events.some((e) => e.k === 'refused' && e.owner === 0 && e.why.startsWith('No free food'));
  }
  return { causes, refused, idleSec: idleTicks / 20, orders, cit: s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen').length };
}

// Run as a script, not when a test imports `townAudit`.
if (process.argv[1]?.endsWith('town-audit.ts')) {
  const args = process.argv.slice(2);
  const civs = !args[0] || args[0] === 'all' ? CIV_IDS : [args[0] as CivId];
  const seeds = Number(args[1] ?? 3);
  const minutes = Number(args[2] ?? 15);
  const size = (args[3] ?? 'medium') as 'small' | 'medium' | 'large';
  const all = new Map<string, number>();
  for (const civ of civs) {
    const sum = new Map<string, number>();
    let idle = 0;
    let orders = 0;
    const refused = new Map<string, number>();
    for (let seed = 1; seed <= seeds; seed++) {
      const r = townAudit(civ, seed, minutes, size);
      idle += r.idleSec;
      orders += r.orders;
      for (const [k, n] of r.refused) refused.set(k, (refused.get(k) ?? 0) + n);
      for (const [k, n] of r.causes) { sum.set(k, (sum.get(k) ?? 0) + n); all.set(k, (all.get(k) ?? 0) + n); }
    }
    console.log(`${civ}: ${seeds} seeds × ${minutes} min, ${orders} orders, ${Math.round(idle)} citizen-seconds idle`);
    for (const [k, n] of [...sum].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  fell idle after: ${k}`);
    for (const [k, n] of [...refused].sort((a, b) => b[1] - a[1]).slice(0, 3)) console.log(`  ${String(n).padStart(4)}× refused: ${k}`);
  }
  if (civs.length > 1) {
    console.log('all peoples:');
    for (const [k, n] of [...all].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  fell idle after: ${k}`);
  }
}
