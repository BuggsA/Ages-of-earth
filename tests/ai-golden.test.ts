import { describe, expect, it } from 'vitest';
import { ageOf } from '../src/sim/ages';
import { secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { AgeId, GameState } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** The computer and the Golden Age (#703): it takes the road the moment it opens, and rides the span out rather than climb. */

const game = (walked: AgeId[]): GameState => {
  const s = createGame({ seed: 2, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: 'hard', civ: 'egyptians' }, { name: 'B', ai: null, civ: 'britons' }] });
  s.peaceUntil = 1e9;
  const p = s.players[0];
  p.age = 'gunpowder';
  p.epoch = 3;
  p.walked = walked;
  p.res = { food: 9000, wood: 9000, stone: 3000, gold: 9000 };
  for (let i = 0; i < 20; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
  s.tick = secs(900);
  return s;
};
const run = (s: GameState, seconds: number, until: () => boolean) => {
  for (let i = 0; i < secs(seconds) && !s.over && !until(); i++) step(s);
};

describe('the computer and the Golden Age (#703)', () => {
  it('turns golden with three lives walked, and stays golden though it could climb', () => {
    const s = game(['steppe', 'merchant', 'pilgrim']);
    run(s, 400, () => ageOf(s.players[0]) === 'golden');
    expect(ageOf(s.players[0])).toBe('golden');
    run(s, 150, () => ageOf(s.players[0]) !== 'golden');
    expect(ageOf(s.players[0])).toBe('golden');
  }, 60000);

  it('never turns golden with two', () => {
    const s = game(['steppe', 'merchant']);
    run(s, 90, () => ageOf(s.players[0]) === 'golden');
    expect(ageOf(s.players[0])).not.toBe('golden');
  }, 60000);
});
