/**
 * Where do a player's citizens stand idle, and why? (#344) A headless match in which seat 0 is a person
 * played by a patient, plain script: it trains citizens, sends each idle one to the food or wood it lacks
 * after a few seconds' reaction, and raises a house when the people is near its cap. Every time one of its
 * citizens falls idle on its own, the cause is counted. Each count is an order a real player must give.
 *   npx tsx scripts/idle-audit.ts [seed] [minutes] [small|medium|large]
 */
import { BUILDINGS, secs } from '../src/sim/data';
import { findSpot } from '../src/sim/ai';
import { createGame, step } from '../src/sim/game';
import { findResource } from '../src/sim/units';
import { townCenters } from '../src/sim/world';
import { R_BERRY, R_TREE } from '../src/sim/types';
import type { Command, GameState, Order, Unit } from '../src/sim/types';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const seed = Number(args[0] ?? 1);
const minutes = Number(args[1] ?? 12);
const size = (args[2] ?? 'medium') as 'small' | 'medium' | 'large';
const REACT = secs(4);
const HUNT = !process.argv.includes('--no-hunt');
const RALLY = !process.argv.includes('--no-rally');

function dist(s: GameState, t: number, b: { x: number; y: number }): number {
  return Math.hypot((t % s.w) + 0.5 - b.x, Math.floor(t / s.w) + 0.5 - b.y);
}

function nearestDeer(s: GameState, u: Unit, r: number) {
  let best = null;
  let bd = r * r;
  for (const a of s.animals) {
    if (a.kind !== 'deer' || a.hp <= 0) continue;
    const d = (a.x - u.x) * (a.x - u.x) + (a.y - u.y) * (a.y - u.y);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

export function audit(seed: number, minutes: number, size: 'small' | 'medium' | 'large') {
  const s: GameState = createGame({ seed, size, peaceMinutes: minutes, players: [{ name: 'You', ai: null, civ: 'egyptians' }, { name: 'Easy', ai: 'easy' }] });
  const last = new Map<number, string>();
  const idleSince = new Map<number, number>();
  const causes = new Map<string, number>();
  let idleTicks = 0;
  let orders = 0;
  let laden = 0;
  const tc = () => townCenters(s, 0).find((b) => b.built);
  const label = (o: Order): string => {
    if (o.k === 'gather') return `gather ${o.res}`;
    if (o.k === 'build') { const b = s.byId.get(o.target); return `build ${b && b.kind === 'building' ? b.type : '?'}`; }
    return o.k;
  };
  for (let i = 0; i < minutes * 60 * 20 && !s.over; i++) {
    const cmds: Command[] = [];
    const p = s.players[0];
    const home = tc();
    const mine = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen' && e.hp > 0);
    if (home && i === 1 && RALLY) {
      const t = findResource(s, R_TREE, home.x, home.y, 30);
      if (t >= 0) cmds.push({ t: 'rally', p: 0, building: home.id, x: (t % s.w) + 0.5, y: Math.floor(t / s.w) + 0.5 });
    }
    if (home && i % 20 === 0) {
      if (home.queue.length < 2 && p.res.food >= 50 && p.pop < p.cap) cmds.push({ t: 'train', p: 0, building: home.id, unit: 'citizen' });
      const building = mine.some((u) => u.order.k === 'build' && s.byId.get(u.order.target)?.kind === 'building' && (s.byId.get(u.order.target) as { type: string }).type === 'house');
      if (p.cap - p.pop <= 2 && p.res.wood >= (BUILDINGS.house.cost.wood ?? 0) && !building) {
        const u = mine.find((c) => c.order.k === 'gather' && c.order.res === 'wood') ?? mine[0];
        const spot = u && findSpot(s, 'house', home.x, home.y, 4, 12);
        if (u && spot) { cmds.push({ t: 'build', p: 0, ids: [u.id], type: 'house', tx: spot.tx, ty: spot.ty }); orders++; }
      }
    }
    for (const u of mine) {
      const now = u.order.k === 'idle' && !u.queue.length && !u.inside;
      const was = last.get(u.id);
      if (now) {
        idleTicks++;
        if (was && was !== 'idle') {
          causes.set(was, (causes.get(was) ?? 0) + 1);
          // A full basket and nothing to do: a citizen stuck on the way home, not one whose patch ran out.
          if (u.carry > 0) laden++;
        }
        if (!idleSince.has(u.id)) idleSince.set(u.id, s.tick);
        if (home && s.tick - idleSince.get(u.id)! >= REACT) {
          const food = p.res.food <= p.res.wood;
          const deer = food && HUNT ? nearestDeer(s, u, 20) : null;
          const t = findResource(s, food ? R_BERRY : R_TREE, u.x, u.y, 40);
          if (deer) { cmds.push({ t: 'hunt', p: 0, ids: [u.id], target: deer.id }); orders++; }
          else if (t >= 0 && (!food || dist(s, t, home) <= 25)) { cmds.push({ t: 'gather', p: 0, ids: [u.id], tile: t }); orders++; }
          else if (food && p.res.wood >= (BUILDINGS.farm.cost.wood ?? 0)) {
            // No bushes near home: a field, as a person would.
            const spot = findSpot(s, 'farm', home.x, home.y, 3, 14);
            if (spot) { cmds.push({ t: 'build', p: 0, ids: [u.id], type: 'farm', tx: spot.tx, ty: spot.ty }); orders++; }
          }
          idleSince.delete(u.id);
        }
      } else idleSince.delete(u.id);
      last.set(u.id, now ? 'idle' : was === 'new' && u.order.k === 'idle' ? 'new' : label(u.order));
      if (was === undefined) last.set(u.id, now ? 'new' : label(u.order));
    }
    step(s, cmds);
  }
  const cit = s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen').length;
  return { causes, idleSec: idleTicks / 20, orders, cit, laden };
}

// Run as a script, not when a test imports `audit`.
if (process.argv[1]?.endsWith('idle-audit.ts')) {
  const r = audit(seed, minutes, size);
  console.log(`seed ${seed}, ${minutes} min: ${r.cit} citizens, ${r.orders} orders given, ${Math.round(r.idleSec)} citizen-seconds idle, ${r.laden} left idle laden`);
  for (const [k, n] of [...r.causes].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  fell idle after: ${k}`);
}
