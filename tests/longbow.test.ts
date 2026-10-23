import { describe, expect, it } from 'vitest';
import { LONGBOW, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { isSet } from '../src/sim/longbow';
import { statsOf, spawnUnit } from '../src/sim/world';
import type { GameState, Unit } from '../src/sim/types';

// The set line (#501, the Britons): a bowman who stands still draws the longbow to the full; a step breaks it.
const game = () => createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'britons' }, { name: 'B', ai: null, civ: 'greeks' }] });
const archer = (s: GameState, owner: number): Unit => {
  const tc = s.ents.find((e) => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
  return spawnUnit(s, owner, 'ranged', tc.x + 4, tc.y + 4);
};

describe('the set line', () => {
  it('sets a Briton bowman after he stands still, with farther reach and a harder blow', () => {
    const s = game();
    const a = archer(s, 0);
    step(s);
    expect(isSet(s, a)).toBe(false);
    const plain = statsOf(s, a);
    for (let i = 0; i < secs(LONGBOW.after) + 2; i++) step(s);
    expect(isSet(s, a)).toBe(true);
    const set = statsOf(s, a);
    expect(set.range).toBeCloseTo(plain.range + LONGBOW.range);
    expect(set.attack).toBe(plain.attack + LONGBOW.attack);
  });

  it('breaks the line at a step', () => {
    const s = game();
    const a = archer(s, 0);
    for (let i = 0; i < secs(LONGBOW.after) + 2; i++) step(s);
    expect(isSet(s, a)).toBe(true);
    a.x += 0.5;
    step(s);
    expect(isSet(s, a)).toBe(false);
    expect(statsOf(s, a).range).toBeLessThan(6 + LONGBOW.range);
  });

  it('sets nobody else: not a Greek bowman, not a Briton citizen', () => {
    const s = game();
    const g = archer(s, 1);
    for (let i = 0; i < secs(LONGBOW.after) + 2; i++) step(s);
    expect(isSet(s, g)).toBe(false);
    const cit = s.ents.find((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen')!;
    expect(isSet(s, cit)).toBe(false);
  });
});
