/**
 * Goal 1's measure (#463): two computer players on one seed, each held to a different Way, played side by
 * side, so the first minutes of their openings can be set next to each other.
 *   npx tsx scripts/opening.ts [seed] [wayA] [wayB] [minutes] [size]
 *   npx tsx scripts/opening.ts 3 hunt hearth 15
 * Prints a row a minute (citizens, soldiers, buildings, stockpile, the meat and gathering so far, kills) and,
 * after it, when each kind of building first stood (`first`), so two openings that only differ in numbers
 * look the same and two that differ in what the people do do not. Ways are those in `WAYS` (`data.ts`).
 */
import { AGES, WAYS, WAY_IDS } from '../src/sim/data';
import { ageOf } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';
import { takeWay } from '../src/sim/ways';
import type { WayId } from '../src/sim/types';

const seed = Number(process.argv[2] ?? 1);
const picks = [process.argv[3] ?? WAY_IDS[0], process.argv[4] ?? WAY_IDS[1]] as WayId[];
const minutes = Number(process.argv[5] ?? 15);
const size = (process.argv[6] ?? 'medium') as 'small' | 'medium' | 'large';
for (const w of picks) if (!WAYS[w]) throw new Error(`no Way "${w}"; try ${WAY_IDS.join(', ')}`);
const s = createGame({ seed, size, players: picks.map((w, i) => ({ name: WAYS[w].name + (picks[0] === picks[1] ? ` ${i + 1}` : ''), ai: 'hard' })) });
s.players.forEach((p, i) => takeWay(s, p, picks[i]));
/** Per player: the minute each building type first stood, and each age was reached. */
const first = s.players.map(() => new Map<string, number>());
const ages = s.players.map((p) => [`${AGES[ageOf(p)].short}@0m`]);
const at = s.players.map((p) => ageOf(p));
const col = (t: string) => t.padEnd(46);
console.log(`seed ${seed}, ${size}: ${s.players.map((p) => p.name).join(' vs ')}`);
console.log(`min  ${s.players.map((p) => col(`${p.name}: cit/sol/bld  food wood stone gold  hunted kills`)).join(' ')}`);
for (let i = 0; i <= minutes * 60 * 20 && !s.over; i++) {
  if (i) step(s);
  const m = s.tick / 1200;
  for (const e of s.ents) if (e.kind === 'building' && e.built && !first[e.owner].has(e.type)) first[e.owner].set(e.type, Math.round(m * 10) / 10);
  for (const p of s.players) if (ageOf(p) !== at[p.id]) { at[p.id] = ageOf(p); ages[p.id].push(`${AGES[at[p.id]].short}@${m.toFixed(1)}m`); }
  if (i % 1200) continue;
  const row = s.players.map((p) => {
    const mine = s.ents.filter((e) => e.owner === p.id);
    const cit = mine.filter((e) => e.kind === 'unit' && e.type === 'citizen').length;
    const sol = mine.filter((e) => e.kind === 'unit').length - cit;
    const bld = mine.filter((e) => e.kind === 'building').length;
    const r = p.res;
    return col(`${String(cit).padStart(3)}/${String(sol).padStart(3)}/${String(bld).padStart(3)}  ${[r.food, r.wood, r.stone, r.gold].map((v) => String(Math.floor(v)).padStart(4)).join(' ')}  ${String(Math.floor(p.stats.hunted ?? 0)).padStart(6)} ${String(p.stats.kills).padStart(5)}`);
  });
  console.log(`${String(i / 1200).padStart(3)}  ${row.join(' ')}`);
}
for (const p of s.players) {
  console.log(`first ${p.name}: ${[...first[p.id]].map(([t, m]) => `${t} ${m}m`).join(', ')}`);
  console.log(`ages  ${p.name}: ${ages[p.id].join(' → ')}`);
}
