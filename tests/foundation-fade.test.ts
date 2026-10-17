import { describe, expect, it } from 'vitest';
import { BUILDINGS, RECLAIM, secs } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { serialize } from '../src/sim/save';
import { FoundationView } from '../src/render/foundationView';

const game = () => createGame({ seed: 11, size: 'small', startEpoch: 2, players: [
  { name: 'A', ai: null, civ: 'britons' }, { name: 'B', ai: null, civ: 'romans' },
] });

describe('foundation fading', () => {
  it('draws an older site fainter than a fresh site in the same geometry', () => {
    const s = game();
    s.fallen = [
      { owner: 0, type: 'tower', tx: 10, ty: 12, until: s.tick + secs(RECLAIM.window) },
      { owner: 0, type: 'tower', tx: 20, ty: 12, until: s.tick + secs(RECLAIM.window / 4) },
    ];
    const before = serialize(s);
    const view = new FoundationView();
    view.update(s, 0, () => true);
    const colors = view.mesh.geometry.getAttribute('color');
    const perSite = BUILDINGS.tower.size * 8;
    expect(view.mesh.geometry.drawRange.count).toBe(perSite * 2);
    expect(colors.getW(0)).toBeGreaterThan(colors.getW(perSite));
    expect(colors.getW(perSite)).toBeGreaterThan(0);
    expect(serialize(s)).toBe(before);
  });

  it('fades with match time, keeps the oldest site legible, then removes it at expiry', () => {
    const s = game();
    const until = s.tick + secs(RECLAIM.window);
    s.fallen = [{ owner: 0, type: 'tower', tx: 10, ty: 12, until }];
    const view = new FoundationView();
    const geometry = view.mesh.geometry;
    const colors = geometry.getAttribute('color');
    view.update(s, 0, () => true);
    const fresh = colors.getW(0);
    s.tick += secs(RECLAIM.window / 2);
    view.update(s, 0, () => true);
    const halfway = colors.getW(0);
    expect(halfway).toBeLessThan(fresh);
    view.update(s, 0, () => true);
    expect(colors.getW(0)).toBe(halfway); // Paused match: no wall-clock fade.
    s.tick = until - 8;
    view.update(s, 0, () => true);
    expect(colors.getW(0)).toBeLessThan(halfway);
    expect(colors.getW(0)).toBeGreaterThan(0);
    s.tick = until;
    view.update(s, 0, () => true);
    expect(geometry.drawRange.count).toBe(0);
    expect(view.mesh.geometry).toBe(geometry);
    expect(geometry.getAttribute('color')).toBe(colors);
  });
});
