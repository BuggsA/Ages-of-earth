/**
 * Judge a change to how the computer plays against the old play, in the same matches (#113): one seat
 * plays Hard as it stands, the other a copy of Hard with some of its numbers set back (`AI_LEVELS`, in
 * `src/sim/data.ts`). Gate a change on a number there (`armyWait`, `bell`), set the number back here, and
 * each seed is played twice, seats swapped, so the map and the peoples even out.
 *   npx tsx scripts/ai-ab.ts <first seed> <seeds> <minutes> '<old numbers, JSON>' ['<new numbers, JSON>']
 *   npx tsx scripts/ai-ab.ts 21 6 20 '{"armyWait":1e9}'
 *   npx tsx scripts/ai-ab.ts 21 6 20 '{"fort":false}'   (the forward Tower, #132)
 * Prints an `ab {…}` line a match (for totting up runs played side by side) and a summary: wins, who
 * leads the undecided (the age reached, then kills less losses), the new side's gathering over the old
 * side's (geometric mean, with its standard error) and how far ahead in the ages it ends on average.
 *   …  '{}' '{"wonderGuard":false}' ... a 7th argument is extra game setup, e.g. '{"startEpoch":3,"rich":3000}' (`rich`: wood, stone and gold added to both seats) for a Wonder race (#374); `age` puts both seats in a side age on their start epoch, e.g. '{"startEpoch":4,"age":"aeronaut","rich":3000}' to judge the Airfield's fighter guard (#393)
 *   …  '{"hemo":false}' '{}' '{"startEpoch":4,"age":"totalwar","walked":["warband","ironblood"]}' also lists the ages `walked` before it, for Hemocraft (#355 s5)
 *   …  '{"rite":false}' '{}' '{"startEpoch":4,"age":"bloodrite","walked":["warband","ironblood","totalwar"]}' judges the Blood-rite's priests (#355 s4)
 *   …  '{"healers":false}' judges the computer's priests leaving a heal they took up by themselves for a relic, a ward or a conversion
 *   …  '{"fork":false}' '{}' '{"startEpoch":4,"age":"totalwar","walked":["warband","ironblood"]}' judges the computer taking the fork past Total War (#355 s5); its roads show in each `ab` line
 * The old side plays under Normal's name, so the few choices made by name (merchant ships kept) differ.
 */
import { AGES, AI_LEVELS } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { ageOf, noteWalked } from '../src/sim/ages';

const first = Number(process.argv[2] ?? 1);
const seeds = Number(process.argv[3] ?? 6);
const minutes = Number(process.argv[4] ?? 20);
Object.assign(AI_LEVELS.hard, JSON.parse(process.argv[6] ?? '{}'));
AI_LEVELS.normal = { ...AI_LEVELS.hard, label: 'Old', ...JSON.parse(process.argv[5] ?? '{}') };
const { rich = 0, age, walked = [], ...extra } = JSON.parse(process.argv[7] ?? '{}');
const tally = { won: 0, lost: 0, ahead: 0, behind: 0, gather: [] as number[], ages: 0 };
for (let game = 0; game < seeds * 2; game++) {
  const seed = first + (game >> 1);
  const fresh = game & 1;
  const s = createGame({ seed, size: 'medium', ...extra, players: [0, 1].map((i) => ({ name: `P${i}`, ai: i === fresh ? 'hard' : 'normal' })) });
  if (rich) for (const p of s.players) for (const r of ['wood', 'stone', 'gold'] as const) p.res[r] += rich;
  if (age) for (const p of s.players) { p.age = age; p.walked = [...walked]; noteWalked(p, age); }
  const began = [false, false];
  const at = s.players.map((p) => ageOf(p));
  const roads = s.players.map((p) => [AGES[ageOf(p)].short]);
  for (let i = 0; i < minutes * 60 * 20 && !s.over; i++) {
    step(s);
    if (!began.some(Boolean) || i % 20 === 0) for (const e of s.ents) if (e.kind === 'building' && e.type === 'wonder') began[e.owner] = true;
    if (i % 20) continue;
    for (const p of s.players) {
      const a = ageOf(p);
      if (at[p.id] === a) continue;
      at[p.id] = a;
      roads[p.id].push(`${AGES[a].short}@${Math.round(s.tick / 1200)}m`);
    }
  }
  const n = s.players[fresh];
  const o = s.players[1 - fresh];
  const margin = n.epoch - o.epoch || n.stats.kills - n.stats.losses - (o.stats.kills - o.stats.losses);
  if (s.winner >= 0) tally[s.winner === fresh ? 'won' : 'lost']++;
  else if (margin) tally[margin > 0 ? 'ahead' : 'behind']++;
  tally.gather.push(Math.log(n.stats.gathered / o.stats.gathered));
  tally.ages += n.epoch - o.epoch;
  console.log(`ab ${JSON.stringify({ seed, seat: fresh, won: s.winner < 0 ? null : s.winner === fresh, margin, wonders: began.map(Number).join(''), gn: Math.round(n.stats.gathered), go: Math.round(o.stats.gathered), new: roads[fresh].join('→'), old: roads[1 - fresh].join('→') })}`);
}
const g = tally.gather;
const mean = g.reduce((a, b) => a + b, 0) / g.length;
const sd = Math.sqrt(g.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, g.length - 1));
console.log(`new ${tally.won}–${tally.lost} of ${g.length}; undecided: new ahead in ${tally.ahead}, behind in ${tally.behind}; gathered ×${Math.exp(mean).toFixed(3)} (se ${(sd / Math.sqrt(g.length)).toFixed(3)}); ages ahead ${(tally.ages / g.length).toFixed(2)}`);
