import { describe, expect, it } from 'vitest';
import { createGame, step } from '../src/sim/game';

// A computer that has chosen a road raises its clue building (#555 s0): the Warband's Barracks went unbuilt for a Greek city, whose
// Barracks trains no foot, so the town never saw the road and took the trunk.
describe('a chosen road\'s clue', () => {
  it('a Greek city bound for the Warband raises its Barracks in the Middle Ages', () => {
    const s = createGame({ seed: 1, size: 'small', startEpoch: 2, players: [{ name: 'Route', ai: 'hard', civ: 'greeks' }, { name: 'Rival', ai: 'normal' }] });
    step(s);
    s.ai[0].roads = { warband: true };
    while (s.tick < 1200 * 4 && !s.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === 'barracks')) step(s);
    expect(s.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === 'barracks')).toBe(true);
  });
});
