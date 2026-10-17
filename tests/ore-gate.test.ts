import { describe, expect, it } from 'vitest';
import { ROADS } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { deedsDone, oreOnly, roadProblem } from '../src/sim/ages';
import type { RareId } from '../src/sim/types';

/** Ore gates (#356): where the seed holds the ore it is the only door; where it does not, the deeds are the road. */
const world = (seed: number) => createGame({ seed, size: 'medium', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const road = (to: string) => ROADS.find((r) => r.to === to && r.ore)!;

describe('ore gates', () => {
  it('deeds alone open the road only where the world holds no such ore', () => {
    const r = road('merchant');
    let gated = 0, open = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = world(seed);
      const p = s.players[0];
      p.epoch = 1;
      p.stats[r.deed!.stat] = r.deed!.n;
      const has = !!s.rares?.includes('salt');
      expect(oreOnly(s, r)).toBe(has);
      expect(deedsDone(p, r, s)).toBe(!has);
      expect(deedsDone(p, r)).toBe(true); // a caller without the world keeps the old reading
      expect(roadProblem(s, p, { ...r, clue: undefined }) === null).toBe(!has);
      if (has) gated++; else open++;
    }
    expect(gated).toBeGreaterThan(0);
    expect(open).toBeGreaterThan(0);
  });

  it('mining the ore opens a gated road, and the hint names the ore only after digging', () => {
    const r = { ...road('ironblood'), clue: undefined, walked: undefined };
    for (let seed = 1; seed <= 20; seed++) {
      const s = world(seed);
      if (!s.rares?.includes('bloodiron')) continue;
      const p = s.players[0];
      p.stats.mined = {} as Partial<Record<RareId, number>>;
      expect(roadProblem(s, p, r)).not.toMatch(/blood-iron/);
      p.stats.mined = { bloodiron: 5 };
      expect(roadProblem(s, p, r)).toMatch(/5\/50/);
      p.stats.mined = { bloodiron: 50 };
      expect(roadProblem(s, p, r)).toBeNull();
      return;
    }
    throw new Error('no seed held blood-iron');
  });
});
