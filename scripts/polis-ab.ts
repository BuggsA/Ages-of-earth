/**
 * Judge the Greek computer's levy (#523): Greek Hard vs Roman Hard, small map, seeds first..first+n-1, summed for the Greeks.
 *   polis-ab <first seed> <seeds> <minutes> [POLIS key=value ...]     (key=value overrides a number in POLIS)
 */
import { POLIS } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';

const first = Number(process.argv[2] ?? 1);
const seeds = Number(process.argv[3] ?? 8);
const minutes = Number(process.argv[4] ?? 20);
for (const kv of process.argv.slice(5)) {
  const [k, v] = kv.split('=');
  (POLIS as Record<string, unknown>)[k] = Number(v);
}
const sum = { gathered: 0, citizens: 0, epochs: 0, armed: 0, kills: 0, losses: 0 };
for (let seed = first; seed < first + seeds; seed++) {
  const s = createGame({ seed, size: 'small', players: [{ name: 'G', ai: 'hard', civ: 'greeks' }, { name: 'R', ai: 'hard', civ: 'romans' }] });
  for (let i = 0; i < minutes * 1200 && !s.over; i++) step(s);
  const g = s.players[0];
  const st = g.stats as unknown as Record<string, number>;
  sum.gathered += Object.values((st.gathered as unknown as Record<string, number>) ?? {}).reduce((a, b) => a + b, 0) || (st.gathered as number) || 0;
  sum.citizens += s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.hp > 0 && e.type === 'citizen').length;
  sum.epochs += g.epoch;
  sum.armed += g.stats.armed ?? 0;
  sum.kills += g.stats.kills;
  sum.losses += g.stats.losses;
}
console.log(process.argv.slice(5).join(' ') || 'base', JSON.stringify(sum));
