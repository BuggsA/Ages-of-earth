import { describe, expect, it } from 'vitest';
import { VETERANCY } from '../src/sim/data';
import { damageOf, hurt, rankOf } from '../src/sim/combat';
import { createGame } from '../src/sim/game';
import { spawnUnit, statsOf } from '../src/sim/world';
import type { Unit } from '../src/sim/types';

describe('veterancy', () => {
  const s = createGame({ seed: 5, size: 'small', startEpoch: 1, players: [{ name: 'A', ai: null, civ: 'greeks' }, { name: 'B', ai: null, civ: 'romans' }] });
  const units = s.ents.filter((e): e is Unit => e.kind === 'unit');
  const mine = units.find((u) => u.owner === 0)!;
  const foe = units.find((u) => u.owner === 1)!;

  it('ranks come at the listed kill counts and strengthen blows', () => {
    const st = statsOf(s, mine);
    const base = damageOf(s, mine, st, foe, false);
    mine.vet = VETERANCY.kills[0];
    expect(rankOf(mine)).toBe(1);
    expect(damageOf(s, mine, st, foe, false)).toBeGreaterThan(base);
    mine.vet = VETERANCY.kills[2];
    expect(rankOf(mine)).toBe(3);
  });

  it('a kill of a soldier is credited and a rank-up raises an event; citizens do not count', () => {
    mine.vet = VETERANCY.kills[0] - 1;
    s.events = [];
    hurt(s, foe, 9999, 0, mine);
    expect(foe.type === 'citizen' ? mine.vet : -1).toBe(foe.type === 'citizen' ? VETERANCY.kills[0] - 1 : -1);
    const soldier = spawnUnit(s, 1, 'infantry', foe.x, foe.y);
    hurt(s, soldier, 9999, 0, mine);
    expect(mine.vet).toBe(VETERANCY.kills[0]);
    expect(s.events.some((e) => e.k === 'rank' && e.id === mine.id && e.rank === 1)).toBe(true);
  });
});
