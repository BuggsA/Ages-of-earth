// Headless probe for #755: sweeps and tide waits in matches of Tide computers on lakes.
// npx tsx scripts/tide-probe.ts [seeds=4] [minutes=12]
import { AGES, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { AgeId, GameState } from '../src/sim/types';
import { restat } from '../src/sim/world';

const seeds = Number(process.argv[2] ?? 4);
const minutes = Number(process.argv[3] ?? 12);
const enter = (s: GameState, o: number, age: AgeId) => {
  const p = s.players[o];
  restat(s, p, () => {
    p.epoch = AGES[age].tier;
    p.age = age;
  });
};
for (let seed = 1; seed <= seeds; seed++) {
  const s = createGame({ seed, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }, { name: 'C', ai: 'hard' }] });
  for (let o = 0; o < 3; o++) {
    enter(s, o, 'tides');
    s.players[o].res = { food: 3000, wood: 3000, stone: 3000, gold: 3000 };
  }
  let swept = 0, drowned = 0, held = 0;
  const by: Record<string, number> = {};
  const t0 = Date.now();
  for (let i = 0; i < secs(minutes * 60) && !s.over; i++) {
    step(s);
    for (const e of s.events) {
      if (e.k === 'tideSwept') {
        swept++;
        if (e.drowned) drowned++;
        const u = s.byId.get(e.id);
        const k = u && u.kind === 'unit' ? u.order.k : 'gone';
        by[k] = (by[k] ?? 0) + 1;
      } else if ((e as { k: string }).k === 'tideHold') held++;
    }
  }
  console.log(`seed ${seed}: swept ${swept} (drowned ${drowned}) held ${held} by ${JSON.stringify(by)} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
