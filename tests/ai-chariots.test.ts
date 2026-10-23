import { describe, expect, it } from 'vitest';
import { ageOf } from '../src/sim/ages';
import { secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { AgeId, GameState } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer and the third crossing (#555 s12): a step back off the Stone Age's sibling, then the turn into the Age of Chariots. */

const game = (age: AgeId, walked: AgeId[]): GameState => {
  const s = createGame({ seed: 2, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: 'hard', civ: 'britons' }, { name: 'B', ai: null, civ: 'britons' }] });
  s.peaceUntil = 1e9;
  const p = s.players[0];
  p.age = age;
  p.epoch = age === 'stone' ? 0 : 1;
  p.walked = walked;
  p.res = { food: 3000, wood: 3000, stone: 400, gold: 1500 };
  for (let i = 0; i < 30; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
  placeBuilding(s, 0, 'forge', p.startX + 6, p.startY + 6, true);
  s.tick = secs(600);
  s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: { chariots: true, iron: true, steppe: true } };
  return s;
};
const run = (s: GameState, seconds: number, until: () => boolean) => {
  for (let i = 0; i < secs(seconds) && !s.over && !until(); i++) step(s);
};

describe('the computer crosses to the Chariots (#555 s12)', () => {
  it('steps back to the Stone Age from a sibling, after its stay', () => {
    const s = game('steppe', ['stone', 'iron']);
    run(s, 60, () => false);
    expect(ageOf(s.players[0])).toBe('steppe');
    run(s, 400, () => ageOf(s.players[0]) === 'stone');
    expect(ageOf(s.players[0])).toBe('stone');
  });

  it('turns into the Chariots from the Stone Age with both siblings walked', () => {
    const s = game('stone', ['stone', 'iron', 'steppe']);
    run(s, 300, () => ageOf(s.players[0]) === 'chariots');
    expect(ageOf(s.players[0])).toBe('chariots');
  });
});
