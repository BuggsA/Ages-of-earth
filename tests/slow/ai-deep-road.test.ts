import { describe, expect, it } from 'vitest';
import { leanOf } from '../../src/sim/ai';
import { ageOf, hasWalked } from '../../src/sim/ages';
import { createGame, step } from '../../src/sim/game';
import { routeAges } from '../../src/sim/routePlay';
import type { GameState } from '../../src/sim/types';

/**
 * The Deep Road end to end (#906): a hard computer that leans to the `deep` route on its own dice walks it from the Stone Age to the
 * Living Earth, every age of it in turn, and raises its Heartstone. At peace, so the match lasts long enough to walk it.
 */
describe('the computer walks the Deep Road to the Living Earth (#906)', () => {
  it('a seat leaning deep takes every Deep Road age in turn and stands in the Living Earth within the hour', () => {
    let s: GameState | null = null;
    let id = -1;
    for (let seed = 1; seed <= 60 && id < 0; seed++) {
      const t = createGame({ seed, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }] });
      while (t.tick < 40) step(t);
      id = t.players.findIndex((p) => leanOf(t, p.id) === 'deep');
      if (id >= 0) s = t;
    }
    expect(s).not.toBeNull();
    const g = s!;
    g.peaceUntil = 1e9;
    // Rich towns at peace raise wonders: no wonder victory ends this match before the road is walked.
    g.wonderTime = 1e9;
    const p = g.players[id];
    const seen: string[] = [];
    while (g.tick < 1200 * 60 && !g.over && ageOf(p) !== 'living') {
      step(g);
      if (seen[seen.length - 1] !== ageOf(p)) seen.push(ageOf(p));
    }
    expect(ageOf(p)).toBe('living');
    // Down the road and nowhere else: each Deep Road age in turn from the Stone Age.
    expect(seen).toEqual(['stone', ...routeAges('deep')]);
    for (const a of routeAges('deep')) expect(hasWalked(p, a)).toBe(true);
    for (let i = 0; i < 1200 * 3 && !g.ents.some((e) => e.kind === 'building' && e.owner === id && e.type === 'heartstone' && e.built); i++) step(g);
    expect(g.ents.some((e) => e.kind === 'building' && e.owner === id && e.type === 'heartstone' && e.built)).toBe(true);
  }, 600_000);
});
