/**
 * The Ways' balance (#486): many hard-v-hard matches, each line one match, so runs played side by side can be
 * totted up. `pick` lets the computer choose its Way (`wayFor`), with the peoples the seed gives; `hunt-hearth` (any two of
 * `WAY_IDS`) holds the seats to those Ways, swapping seats seed by seed so the map evens out, and both seats play the
 * same people (the seed's), so a people's strength isn't counted as its Way's. Homelands cycle through `HOMELANDS` by
 * seed unless one is named ('random' rolls the seed's own).
 *   npx tsx scripts/ways-sweep.ts <first seed> <seeds> <minutes> <pick|wayA-wayB> [size] [homeland|cycle] [peace minutes]
 *   npx tsx scripts/ways-sweep.ts 31 16 25 pick small
 *   npx tsx scripts/ways-sweep.ts 31 16 25 hunt-hearth small
 * Prints a `way {…}` line a match and a summary: wins by Way, and for the undecided the Way ahead (the age
 * reached, then the units standing, then all gathered). Tot up several runs with `npx tsx scripts/ways-sweep.ts sum < lines`.
 * A treaty (`peace`, say 15 with 12 minutes) leaves out the fights and judges the openings' economies alone, in seconds a match.
 */
import { readFileSync } from 'node:fs';
import { CIV_IDS, HOMELANDS, WAYS, WAY_IDS } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { takeWay } from '../src/sim/ways';
import type { HomelandId, WayId } from '../src/sim/types';

interface Row { seed: number; land: string; ways: string[]; civs: string[]; won: string | null; ahead: string | null; epochs: number[]; pop: number[]; kills: number[]; raided: number[]; gathered: number[] }

function summary(rows: Row[]): void {
  const t: Record<string, { won: number; ahead: number; seats: number }> = {};
  for (const w of WAY_IDS) t[w] = { won: 0, ahead: 0, seats: 0 };
  let draws = 0;
  for (const r of rows) {
    for (const w of r.ways) t[w].seats++;
    if (r.ways[0] === r.ways[1]) continue;
    if (r.won) t[r.won].won++;
    else if (r.ahead) t[r.ahead].ahead++;
    else draws++;
  }
  console.log(`${rows.length} matches, ${draws} even (mirrors not counted):`);
  for (const w of WAY_IDS) console.log(`  ${w.padEnd(8)} seats ${String(t[w].seats).padStart(3)}  won ${String(t[w].won).padStart(3)}  ahead ${String(t[w].ahead).padStart(3)}`);
  const lands: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (r.ways[0] === r.ways[1]) continue;
    const l = (lands[r.land] ??= {});
    const k = r.won ?? (r.ahead ? `~${r.ahead}` : 'even');
    l[k] = (l[k] ?? 0) + 1;
  }
  for (const [l, k] of Object.entries(lands)) console.log(`  ${l.padEnd(10)} ${Object.entries(k).map(([a, n]) => `${a} ${n}`).join(', ')}`);
}

if (process.argv[2] === 'sum') {
  const text = readFileSync(0, 'utf8');
  summary(text.split('\n').filter((l) => l.startsWith('way ')).map((l) => JSON.parse(l.slice(4)) as Row));
} else {
  const first = Number(process.argv[2] ?? 31);
  const seeds = Number(process.argv[3] ?? 16);
  const minutes = Number(process.argv[4] ?? 25);
  const mode = process.argv[5] ?? 'pick';
  const size = (process.argv[6] ?? 'small') as 'small' | 'medium' | 'large';
  const named = process.argv[7] && process.argv[7] !== 'cycle' ? (process.argv[7] as HomelandId | 'random') : undefined;
  const peaceMinutes = Number(process.argv[8] ?? 0);
  const lands = Object.keys(HOMELANDS) as HomelandId[];
  const forced = mode === 'pick' ? null : (mode.split('-') as WayId[]);
  if (forced) for (const w of forced) if (!WAYS[w]) throw new Error(`no Way "${w}"; try ${WAY_IDS.join(', ')}`);
  const rows: Row[] = [];
  for (let seed = first; seed < first + seeds; seed++) {
    const homeland = named ?? lands[seed % lands.length];
    const s = createGame({ seed, size, homeland, peaceMinutes, players: [0, 1].map((i) => ({ name: `P${i}`, ai: 'hard' as const, ...(forced ? { civ: CIV_IDS[seed % CIV_IDS.length] } : {}) })) });
    if (forced) s.players.forEach((p, i) => takeWay(s, p, forced[(i + seed) & 1]));
    for (let i = 0; i < minutes * 60 * 20 && !s.over; i++) step(s);
    const ps = s.players;
    const ways = ps.map((p) => p.way ?? 'none');
    const pop = ps.map((p) => s.ents.filter((e) => e.owner === p.id && e.kind === 'unit').length);
    // Undecided: the age reached, then the people (units) standing, then all gathered.
    const score = ps.map((p, i) => p.epoch * 1e6 + pop[i] * 1e3 + p.stats.gathered / 100);
    const lead = score[0] === score[1] ? -1 : score[0] > score[1] ? 0 : 1;
    const row: Row = {
      seed, land: s.homeland ?? 'glade', ways, civs: ps.map((p) => p.civ),
      won: s.winner >= 0 ? ways[s.winner] : null,
      ahead: s.winner < 0 && lead >= 0 ? ways[lead] : null,
      epochs: ps.map((p) => p.epoch), pop, kills: ps.map((p) => p.stats.kills),
      raided: ps.map((p) => Math.round(p.stats.raided ?? 0)), gathered: ps.map((p) => Math.round(p.stats.gathered)),
    };
    rows.push(row);
    console.log(`way ${JSON.stringify(row)}`);
  }
  summary(rows);
}
