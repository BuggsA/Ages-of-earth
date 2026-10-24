/**
 * The computer in the Wildwood (`docs/wild-road.md` §4): the first player starts each match already walked through the Wild, the
 * Grove and the Hive, with a Hive's honey paid and stores to spend, so what it does from there can be watched without the long road
 * up (from a plain start it seldom reaches the Grove, #742). Prints its age, Heart Tree, Ents awake and rooted, and the woods' spread.
 *   npx tsx scripts/wildwood-trial.ts [seeds] [minutes] [rival level] [in]
 */
import { AGES } from '../src/sim/data';
import { ageOf } from '../src/sim/ages';
import { createGame, enterAge, step } from '../src/sim/game';

const seeds = Number(process.argv[2] ?? 6);
const minutes = Number(process.argv[3] ?? 15);
/** `in`: start it in the Wildwood itself, to watch its Heart Tree and Ents. */
const inside = process.argv[5] === 'in';
for (let seed = 1; seed <= seeds; seed++) {
  const s = createGame({ seed, size: 'small', players: [{ name: 'Wild', ai: 'normal' }, { name: 'Rival', ai: (process.argv[4] ?? 'easy') as 'easy' }] });
  const p = s.players[0];
  for (const a of ['wild', 'grove', 'hive', ...(inside ? (['wildwood'] as const) : [])] as const) enterAge(s, p, a);
  p.tamed = ['wolf'];
  p.stats.honey = 300;
  for (const q of s.players) q.res = { food: 3000, wood: 3000, stone: 800, gold: 2000 };
  let entered = -1;
  let planted = -1;
  let most = 0;
  for (let i = 0; i < minutes * 60 * 20 && !s.over; i++) {
    step(s);
    if (entered < 0 && ageOf(p) === 'wildwood') entered = s.tick;
    if (planted < 0 && s.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === 'heart' && e.built)) planted = s.tick;
    if (i % 200 === 0) most = Math.max(most, s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'warden').length);
  }
  const m = (t: number) => (t < 0 ? '-' : `${(t / 1200).toFixed(1)}m`);
  const hives = s.ents.filter((e) => e.kind === 'building' && e.owner === 0 && e.type === 'hive').length;
  const awake = s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'warden' && e.hp > 0).length;
  console.log(`seed ${seed} ${(s.tick / 1200).toFixed(1)}m winner ${s.winner >= 0 ? s.players[s.winner].name : '-'}: ${AGES[ageOf(p)].short}, entered ${m(entered)}, Heart Tree ${m(planted)}, Ents ${awake} awake (most ${most}), ${s.wardens?.filter((w) => w.owner === 0).length ?? 0} rooted, ${p.stats.trained} trained, ${hives} hives, honey ${p.stats.honey}`);
}
