/**
 * The computer in the Age of Leviathans (`docs/wild-road.md` §5a): the first player starts each match already walked through the Wild
 * route to the Wildwood, with its Dens' beasts bred and stores to spend (or, with `in`, in the Age of Leviathans itself), so what it does
 * from there can be watched without the long road up. Prints its age, its Great Den, its Behemoth (bred, knelt, where), its Skywhales,
 * the soldiers they set down and the seed-bombs dropped, at sea (#789) its Krakens, Reef Ships and grips, and how the match ended.
 *   npx tsx scripts/leviathan-trial.ts [seeds] [minutes] [rival level] [in] [sea]
 */
import { AGES } from '../src/sim/data';
import { ageOf } from '../src/sim/ages';
import { createGame, enterAge, step } from '../src/sim/game';

const seeds = Number(process.argv[2] ?? 6);
const minutes = Number(process.argv[3] ?? 20);
/** `in`: start it in the Age of Leviathans itself, to watch its giants. */
const inside = process.argv[5] === 'in';
/** `sea`: on a sea map, to watch its Krakens and Reef Ships. */
const sea = process.argv[6] === 'sea';
for (let seed = 1; seed <= seeds; seed++) {
  const s = createGame({ seed, size: 'small', ...(sea ? { mapType: 'sea' as const } : {}), players: [{ name: 'Wild', ai: 'normal' }, { name: 'Rival', ai: (process.argv[4] ?? 'easy') as 'easy' }] });
  const p = s.players[0];
  for (const a of ['wild', 'grove', 'hive', 'wildwood', ...(inside ? (['leviathans'] as const) : [])] as const) enterAge(s, p, a);
  p.tamed = ['wolf'];
  p.stats.bred = 30;
  p.stats.honey = 300;
  p.stats.spread = 20;
  for (const q of s.players) q.res = { food: 4000, wood: 4000, stone: 1500, gold: 3000 };
  let entered = -1;
  let den = -1;
  let titan = -1;
  let knelt = -1;
  let whales = 0;
  let landed = 0;
  let bombs = 0;
  let seeded = 0;
  let krakens = 0;
  let reefs = 0;
  let grips = 0;
  for (let i = 0; i < minutes * 60 * 20 && !s.over; i++) {
    step(s);
    if (entered < 0 && ageOf(p) === 'leviathans') entered = s.tick;
    if (den < 0 && s.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === 'greatden' && e.built)) den = s.tick;
    for (const e of s.events) {
      if (e.k === 'trained' && e.owner === 0 && e.type === 'behemoth' && titan < 0) titan = s.tick;
      if (e.k === 'trained' && e.owner === 0 && e.type === 'skywhale') whales++;
      if (e.k === 'trained' && e.owner === 0 && e.type === 'kraken') krakens++;
      if (e.k === 'trained' && e.owner === 0 && e.type === 'reefship') reefs++;
      if (e.k === 'leviathan' && e.owner === 0 && e.what === 'grip') grips++;
      if (e.k === 'leviathan' && e.owner === 0 && e.what === 'kneel' && knelt < 0) knelt = s.tick;
      if (e.k === 'leviathan' && e.owner === 0 && e.what === 'bomb') {
        bombs++;
        seeded += e.n ?? 0;
      }
      if (e.k === 'garrison' && e.owner === 0 && !e.inside && s.byId.get(e.building)?.kind === 'unit' && (s.byId.get(e.building) as { type: string }).type === 'skywhale') landed++;
    }
  }
  const m = (t: number) => (t < 0 ? '-' : `${(t / 1200).toFixed(1)}m`);
  const how = s.events.find((e) => e.k === 'over');
  console.log(
    `seed ${seed} ${(s.tick / 1200).toFixed(1)}m winner ${s.winner >= 0 && s.over ? s.players[s.winner].name : '-'}${how && how.k === 'over' ? ` (${how.how})` : ''}: ${AGES[ageOf(p)].short}, entered ${m(entered)}, Great Den ${m(den)}, Behemoth ${m(titan)} knelt ${m(knelt)}, ${whales} whales, ${landed} landings, ${bombs} seed-bombs (${seeded} seedlings)${sea ? `, ${krakens} krakens, ${reefs} reef ships, ${grips} grips` : ''}`,
  );
}
