import { describe, expect, it } from 'vitest';
import { bannerGeometry } from '../src/render/fairBannersView';

describe('fairground discount banner (#356)', () => {
  it('bakes a banner model with colours in its vertices', () => {
    const g = bannerGeometry();
    expect(g.getAttribute('position').count).toBeGreaterThan(0);
    expect(g.getAttribute('color')).toBeDefined();
  });
});
