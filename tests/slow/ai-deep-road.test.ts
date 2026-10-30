import { describe, expect, it } from 'vitest';
import { leanOf } from '../../src/sim/ai';
import { ageOf, hasWalked } from '../../src/sim/ages';
import { AGES } from '../../src/sim/data';
import { createGame, step } from '../../src/sim/game';
import { routeAges } from '../../src/sim/routePlay';
import type { GameState } from '../../src/sim/types';
import { restat } from '../../src/sim/world';

/**
 * The Deep Road end to end (#906): a hard computer with an open mind that has turned into the Megaliths leans to the road there and
 * walks it on its own to the Living Earth, every age in turn, and raises its Heartstone. At peace, so the match lasts long enough.
 */
describe('the computer walks the Deep Road to the Living Earth (#906)', () => {
  it('from the Megaliths, it takes every Deep Road age in turn and stands in the Living Earth within the hour', () => {
    let g: GameState | null = null;
    for (let seed = 1; seed <= 12 && !g; seed++) {
      const t = createGame({ seed, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }] });
      while (t.tick < 40) step(t);
      if (!leanOf(t, 0) && t.players[0].civ !== 'mongols') g = t;
    }
    expect(g).not.toBeNull();
    const s = g!;
    s.peaceUntil = 1e9;
    // Rich towns at peace raise wonders: no wonder victory ends this match before the road is walked.
    s.wonderTime = 1e9;
    const p = s.players[0];
    restat(s, p, () => {
      p.epoch = AGES.megaliths.tier;
      p.age = 'megaliths';
    });
    p.walked = ['megaliths'];
    const seen: string[] = ['megaliths'];
    while (s.tick < 1200 * 60 && !s.over && ageOf(p) !== 'living') {
      step(s);
      if (seen[seen.length - 1] !== ageOf(p)) seen.push(ageOf(p));
    }
    expect(leanOf(s, 0)).toBe('deep');
    expect(ageOf(p)).toBe('living');
    // Down the road and nowhere else: each Deep Road age in turn.
    expect(seen).toEqual(routeAges('deep'));
    for (const a of routeAges('deep')) expect(hasWalked(p, a)).toBe(true);
    const stone = () => s.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === 'heartstone' && e.built);
    for (let i = 0; i < 1200 * 3 && !stone(); i++) step(s);
    expect(stone()).toBe(true);
  }, 600_000);
});
