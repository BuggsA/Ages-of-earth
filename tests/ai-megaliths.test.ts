import { describe, expect, it } from 'vitest';
import { AGES, BUILDINGS, MEGALITH, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { Building } from '../src/sim/types';
import { restat } from '../src/sim/world';

/** The computer on the Deep Road (#877): in the Age of Megaliths it raises a Henge near home, and keeps the age while it does. */
describe('the computer in the Age of Megaliths (#877)', () => {
  it('raises a Henge within reach of home, paid in stone', () => {
    const s = createGame({ seed: 4, size: 'small', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: null }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    restat(s, p, () => {
      p.epoch = AGES.megaliths.tier;
      p.age = 'megaliths';
    });
    p.res = { food: 1500, wood: 600, stone: 600, gold: 300 };
    const henge = () => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'henge');
    for (let i = 0; i < secs(120) && !henge(); i++) step(s);
    const h = henge()!;
    expect(h).toBeTruthy();
    expect(Math.abs(h.tx - p.startX)).toBeLessThanOrEqual(MEGALITH.from + BUILDINGS.henge.size);
    expect(p.age).toBe('megaliths');
  });
});
