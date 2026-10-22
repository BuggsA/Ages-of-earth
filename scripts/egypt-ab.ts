/**
 * The Egyptian computer against its usual rivals (#517): Egyptian Hard vs Romans (odd seeds) / Britons (even seeds), Hard, small,
 * 20 minutes, each seed twice with the seats swapped. Prints an `eg {…}` line a match: the Egyptian epoch and the rival's, who
 * won, the Egyptian army at 6 minutes, kills and losses. Add `off` to play without the Nile flood, the measure of what the
 * flood costs the computer. Judge over many seeds (32 and more): one match is chaos.
 *   npx tsx scripts/egypt-ab.ts <first seed> <seeds> [off]
 *   npx tsx scripts/egypt-ab.ts 1 16          (32 matches, about 5 minutes on one core; split the seeds over cores)
 */
import { CIVS } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { CivId } from '../src/sim/types';

const first = Number(process.argv[2] ?? 1);
const seeds = Number(process.argv[3] ?? 1);
if (process.argv[4] === 'off') delete CIVS.egyptians.flood;
const tally = { epochs: 0, rival: 0, won: 0, lost: 0, stalled: 0 };
for (let seed = first; seed < first + seeds; seed++) {
  for (const seat of [0, 1]) {
    const versus: CivId = seed % 2 ? 'romans' : 'britons';
    const s = createGame({ seed, size: 'small', players: [0, 1].map((i) => ({ name: `P${i}`, ai: 'hard' as const, civ: i === seat ? 'egyptians' : versus })) });
    let army6 = -1;
    for (let i = 0; i < 20 * 60 * 20 && !s.over; i++) {
      step(s);
      if (i === 6 * 60 * 20) army6 = s.ents.filter((e) => e.kind === 'unit' && e.owner === seat && e.type !== 'citizen' && e.hp > 0).length;
    }
    const m = s.players[seat];
    const o = s.players[1 - seat];
    tally.epochs += m.epoch;
    tally.rival += o.epoch;
    if (s.winner >= 0) tally[s.winner === seat ? 'won' : 'lost']++;
    if (m.epoch <= 1) tally.stalled++;
    console.log(`eg ${JSON.stringify({ seed, seat, versus, epoch: m.epoch, rival: o.epoch, won: s.winner < 0 ? null : s.winner === seat, army6, kills: m.stats.kills, losses: m.stats.losses })}`);
  }
}
console.log(`egyptians${process.argv[4] === 'off' ? ' (no flood)' : ''}: epochs ${tally.epochs}, rival ${tally.rival}, won ${tally.won}, lost ${tally.lost}, stalled (epoch ≤ 1) ${tally.stalled}`);
