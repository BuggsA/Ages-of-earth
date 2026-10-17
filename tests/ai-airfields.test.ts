import { describe, expect, it } from 'vitest';
import { AI_AIRFIELD, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { AgeId, Difficulty, GameState } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** The computer's Airfield goes forward (#379 s4): in the Age of Aeronauts it rises toward the enemy it knows of. */
function setup(level: Difficulty, age: AgeId) {
  const s: GameState = createGame({ seed: 2, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: level, civ: 'britons' }, { name: 'B', ai: null, civ: 'britons' }] });
  s.peaceUntil = 1e9;
  const p = s.players[0];
  p.epoch = 4;
  p.age = age;
  p.res = { food: 5000, wood: 5000, gold: 5000, stone: 5000 } as typeof p.res;
  for (let i = 0; i < 26; i++) spawnUnit(s, 0, 'citizen', p.startX + (i % 6), p.startY + 3 + Math.floor(i / 6));
  for (let i = 0; i < 4; i++) spawnUnit(s, 0, 'infantry', p.startX + 4 + i * 0.5, p.startY - 4);
  const q = s.players[1];
  p.seen.fill(1);
  void q;
  return s;
}

const fieldOf = (s: GameState) => s.ents.find((e) => e.kind === 'building' && e.type === 'airfield' && e.owner === 0);

describe('the computer raises its Airfield toward the enemy', () => {
  it('in the Age of Aeronauts, at least a few tiles nearer the enemy than home', () => {
    const s = setup('normal', 'aeronaut');
    for (let i = 0; i < secs(120); i++) step(s);
    const f = fieldOf(s);
    expect(f).toBeTruthy();
    const e = s.players[1];
    const p = s.players[0];
    const from = (x: number, y: number) => Math.hypot(x - e.startX, y - e.startY);
    expect(from(f!.x, f!.y)).toBeLessThan(from(p.startX, p.startY) - 2);
    expect(Math.hypot(f!.x - p.startX, f!.y - p.startY)).toBeLessThanOrEqual(AI_AIRFIELD.most + AI_AIRFIELD.slack + 3);
  });
});
