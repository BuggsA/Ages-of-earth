// Headless probe for #767: cockle beds laid, food picked from them, and sweeps, in matches of Tide computers on lakes.
// npx tsx scripts/cockle-probe.ts [seeds=3] [minutes=10]
import { AGES, COCKLE, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { GameState } from '../src/sim/types';
import { R_COCKLE } from '../src/sim/types';
import { restat } from '../src/sim/world';

const seeds = Number(process.argv[2] ?? 3);
const minutes = Number(process.argv[3] ?? 10);
for (let seed = 1; seed <= seeds; seed++) {
  const s: GameState = createGame({ seed, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }, { name: 'C', ai: 'hard' }] });
  for (let o = 0; o < 3; o++) {
    const p = s.players[o];
    restat(s, p, () => {
      p.epoch = AGES.tides.tier;
      p.age = 'tides';
    });
    p.res = { food: 3000, wood: 3000, stone: 3000, gold: 3000 };
  }
  let swept = 0;
  let ashore = 0;
  let regrown = 0;
  const by: Record<string, number> = {};
  let beds = -1;
  let tidal = 0;
  for (let i = 0; i < secs(minutes * 60) && !s.over; i++) {
    step(s);
    if (beds < 0 && s.tidal) {
      beds = 0;
      for (let t = 0; t < s.w * s.h; t++) {
        if (s.res[t] === R_COCKLE) beds++;
        if (s.tidal[t]) tidal++;
      }
    }
    for (const e of s.events) {
      if (e.k === 'tideSwept') {
        swept++;
        const u = s.byId.get(e.id);
        const k = u && u.kind === 'unit' ? u.order.k : 'gone';
        by[k] = (by[k] ?? 0) + 1;
      } else if (e.k === 'tideAshore') ashore++;
      else if (e.k === 'cockles') regrown += e.food;
    }
  }
  let left = 0;
  for (let t = 0; t < s.w * s.h; t++) if (s.res[t] === R_COCKLE) left += s.amount[t];
  const pickers = s.ents.filter((e) => e.kind === 'unit' && e.order.k === 'gather' && e.order.cockle).length;
  console.log(`seed ${seed}: tidal ${tidal} beds ${beds} picked ${beds * COCKLE.amount + regrown - left} (regrown ${regrown}) pickers now ${pickers} | swept ${swept} by ${JSON.stringify(by)} ashore ${ashore}`);
}
