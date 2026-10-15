import { describe, expect, it } from 'vitest';
import { LANDMARKS } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { fordGeometry } from '../src/render/landmarksView';
import { LANDMARK_KINDS, fordMarch } from '../src/sim/landmarks';
import { spawnUnit } from '../src/sim/world';

describe('Old Ford', () => {
  const s = createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  it("quickens its keeper's soldiers, not citizens, traders or rivals", () => {
    const m = s.landmarks![0];
    m.kind = 'ford';
    m.owner = 0;
    const spear = spawnUnit(s, 0, 'infantry', m.x, m.y);
    const cit = spawnUnit(s, 0, 'citizen', m.x, m.y);
    const rival = spawnUnit(s, 1, 'infantry', m.x, m.y);
    expect(fordMarch(s, spear)).toBe(LANDMARKS.ford.march);
    expect(fordMarch(s, cit)).toBe(1);
    expect(fordMarch(s, rival)).toBe(1);
    m.owner = 1;
    expect(fordMarch(s, spear)).toBe(1);
    expect(LANDMARK_KINDS.ford.name).toBe('Old Ford');
  });
  it('has a model', () => {
    expect(fordGeometry().getAttribute('position').count).toBeGreaterThan(0);
  });
});
