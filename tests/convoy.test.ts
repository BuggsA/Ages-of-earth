import { describe, expect, it } from 'vitest';
import { CONVOY } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { convoyShare } from '../src/sim/convoy';
import { spawnUnit } from '../src/sim/world';

/** Convoys (#356 audit, the Age of Sail): a merchant ship loads richer with a warship beside it. */
function setup(age: 'sail' | 'middle') {
  const s = createGame({ seed: 5, size: 'medium', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  const p = s.players[0];
  p.epoch = 2;
  p.age = age;
  const cog = spawnUnit(s, 0, 'cog', 10, 10);
  return { s, cog };
}

describe('Convoys', () => {
  it('pay more with an own warship near, and not otherwise', () => {
    const { s, cog } = setup('sail');
    expect(convoyShare(s, cog)).toBe(1);
    const far = spawnUnit(s, 0, 'warship', 10 + CONVOY.reach + 3, 10);
    expect(convoyShare(s, cog)).toBe(1);
    far.x = 10 + CONVOY.reach - 1;
    expect(convoyShare(s, cog)).toBe(CONVOY.pay);
  });
  it('ignore a rival\'s warship and other ages', () => {
    const { s, cog } = setup('sail');
    spawnUnit(s, 1, 'warship', 11, 10);
    expect(convoyShare(s, cog)).toBe(1);
    const m = setup('middle');
    spawnUnit(m.s, 0, 'warship', 11, 10);
    expect(convoyShare(m.s, m.cog)).toBe(1);
  });
});
