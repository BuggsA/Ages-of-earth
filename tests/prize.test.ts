import { describe, expect, it } from 'vitest';
import { PRIZE } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { hurt } from '../src/sim/combat';
import { spawnUnit } from '../src/sim/world';

/** Prize money (#356 audit, the Age of Sail): sinking a laden rival merchant ship pays the sinker. */
function setup(age: 'sail' | 'middle') {
  const s = createGame({ seed: 5, size: 'medium', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  s.players[0].epoch = 2;
  s.players[0].age = age;
  const cog = spawnUnit(s, 1, 'cog', 10, 10);
  cog.carry = 100;
  cog.carryRes = 'gold';
  const ship = spawnUnit(s, 0, 'warship', 11, 10);
  return { s, cog, ship };
}

describe('Prize money', () => {
  it('pays the sinker a share of a laden cog\'s gold in the Age of Sail', () => {
    const { s, cog, ship } = setup('sail');
    const before = s.players[0].res.gold;
    hurt(s, cog, 9999, 0, ship);
    expect(s.players[0].res.gold - before).toBe(Math.floor(100 * PRIZE.share));
    expect(s.players[0].stats.plunder).toBe(50);
  });
  it('pays nothing in other ages, for an empty cog, or for an own ship', () => {
    const m = setup('middle');
    const g = m.s.players[0].res.gold;
    hurt(m.s, m.cog, 9999, 0, m.ship);
    expect(m.s.players[0].res.gold).toBe(g);
    const e = setup('sail');
    e.cog.carry = 0;
    const g2 = e.s.players[0].res.gold;
    hurt(e.s, e.cog, 9999, 0, e.ship);
    expect(e.s.players[0].res.gold).toBe(g2);
  });
});
