/**
 * Judge a people's core loop (#501): the computer plays that people (Hard) against another people (Hard), each seed twice with the
 * seats swapped, once with the people's loop as built and once with it switched off, so a change shows in the win rate.
 *   npx tsx scripts/civ-ab.ts <people> <versus> <first seed> <seeds> <minutes> [off]
 *   npx tsx scripts/civ-ab.ts romans greeks 1 6 25 off     (the Romans without the legion: the old play)
 * Prints a line a match and the people's wins, losses and undecided (who leads: the age reached, then kills less losses).
 */
import { CIVS } from '../src/sim/data';
import type { CivId } from '../src/sim/types';
import { createGame, step } from '../src/sim/game';

const civ = (process.argv[2] ?? 'romans') as CivId;
const versus = (process.argv[3] ?? 'greeks') as CivId;
const first = Number(process.argv[4] ?? 1);
const seeds = Number(process.argv[5] ?? 4);
const minutes = Number(process.argv[6] ?? 25);
if (process.argv[7] === 'off') for (const k of ['legion', 'polis', 'flood', 'household', 'nomad', 'longbow', 'coppice'] as const) delete CIVS[civ][k];
const tally = { won: 0, lost: 0, ahead: 0, behind: 0 };
for (let game = 0; game < seeds * 2; game++) {
  const seed = first + (game >> 1);
  const seat = game & 1;
  const s = createGame({ seed, size: 'medium', players: [0, 1].map((i) => ({ name: `P${i}`, ai: 'hard' as const, civ: i === seat ? civ : versus })) });
  for (let i = 0; i < minutes * 60 * 20 && !s.over; i++) step(s);
  const mine = s.players[seat];
  const theirs = s.players[1 - seat];
  const lead = mine.epoch - theirs.epoch || mine.stats.kills - mine.stats.losses - (theirs.stats.kills - theirs.stats.losses);
  const result = s.winner === seat ? 'won' : s.winner >= 0 ? 'lost' : lead > 0 ? 'ahead' : 'behind';
  tally[result]++;
  console.log(`${civ} seat ${seat} seed ${seed}: ${result} at ${(s.tick / 1200).toFixed(1)}m, epoch ${mine.epoch}/${theirs.epoch}, kills ${mine.stats.kills}/${theirs.stats.kills}, lost ${mine.stats.losses}/${theirs.stats.losses}, built ${mine.stats.built}/${theirs.stats.built}`);
}
console.log(`${civ} vs ${versus}${process.argv[7] === 'off' ? ' (loop off)' : ''}: won ${tally.won}, lost ${tally.lost}, ahead ${tally.ahead}, behind ${tally.behind}`);
