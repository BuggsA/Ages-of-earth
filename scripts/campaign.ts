/**
 * Plays each campaign scenario with a computer player in your seat, to check the goals can be reached.
 *   npx tsx scripts/campaign.ts [normal|hard]
 */
import { SCENARIOS } from '../src/sim/campaign';
import { createGame, step } from '../src/sim/game';

const level = (process.argv[2] ?? 'normal') as 'normal' | 'hard';
for (const sc of SCENARIOS) {
  const setup = { ...sc.setup, scenario: sc.id, players: sc.setup.players.map((p, i) => (i === 0 ? { ...p, ai: level } : p)) };
  const s = createGame(setup);
  const t0 = performance.now();
  while (!s.over && s.tick < 20 * 60 * 40) step(s);
  const run = s.scenario!;
  console.log(`${sc.title.padEnd(26)} ${run.result ?? 'unfinished'} at ${(s.tick / 1200).toFixed(1)} min; goals ${run.done.map((d) => (d ? '✔' : '·')).join('')}; ${(performance.now() - t0).toFixed(0)} ms`);
}
