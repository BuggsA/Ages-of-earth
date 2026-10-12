import { createGame, step, checksum } from '../src/sim/game';
import { EPOCHS } from '../src/sim/data';
const seed = Number(process.argv[2] ?? 1);
const size = (process.argv[3] ?? 'small') as 'small';
const minutes = Number(process.argv[4] ?? 25);
const s = createGame({ seed, size, players: [{ name: 'A', ai: 'normal' }, { name: 'B', ai: 'hard' }] });
const t0 = performance.now();
let worst = 0;
for (let i = 0; i < minutes * 60 * 20 && !s.over; i++) {
  const a = performance.now();
  step(s);
  worst = Math.max(worst, performance.now() - a);
  if (i % (20 * 60) === 0) {
    const line = s.players.map((p) => {
      const units = s.ents.filter((e) => e.owner === p.id && e.kind === 'unit');
      const cit = units.filter((u) => u.type === 'citizen').length;
      const idle = units.filter((u) => u.type === 'citizen' && (u as any).order.k === 'idle').length;
      const bld = s.ents.filter((e) => e.owner === p.id && e.kind === 'building');
      return `${p.name}: ${EPOCHS[p.epoch].short} cit ${cit} (idle ${idle}) army ${units.length - cit} bld ${bld.length} [${bld.map((b: any) => b.type[0] + (b.built ? '' : '*')).join('')}] res ${Object.values(p.res).map(Math.floor).join('/')} pop ${p.pop}/${p.cap} kills ${p.stats.kills}`;
    });
    console.log(`min ${i / 1200}`, line.join(' | '));
  }
}
console.log('over', s.over, 'winner', s.winner, 'tick', s.tick, 'min', (s.tick / 1200).toFixed(1), 'ms', (performance.now() - t0).toFixed(0), 'worst tick ms', worst.toFixed(1), 'sum', checksum(s));
