import { describe, expect, it } from 'vitest';
import { AGES, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { spawnUnit } from '../src/sim/world';
import type { Building, GameState } from '../src/sim/types';

/** The computer in the Iron Age raises a Bloom Hearth beside the bog (#727). */

const bogWorld = (): GameState => {
  for (let seed = 1; seed < 60; seed++) {
    const s = createGame({ seed, size: 'small', mapType: 'plains', players: [{ name: 'A', ai: 'hard', civ: 'britons' }, { name: 'B', ai: null, civ: 'britons' }] });
    if (!s.bogIron) continue;
    s.peaceUntil = 1e9;
    const p = s.players[0];
    p.epoch = AGES.iron.tier;
    p.age = 'iron';
    p.res = { food: 3000, wood: 3000, stone: 600, gold: 800 };
    for (let i = 0; i < 20; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
    s.tick = secs(300);
    s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: {} };
    return s;
  }
  throw new Error('no bog-iron world');
};

describe('the computer and the Bloom Hearth (#727)', () => {
  it('raises one in the Iron Age, and only one at a time', () => {
    const s = bogWorld();
    const mine = () => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'bloomery');
    for (let i = 0; i < secs(180) && !mine().some((b) => b.built); i++) step(s);
    expect(mine().length).toBe(1);
  });
});
