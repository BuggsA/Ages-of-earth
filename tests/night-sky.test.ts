import { describe, expect, it } from 'vitest';
import { lightAt, moonPhase } from '../src/render/daylight';

describe('the night sky', () => {
  it('shows stars and the moon only at night', () => {
    expect(lightAt(12).moon).toBe(0);
    expect(lightAt(1).moon).toBe(1);
    const dusk = lightAt(20.5).moon;
    expect(dusk).toBeGreaterThan(0);
    expect(dusk).toBeLessThan(1);
  });

  it('gives a match one moon phase from its seed, full to a thin crescent', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const p = moonPhase(seed);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(0.9);
      expect(moonPhase(seed)).toBe(p);
      seen.add(p);
    }
    expect(seen.size).toBeGreaterThan(4);
  });
});
