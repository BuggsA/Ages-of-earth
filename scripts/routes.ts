/**
 * Route sweeps (#555 s0): plays a Hard computer bound to each basic route against a Normal computer on several maps,
 * and reports how often it won and how far along the route it got (`src/sim/routePlay.ts`).
 *   npx tsx scripts/routes.ts [--seeds 4] [-j 4] [--minutes 40] [--start 2] [--detail] [route …]
 * `--start 2` starts both seats in the Middle Ages (tier 2) to test the late route ages directly; `--detail` prints each match's
 * climb (age and minute) and the route ages it gave up.
 */
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROUTES, type RouteId } from '../src/sim/data';
import { playRoute, routeAges, routeIds, routeMaps, type RouteMatch } from '../src/sim/routePlay';

const args = process.argv.slice(2);
function option(name: string): string | undefined {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const [, v] = args.splice(i, 2);
  return v;
}
const one = option('--one');
const n = Number(option('--seeds') ?? 4);
const jobs = Number(option('-j') ?? 4);
const minutes = Number(option('--minutes') ?? 40);
const start = Number(option('--start') ?? 0);
const detail = (() => { const i = args.indexOf('--detail'); if (i < 0) return false; args.splice(i, 1); return true; })();
const seedOf = (k: number) => 1 + 101 * k;

if (one) {
  const [route, seed, map] = one.split(',');
  console.log(JSON.stringify(playRoute(route as RouteId, Number(seed), map as never, minutes, 'small', 'hard', start)));
} else {
  const routes = (args.length ? args : routeIds()) as RouteId[];
  const todo = routes.flatMap((route) => routeMaps(route).flatMap((map) => Array.from({ length: n }, (_, k) => ({ route, map, seed: seedOf(k) }))));
  const done: RouteMatch[] = [];
  const self = fileURLToPath(import.meta.url);
  const worker = async (): Promise<void> => {
    for (let job = todo.shift(); job; job = todo.shift()) {
      const out = await new Promise<string>((resolve, reject) => {
        let text = '';
        const child = fork(self, ['--one', `${job.route},${job.seed},${job.map}`, '--minutes', String(minutes), '--start', String(start)], { stdio: ['ignore', 'pipe', 'inherit', 'ipc'] });
        child.stdout!.on('data', (d) => (text += d));
        child.on('exit', (code) => (code === 0 ? resolve(text) : reject(new Error(`${job.route} ${job.seed} exited ${code}`))));
      });
      done.push(JSON.parse(out.trim().split('\n').pop()!));
      process.stderr.write(`\r${done.length} matches played`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, worker));
  process.stderr.write('\n');
  console.log(`Route sweeps: Hard bound to a route vs Normal free, ${n} seeds, ${minutes} min cap${start ? `, from tier ${start}` : ''} (W won, l lost, - unfinished):`);
  for (const route of routes) for (const map of routeMaps(route)) {
    const rows = done.filter((m) => m.route === route && m.map === map).sort((a, b) => a.seed - b.seed);
    const wins = rows.filter((m) => m.result === 'win').length;
    const marks = rows.map((m) => (m.result === 'win' ? 'W' : m.result === 'lose' ? 'l' : '-')).join('');
    const ages = routeAges(route);
    const depth = ages.length ? `${rows.map((m) => m.walked.length).join('/')} of ${ages.length} route ages walked` : 'trunk only';
    console.log(`${ROUTES[route].name.padEnd(14)} ${map.padEnd(11)} ${marks} ${wins}/${rows.length}; ${depth}; ended ${rows.map((m) => m.ended).join(',')}`);
    if (detail) for (const m of rows) console.log(`    seed ${m.seed} ${m.result} ${m.minutes.toFixed(0)}m: ${m.reached.map((r) => `${r.age}@${r.minute.toFixed(0)}`).join(' > ')}${m.gaveUp.length ? `; gave up ${m.gaveUp.map((g) => `${g.age} in ${g.in}@${g.minute.toFixed(0)}`).join(', ')}` : ''}`);
  }
}
