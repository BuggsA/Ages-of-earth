import { describe, expect, it } from 'vitest';
import { bannerGeometry, cairnGeometry, cragGeometry, springGeometry } from '../src/render/landmarksView';

/** Like `models.test.ts`: the landmark models build without a browser, are not empty, have no NaN and stay landmark-sized. */
describe('landmark models', () => {
  it('the spring, the crag, the cairn and the keeper\'s banner all build', () => {
    for (const make of [springGeometry, cragGeometry, cairnGeometry, bannerGeometry]) {
      const g = make();
      const pos = g.getAttribute('position');
      expect(pos.count).toBeGreaterThan(0);
      let extent = 0;
      for (let i = 0; i < pos.count * 3; i++) {
        expect(Number.isFinite(pos.array[i])).toBe(true);
        extent = Math.max(extent, Math.abs(pos.array[i]));
      }
      expect(extent).toBeLessThan(2.5);
      for (const a of ['color', 'aTeam', 'aRig']) expect(g.getAttribute(a)).toBeDefined();
    }
  });

  it('the banner wears its keeper\'s colour', () => {
    const team = bannerGeometry().getAttribute('aTeam');
    let tinted = 0;
    for (let i = 0; i < team.count; i++) if (team.getX(i) === 1) tinted++;
    expect(tinted).toBeGreaterThan(0);
  });
});
