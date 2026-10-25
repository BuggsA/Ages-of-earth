/**
 * The Wild → Grove step (#742), watched: with the Wild road forced on for both computers, when each enters the Wild, raises its
 * first Den, rears its beasts, and which age it leaves for. `npx tsx scripts/grove-scan.ts [seeds] [minutes]`
 */
import { AGES } from '../src/sim/data';
import { ageOf, hasWalked } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';

const seeds = Number(process.argv[2] ?? 6);
const minutes = Number(process.argv[3] ?? 30);
let wild = 0;
let grove = 0;
let hive = 0;
for (let seed = 1; seed <= seeds; seed++) {
  const s = createGame({ seed, size: 'small', players: [{ name: 'Normal', ai: 'normal' }, { name: 'Hard', ai: 'hard' }] });
  const log: string[][] = s.players.map(() => []);
  const seen = s.players.map(() => ({ age: 'stone' as string, den: false, tamed: 0, roads: '' }));
  const m = (t: number) => (t / 1200).toFixed(1);
  for (let i = 0; i < minutes * 60 * 20 && !s.over; i++) {
    for (const p of s.players) if (s.ai[p.id]) (s.ai[p.id].roads ??= {}).wild = true;
    step(s);
    if (i % 20) continue;
    for (const p of s.players) {
      const w = seen[p.id];
      const a = ageOf(p);
      if (a !== w.age) log[p.id].push(`${m(s.tick)} ${AGES[a].short}`), (w.age = a);
      const den = s.ents.some((e) => e.kind === 'building' && e.owner === p.id && e.type === 'den' && e.built);
      if (den !== w.den) log[p.id].push(`${m(s.tick)} den${den ? '+' : '-'}`), (w.den = den);
      if ((p.tamed?.length ?? 0) !== w.tamed) log[p.id].push(`${m(s.tick)} tamed[${p.tamed}]`), (w.tamed = p.tamed?.length ?? 0);
      const r = JSON.stringify(s.ai[p.id]?.roads?.grove);
      if (r !== w.roads) log[p.id].push(`${m(s.tick)} grove:${r}`), (w.roads = r);
    }
  }
  for (const p of s.players) {
    if (hasWalked(p, 'wild')) wild++;
    if (hasWalked(p, 'grove')) grove++;
    if (hasWalked(p, 'hive')) hive++;
    console.log(`seed ${seed} ${p.name}: bred ${p.stats.bred ?? 0}, res ${JSON.stringify(p.res)} | ${log[p.id].join(', ')}`);
  }
}
console.log(`walked the Wild ${wild}, the Grove ${grove}, the Hive ${hive}`);
