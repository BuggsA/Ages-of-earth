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
  it('puts more people on food in autumn than one that does not plan, and is the same before', () => {
    let more = 0;
    for (const seed of [3, 7, 11]) {
      Object.assign(AI_WINTER, { food: 0, fields: 0, hunters: 0, pack: 0 });
      const spring = onFood(play(seed, SEASON.len - 5));
      const a = onFood(play(seed, SEASON.len * 2 + 90));
      Object.assign(AI_WINTER, saved);
      expect(onFood(play(seed, SEASON.len - 5))).toBe(spring);
      more += onFood(play(seed, SEASON.len * 2 + 90)) - a;
    }
    expect(more).toBeGreaterThan(0);
  }, 90000);
});
