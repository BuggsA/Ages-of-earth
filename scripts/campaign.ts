/**
 * Plays each campaign scenario with a computer player in your seat, to check the goals can be reached.
 * The computer plays toward the chapter's goals (`chapterGoals` in src/sim/ai.ts).
 *   npx tsx scripts/campaign.ts [normal|hard] [scenario id …]
 */
import { SCENARIOS } from '../src/sim/campaign';
import { playChapter } from '../src/sim/campaignPlay';

const level = (process.argv[2] ?? 'normal') as 'normal' | 'hard';
const only = process.argv.slice(3);
for (const sc of SCENARIOS) {
  if (only.length && !only.includes(sc.id)) continue;
  const t0 = performance.now();
  const s = playChapter(sc.id, level);
  const run = s.scenario!;
  const me = s.players[0];
  console.log(
    `${sc.title.padEnd(26)} ${(run.result ?? 'unfinished').padEnd(10)} at ${(s.tick / 1200).toFixed(1).padStart(4)} min; goals ${run.done.map((d) => (d ? '✔' : '·')).join('')}; kills ${me.stats.kills}, losses ${me.stats.losses}; ${(performance.now() - t0).toFixed(0)} ms`,
  );
}
