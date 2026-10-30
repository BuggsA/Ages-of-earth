import { afterEach, describe, expect, it } from 'vitest';
import { AI_WINTER, SEASON, TICK_HZ } from '../../src/sim/data';
import { createGame, step } from '../../src/sim/game';
import type { GameState, Unit } from '../../src/sim/types';

/** The clever computer plans for winter: more of its people turn to food in autumn, before the berries fail. */

const saved = { ...AI_WINTER };
afterEach(() => Object.assign(AI_WINTER, saved));

const onFood = (s: GameState) =>
  s.ents.filter((e): e is Unit => e.kind === 'unit' && e.type === 'citizen' && e.hp > 0 && (e.order.k === 'farm' || e.order.k === 'hunt' || (e.order.k === 'gather' && e.order.res === 'food'))).length;
const play = (seed: number, secs: number): GameState => {
  const s = createGame({ seed, size: 'small', players: [{ name: 'A', ai: 'normal', civ: 'romans' }, { name: 'B', ai: 'normal', civ: 'greeks' }] });
  for (let i = 0; i < secs * TICK_HZ; i++) step(s);
  return s;
};

describe('the computer plans for winter', () => {
  // Judged across a dozen maps (#940): on any one the count swings by several either way with what the map holds, so three
  // seeds summed could fall either side of zero. Planning should lift the count on most maps and in sum.
  it('puts more people on food in autumn than one that does not plan on most maps, and is the same before', () => {
    let more = 0;
    let up = 0;
    let down = 0;
    for (let seed = 1; seed <= 12; seed++) {
      Object.assign(AI_WINTER, { food: 0, fields: 0, hunters: 0, pack: 0 });
      const spring = seed <= 3 ? onFood(play(seed, SEASON.len - 5)) : 0;
      const a = onFood(play(seed, SEASON.len * 2 + 90));
      Object.assign(AI_WINTER, saved);
      if (seed <= 3) expect(onFood(play(seed, SEASON.len - 5))).toBe(spring);
      const d = onFood(play(seed, SEASON.len * 2 + 90)) - a;
      more += d;
      if (d > 0) up++;
      if (d < 0) down++;
    }
    expect(more).toBeGreaterThan(0);
    expect(up).toBeGreaterThan(down);
  }, 600000);
});
