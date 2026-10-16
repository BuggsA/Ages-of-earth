import { describe, expect, it } from 'vitest';
import { ROADS } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { deedsDone, oreClue, oreDone } from '../src/sim/ages';
import type { RareId } from '../src/sim/types';

/** Ore doors (#356 s3): mining a rare ore opens a road in place of its deeds, where the world holds the ore. */
const world = (seed: number) => createGame({ seed, size: 'medium', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const road = (to: string) => ROADS.find((r) => r.to === to && r.ore)!;

describe('ore doors', () => {
  it('two roads carry one', () => {
    expect(ROADS.filter((r) => r.ore).map((r) => r.to).sort()).toEqual(['ironblood', 'merchant']);
  });

  it('mining enough opens the road without its deeds, and the clue shows only after digging', () => {
    const r = road('merchant');
    let hit = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = world(seed);
      const p = s.players[0];
      p.epoch = 1;
      expect(deedsDone(p, r)).toBe(false);
      expect(oreClue(s, p, r)).toBeNull();
      p.stats.mined = { salt: 5 };
      const has = !!s.rares?.includes('salt');
      expect(oreClue(s, p, r) !== null).toBe(has);
      if (has) hit++;
      p.stats.mined = { salt: r.ore!.n };
      expect(oreDone(p, r)).toBe(true);
      expect(deedsDone(p, r)).toBe(true);
    }
    expect(hit).toBeGreaterThan(0);
  });

  it('without the ore the deeds are the only road', () => {
    const r = road('ironblood');
    const s = world(1);
    const p = s.players[0];
    p.stats.mined = {} as Partial<Record<RareId, number>>;
    expect(deedsDone(p, r)).toBe(false);
    p.stats.plunder = r.deed!.n;
    expect(deedsDone(p, r)).toBe(true);
  });
});
