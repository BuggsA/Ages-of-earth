import { describe, expect, it } from 'vitest';
import { AGES, ROADS, TIDE, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { TIDE_TOP, bared, tidalLevel, tideLevel } from '../src/sim/tides';
import type { AgeId, GameState } from '../src/sim/types';
import { restat, spawnUnit } from '../src/sim/world';

/** The computer and the tide (#739): it raises Tide Mills in the age, and steps off the flats before the flood. */

const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec) && !s.over; i++) step(s);
};
const enter = (s: GameState, o: number, age: AgeId) => {
  const p = s.players[o];
  restat(s, p, () => {
    p.epoch = AGES[age].tier;
    p.age = age;
  });
};

function game(): GameState {
  const s = createGame({ seed: 1, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: null }] });
  s.peaceUntil = 1e9;
  s.animals = [];
  enter(s, 0, 'tides');
  s.players[0].res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
  return s;
}

describe('the computer in the Age of Tides', () => {
  it('raises Tide Mills by the tidal ground near home', () => {
    const s = game();
    run(s, 60);
    const mills = s.ents.filter((e) => e.kind === 'building' && e.type === 'tidemill' && e.owner === 0);
    expect(mills.length).toBeGreaterThan(0);
  });

  it('steps its people off the flats before the water comes back', () => {
    const s = game();
    s.players[0].res = { food: 0, wood: 0, stone: 0, gold: 0 };
    for (let i = 0; i < secs(TIDE.period) && tideLevel(s) !== 0; i++) step(s);
    step(s);
    // A soldier of its own on the deepest flats, bared now and covered first.
    const t = [...s.tidal!.keys()].find((i) => tidalLevel(s, i) === 1 && bared(s, i) && i % s.w > 8 && i % s.w < s.w - 8)!;
    const u = spawnUnit(s, 0, 'infantry', (t % s.w) + 0.5, Math.floor(t / s.w) + 0.5);
    const hp = u.hp;
    for (let i = 0; i < secs(TIDE.period) && tideLevel(s) === 0; i++) step(s);
    run(s, 1);
    expect(u.hp).toBe(hp);
    expect(Math.floor(u.y) * s.w + Math.floor(u.x)).not.toBe(t);
  });

  it('the road is open to the computer from the Atomic Age', () => {
    expect(ROADS.some((r) => r.from === 'atomic' && r.to === 'tides')).toBe(true);
    expect(TIDE_TOP).toBe(TIDE.flats.length);
  });
});
