import { describe, expect, it } from 'vitest';
import { LANDMARKS } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { flintGeometry } from '../src/render/landmarksView';
import { LANDMARK_KINDS } from '../src/sim/landmarks';
import { gatherRate } from '../src/sim/units';
import { R_FISH, R_STONE, R_TREE } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

describe('Flint Scatter', () => {
  const s = createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  it("speeds its keeper's chopping and mining, nothing else, and not a rival's", () => {
    const a = spawnUnit(s, 0, 'citizen', 10, 10);
    const b = spawnUnit(s, 1, 'citizen', 12, 10);
    const before = [gatherRate(s, a, R_TREE), gatherRate(s, a, R_STONE), gatherRate(s, a, R_FISH)];
    const m = s.landmarks![0];
    m.kind = 'flint';
    m.owner = 0;
    expect(gatherRate(s, a, R_TREE)).toBeCloseTo(before[0] * LANDMARKS.flint.tools);
    expect(gatherRate(s, a, R_STONE)).toBeCloseTo(before[1] * LANDMARKS.flint.tools);
    expect(gatherRate(s, a, R_FISH)).toBe(before[2]);
    expect(gatherRate(s, b, R_TREE)).toBeLessThan(gatherRate(s, a, R_TREE));
    expect(LANDMARK_KINDS.flint.name).toBe('Flint Scatter');
  });
  it('has a model', () => {
    expect(flintGeometry().getAttribute('position').count).toBeGreaterThan(0);
  });
});
