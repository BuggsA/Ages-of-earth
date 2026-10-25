/**
 * The computer in the Age of the Mycelium (#800, `docs/wild-road.md` §R): the first player starts each match in the Age of the Wild with a
 * wolf tamed and stores to spend, and of a mind to walk the Mycelium and on to the Bloom (with `in`, in the Mycelium itself), so what it
 * does can be watched without the long road up. Prints when it raised its lodge, picked or bought its caps, entered the Mycelium and the
 * Bloom, the web at its widest, the stock it banked through the web, the most of its people hidden at once, what its rot razed, its
 * Heart Tree and Seeds, and how the match ended.
 *   [FROM=first seed] npx tsx scripts/mycelium-trial.ts [seeds] [minutes] [rival level] [in]
 */
import { AGES } from '../src/sim/data';
import { ageOf } from '../src/sim/ages';
import { createGame, enterAge, step } from '../src/sim/game';
import type { AiMemory } from '../src/sim/types';

const seeds = Number(process.argv[2] ?? 6);
const minutes = Number(process.argv[3] ?? 25);
const inside = process.argv[5] === 'in';
for (let seed = Number(process.env.FROM ?? 1); seed < Number(process.env.FROM ?? 1) + seeds; seed++) {
  const s = createGame({ seed, size: 'small', players: [{ name: 'Web', ai: 'normal' }, { name: 'Rival', ai: (process.argv[4] ?? 'easy') as 'easy' }] });
  const p = s.players[0];
  for (const a of ['wild', ...(inside ? (['mycelium'] as const) : [])] as const) enterAge(s, p, a);
  p.tamed = ['wolf'];
  p.stats.bred = 6;
  for (const q of s.players) q.res = { food: 3000, wood: 3000, stone: 800, gold: 2000 };
  s.ai[0] = { next: 10, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: { mycelium: true, bloom: true } } as AiMemory;
  let lodge = -1;
  let caps = -1;
  let entered = -1;
  let bloom = -1;
  let heart = -1;
  let widest = 0;
  let hidden = 0;
  let razed = 0;
  let slung = 0;
  for (let i = 0; i < minutes * 60 * 20 && !s.over; i++) {
    step(s);
    if (lodge < 0 && p.techs.includes('survey')) lodge = s.tick;
    if (caps < 0 && (p.stats.mined?.glowcap ?? 0) > 0) caps = s.tick;
    if (entered < 0 && ageOf(p) === 'mycelium') entered = s.tick;
    if (bloom < 0 && ageOf(p) === 'bloom') bloom = s.tick;
    if (heart < 0 && s.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === 'heart' && e.built)) heart = s.tick;
    if (s.tick % 20 === 0) {
      let n = 0;
      let webs = 0;
      for (const e of s.ents) {
        if (e.kind === 'unit' && e.owner === 0 && e.cloak) n++;
        if (e.kind === 'building' && e.owner === 0 && e.web) webs++;
      }
      hidden = Math.max(hidden, n);
      widest = Math.max(widest, webs);
    }
    for (const e of s.events) {
      if (e.k === 'destroyed' && e.owner === 1 && (e as { by?: number }).by === 0) razed++;
      if (e.k === 'bloom' && e.what === 'slung' && e.owner === 0) slung++;
    }
  }
  const m = (t: number) => (t < 0 ? '-' : `${(t / 1200).toFixed(1)}m`);
  const how = s.events.find((e) => e.k === 'over');
  console.log(
    `seed ${seed} ${(s.tick / 1200).toFixed(1)}m winner ${s.winner >= 0 && s.over ? s.players[s.winner].name : '-'}${how && how.k === 'over' ? ` (${how.how})` : ''}: ${AGES[ageOf(p)].short}, ${s.rares?.includes('glowcap') ? 'hollow' : 'no hollow'}, lodge ${m(lodge)}, caps ${m(caps)} (${p.stats.mined?.glowcap ?? 0}), Mycelium ${m(entered)}, Bloom ${m(bloom)}, ${widest} halls webbed, ${Math.floor(p.stats.webbed ?? 0)} webbed, ${hidden} hidden at once, Heart Tree ${m(heart)}, ${slung} Seeds slung, ${p.stats.razed} razed`,
  );
}
