/**
 * The computer in the Bloom (`docs/wild-road.md` §5b): the first player starts each match already walked through the Wild route to
 * the Wildwood, with a Heart Tree's spring paid and stores to spend (or, with `in`, in the Bloom itself), so what it does from there
 * can be watched without the long road up. Prints its age, Spire, Seeds slung, rooted, hacked out and cracked, the most green its land
 * reached, how the rival answered, and how the match ended.
 *   npx tsx scripts/bloom-trial.ts [seeds] [minutes] [rival level] [in]
 */
import { AGES } from '../src/sim/data';
import { ageOf } from '../src/sim/ages';
import { createGame, enterAge, step } from '../src/sim/game';

const seeds = Number(process.argv[2] ?? 6);
const minutes = Number(process.argv[3] ?? 20);
/** `in`: start it in the Bloom itself, to watch its Spire and the Greening. */
const inside = process.argv[5] === 'in';
for (let seed = 1; seed <= seeds; seed++) {
  const s = createGame({ seed, size: 'small', players: [{ name: 'Wild', ai: 'normal' }, { name: 'Rival', ai: (process.argv[4] ?? 'easy') as 'easy' }] });
  const p = s.players[0];
  for (const a of ['wild', 'grove', 'hive', 'wildwood', ...(inside ? (['bloom'] as const) : [])] as const) enterAge(s, p, a);
  p.tamed = ['wolf'];
  p.stats.honey = 300;
  p.stats.spread = 20;
  for (const q of s.players) q.res = { food: 4000, wood: 4000, stone: 1500, gold: 3000 };
  let entered = -1;
  let spire = -1;
  let green = 0;
  let held = 0;
  const n = { slung: 0, rooted: 0, hacked: 0, cracked: 0, razed: 0, withered: 0 };
  for (let i = 0; i < minutes * 60 * 20 && !s.over; i++) {
    step(s);
    if (entered < 0 && ageOf(p) === 'bloom') entered = s.tick;
    if (spire < 0 && s.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === 'spire' && e.built)) spire = s.tick;
    green = Math.max(green, p.green ?? 0);
    for (const e of s.events) {
      if (e.k !== 'bloom' || e.owner !== 0) continue;
      if (e.what === 'held') held++;
      else if (e.what in n) n[e.what as keyof typeof n]++;
      if (e.what === 'cracked') n.razed += e.n ?? 0;
    }
  }
  const m = (t: number) => (t < 0 ? '-' : `${(t / 1200).toFixed(1)}m`);
  const how = s.events.find((e) => e.k === 'over');
  console.log(
    `seed ${seed} ${(s.tick / 1200).toFixed(1)}m winner ${s.winner >= 0 && s.over ? s.players[s.winner].name : '-'}${how && how.k === 'over' ? ` (${how.how})` : ''}: ${AGES[ageOf(p)].short}, entered ${m(entered)}, Spire ${m(spire)}, ${n.slung} Seeds: ${n.rooted} rooted, ${n.hacked} hacked out, ${n.withered} withered, ${n.cracked} cracked (${n.razed} buildings), green ${(green / 10).toFixed(1)}% (held ${held}x)`,
  );
}
