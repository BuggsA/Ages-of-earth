import { describe, expect, it } from 'vitest';
import { LANDMARKS } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { groveGeometry } from '../src/render/landmarksView';
import { LANDMARK_KINDS, groveBoost } from '../src/sim/landmarks';
import { spawnUnit } from '../src/sim/world';

describe('Sacred Grove', () => {
  const s = createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  it("speeds its keeper's priests near it, no one else's and not far off", () => {
    const m = s.landmarks![0];
    m.kind = 'grove';
    m.owner = 0;
    const near = spawnUnit(s, 0, 'priest', m.x + 3, m.y);
    const far = spawnUnit(s, 0, 'priest', m.x + LANDMARKS.grove.reach + 3, m.y);
    const rival = spawnUnit(s, 1, 'priest', m.x + 3, m.y);
    expect(groveBoost(s, near)).toBe(LANDMARKS.grove.priest);
    expect(groveBoost(s, far)).toBe(1);
    expect(groveBoost(s, rival)).toBe(1);
    m.owner = -1;
    expect(groveBoost(s, near)).toBe(1);
    expect(LANDMARK_KINDS.grove.name).toBe('Sacred Grove');
  });
  it('has a model', () => {
    expect(groveGeometry().getAttribute('position').count).toBeGreaterThan(0);
  });
});
