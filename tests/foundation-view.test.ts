import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { serialize } from '../src/sim/save';
import { FoundationView, foundationSites, MAX_FOUNDATIONS } from '../src/render/foundationView';

const game = () => createGame({ seed: 11, size: 'small', startEpoch: 2, players: [
  { name: 'A', ai: null, civ: 'britons' }, { name: 'B', ai: null, civ: 'romans' },
] });

describe('foundation ghosts', () => {
  it('lists only the viewer\'s live foundations and never changes the state', () => {
    const s = game();
    s.fallen = [
      { owner: 0, type: 'tower', tx: 10, ty: 12, until: s.tick + 100 },
      { owner: 1, type: 'tower', tx: 30, ty: 30, until: s.tick + 100 },
      { owner: 0, type: 'house', tx: 14, ty: 12, until: s.tick },
    ];
    const before = serialize(s);
    const sites = foundationSites(s, 0);
    expect(sites).toEqual([{ type: 'tower', tx: 10, ty: 12, size: BUILDINGS.tower.size }]);
    expect(serialize(s)).toBe(before);
  });

  it('draws nothing with no foundations, outlines when seen, and respects the cap', () => {
    const s = game();
    const v = new FoundationView();
    v.update(s, 0, () => true);
    expect(v.mesh.geometry.drawRange.count).toBe(0);
    s.fallen = [{ owner: 0, type: 'tower', tx: 10, ty: 12, until: s.tick + 100 }];
    v.update(s, 0, () => false);
    expect(v.mesh.geometry.drawRange.count).toBe(0);
    s.tick += 8;
    v.update(s, 0, () => true);
    expect(v.mesh.geometry.drawRange.count).toBeGreaterThan(0);
    s.fallen = Array.from({ length: MAX_FOUNDATIONS + 10 }, (_, i) => ({ owner: 0, type: 'tower' as const, tx: i, ty: 5, until: s.tick + 100 }));
    expect(foundationSites(s, 0)).toHaveLength(MAX_FOUNDATIONS);
  });
});
