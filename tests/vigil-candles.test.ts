import { describe, expect, it } from 'vitest';
import { candleGeometry } from '../src/render/vigilCandlesView';

describe('vigil candle (#356)', () => {
  it('bakes a candle model with colours in its vertices', () => {
    const g = candleGeometry();
    expect(g.getAttribute('position').count).toBeGreaterThan(0);
    expect(g.getAttribute('color')).toBeDefined();
  });
});
