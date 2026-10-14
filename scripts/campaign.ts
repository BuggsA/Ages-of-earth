/**
 * Plays each campaign scenario with a computer player in your seat, to check the goals can be reached.
 * The computer plays toward the chapter's goals (`chapterGoals` in src/sim/ai.ts).
 *   npx tsx scripts/campaign.ts [normal|hard] [scenario id …]
 * A report of win rates over several maps (the way to judge an AI or balance change, #43): each chapter
 * on its own seed and the next ones `chapterSeeds` gives, at one level or both, four matches at a time.
 *   npx tsx scripts/campaign.ts --seeds 6 [normal|hard|both] [scenario id …] [-j 4]
 */
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SCENARIOS } from '../src/sim/campaign';
import { chapterSeeds, playChapter } from '../src/sim/campaignPlay';
import type { Difficulty } from '../src/sim/types';

const args = process.argv.slice(2);

/** Pulls `--name value` out of the arguments. */
function option(name: string): string | undefined {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const [, v] = args.splice(i, 2);
  return v;
}

interface Match {
  id: string;
  level: Difficulty;
  seed: number;
  result: string;
  min: number;
}

function play(id: string, level: Difficulty, seed?: number): Match & { line: string } {
  const sc = SCENARIOS.find((c) => c.id === id)!;
  const t0 = performance.now();
  const s = playChapter(id, level, 50, seed);
  const run = s.scenario!;
  const me = s.players[0];
  const min = s.tick / 1200;
  const line = `${sc.title.padEnd(26)} ${(run.result ?? 'unfinished').padEnd(10)} at ${min.toFixed(1).padStart(4)} min; goals ${run.done.map((d) => (d ? '✔' : '·')).join('')}; kills ${me.stats.kills}, losses ${me.stats.losses}; ${(performance.now() - t0).toFixed(0)} ms`;
  return { id, level, seed: s.seed, result: run.result ?? 'unfinished', min, line };
}

const one = option('--one');
const seeds = option('--seeds');
const jobs = Number(option('-j') ?? 4);

if (one) {
  // A child of the report: one match, answered as JSON.
  const [id, level, seed] = one.split(',');
  const { line: _line, ...m } = play(id, level as Difficulty, Number(seed));
  console.log(JSON.stringify(m));
} else if (seeds) {
  await report(Number(seeds));
} else {
  const level = (args[0] ?? 'normal') as Difficulty;
  const only = args.slice(1);
  for (const sc of SCENARIOS) {
    if (only.length && !only.includes(sc.id)) continue;
    console.log(play(sc.id, level).line);
  }
}

async function report(n: number): Promise<void> {
  const which = args[0] ?? 'both';
  const levels: Difficulty[] = which === 'both' ? ['normal', 'hard'] : [which as Difficulty];
  const only = args.slice(1);
  const chapters = SCENARIOS.filter((c) => !only.length || only.includes(c.id));
  const todo = chapters.flatMap((c) => chapterSeeds(c.id, n).flatMap((seed) => levels.map((level) => ({ id: c.id, level, seed }))));
  const done: Match[] = [];
  const self = fileURLToPath(import.meta.url);
  const t0 = performance.now();
  const worker = async (): Promise<void> => {
    for (let job = todo.shift(); job; job = todo.shift()) {
      const { id, level, seed } = job;
      const out = await new Promise<string>((resolve, reject) => {
        let text = '';
        const child = fork(self, ['--one', `${id},${level},${seed}`], { stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
        child.stdout!.on('data', (d) => (text += d));
        child.on('exit', (code) => (code === 0 ? resolve(text) : reject(new Error(`${id} ${level} ${seed} exited ${code}`))));
      });
      done.push(JSON.parse(out.trim().split('\n').pop()!));
      process.stderr.write(`\r${done.length} matches played`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, worker));
  process.stderr.write('\n');
  const mark = (r: string) => (r === 'win' ? 'W' : r === 'lose' ? 'l' : '-');
  console.log(`Win rates over ${n} maps (W won, l lost, - unfinished), ${((performance.now() - t0) / 60000).toFixed(1)} min:`);
  for (const c of chapters) {
    const cells = levels.map((level) => {
      const row = chapterSeeds(c.id, n).map((seed) => done.find((m) => m.id === c.id && m.level === level && m.seed === seed)!);
      const wins = row.filter((m) => m.result === 'win').length;
      return `${level} ${row.map((m) => mark(m.result)).join('')} ${wins}/${n}`;
    });
    const anyWin = chapterSeeds(c.id, n).filter((seed) => done.some((m) => m.id === c.id && m.seed === seed && m.result === 'win')).length;
    console.log(`${c.title.padEnd(26)} ${cells.join('   ')}   maps won at some level ${anyWin}/${n}`);
  }
}
