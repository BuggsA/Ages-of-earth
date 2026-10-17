import { describe, expect, it } from 'vitest';
import { TICK_HZ, VIGIL } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { findSpot } from '../src/sim/ai';
import { vigilGold } from '../src/sim/vigil';
import type { AgeId, Difficulty } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer keeps vigil (#379 s2): in the Age of Pilgrims its priests stand at the relic Temple. */
function setup(level: Difficulty, age: AgeId) {
  const s = createGame({ seed: 7, size: 'medium', peaceMinutes: 30, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: level, civ: 'greeks' }] });
  const p = s.players[1];
  p.epoch = 2;
  p.age = age;
  const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter')!;
  const ts = findSpot(s, 'temple', tc.x, tc.y, 7, 12)!;
  const temple = placeBuilding(s, 1, 'temple', ts.tx, ts.ty, true);
  // No loose relics: fetching one comes before the vigil.
  s.relics = [{ id: s.nextId++, x: temple.x, y: temple.y, carrier: 0, temple: temple.id }];
  // Four priests standing about the town, away from the Temple.
  for (let i = 0; i < 4; i++) spawnUnit(s, 1, 'priest', 2 * tc.x - temple.x + i, 2 * tc.y - temple.y);
  return { s, temple };
}

describe('the computer keeps vigil', () => {
  it('in the Age of Pilgrims, posts priests at its shrine so the relic pays more', () => {
    const { s, temple } = setup('normal', 'pilgrim');
    expect(vigilGold(s, temple)).toBe(0);
    for (let i = 0; i < 40 * TICK_HZ; i++) step(s);
    expect(vigilGold(s, temple)).toBe(VIGIL.most * VIGIL.each);
  });

  it('leaves other ages and Normal as they were', () => {
    for (const [level, age] of [['normal', 'middle'], ['easy', 'pilgrim']] as const) {
      const { s, temple } = setup(level, age);
      for (let i = 0; i < 40 * TICK_HZ; i++) step(s);
      const near = s.ents.filter((e) => e.kind === 'unit' && e.owner === 1 && e.type === 'priest' && Math.hypot(e.x - temple.x, e.y - temple.y) <= VIGIL.reach).length;
      expect(near).toBeLessThan(VIGIL.most);
    }
  });
});
