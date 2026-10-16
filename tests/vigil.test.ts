import { describe, expect, it } from 'vitest';
import { VIGIL } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { vigilGold } from '../src/sim/vigil';
import { spawnUnit } from '../src/sim/world';
import type { Building } from '../src/sim/types';

/** Vigils (#356 audit, the Age of Pilgrims): priests beside a relic Temple add to its gold. */
function setup(age: 'pilgrim' | 'middle') {
  const s = createGame({ seed: 5, size: 'medium', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  s.players[0].epoch = 2;
  s.players[0].age = age;
  const t = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0)!;
  t.built = true;
  return { s, t };
}

describe('Vigils', () => {
  it('pay a gold per priest near the shrine, up to the most', () => {
    const { s, t } = setup('pilgrim');
    expect(vigilGold(s, t)).toBe(0);
    for (let i = 0; i < VIGIL.most + 2; i++) {
      spawnUnit(s, 0, 'priest', t.x + 1, t.y + 1);
      expect(vigilGold(s, t)).toBe(Math.min(i + 1, VIGIL.most) * VIGIL.each);
    }
  });
  it('ignore far priests, a rival\'s priests and other ages', () => {
    const { s, t } = setup('pilgrim');
    spawnUnit(s, 0, 'priest', t.x + VIGIL.reach + 3, t.y);
    spawnUnit(s, 1, 'priest', t.x + 1, t.y);
    expect(vigilGold(s, t)).toBe(0);
    const m = setup('middle');
    spawnUnit(m.s, 0, 'priest', m.t.x + 1, m.t.y);
    expect(vigilGold(m.s, m.t)).toBe(0);
  });
});
