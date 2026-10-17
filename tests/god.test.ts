import { describe, expect, it } from 'vitest';
import { GOD_STOCK, jumpAge, rush, topUp } from '../src/sim/god';
import { AGES } from '../src/sim/data';
import { RES } from '../src/sim/types';
import { createGame, step } from '../src/sim/game';

describe('god mode (#399, #495)', () => {
  const make = () => createGame({ seed: 1, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'easy', civ: 'romans' }] });
  it('tops the treasury back up and leaves the age alone', () => {
    const s = make();
    const before = s.players[0].epoch;
    s.players[0].res.gold = 5;
    topUp(s, 0);
    for (const r of RES) expect(s.players[0].res[r]).toBe(GOD_STOCK);
    expect(s.players[0].epoch).toBe(before);
  });
  it('jumps to any age, forward and back', () => {
    const s = make();
    jumpAge(s, 0, 'industrial');
    expect(s.players[0].epoch).toBe(AGES.industrial.tier);
    expect(s.players[0].age).toBe('industrial');
    jumpAge(s, 0, 'bronze');
    expect(s.players[0].epoch).toBe(AGES.bronze.tier);
    expect(s.players[1].epoch).toBe(0);
  });
  it('finishes foundations, research and the road at once', () => {
    const s = make();
    jumpAge(s, 0, 'bronze');
    topUp(s, 0);
    const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter');
    if (!tc || tc.kind !== 'building') throw new Error('no town center');
    tc.advance = 0;
    rush(s, 0);
    step(s, []);
    expect(tc.advance).toBe(-1);
    expect(s.players[0].epoch).toBe(AGES.bronze.tier + 1);
  });
});
