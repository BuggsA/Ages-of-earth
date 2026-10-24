import { describe, expect, it } from 'vitest';
import { breathe, moodOf } from '../src/render/weather';

describe('a mist that breathes', () => {
  const mist = { kind: 'mist' as const, strength: 0.9 };

  it('starts the match thick, thins by mid-period and comes back', () => {
    expect(breathe(mist, 0).strength).toBeCloseTo(0.9, 1);
    const thin = breathe(mist, 4).strength;
    expect(thin).toBeLessThan(0.35);
    expect(thin).toBeGreaterThan(0.2);
    expect(breathe(mist, 8).strength).toBeCloseTo(0.9, 1);
  });

  it('leaves every other day as it is', () => {
    for (const kind of ['clear', 'rain', 'snow'] as const) {
      const d = { kind, strength: 0.7 };
      expect(breathe(d, 3.3)).toBe(d);
    }
  });

  it('lets a thick mist still reach farther than it used to, so the land near the camera stays readable', () => {
    expect(moodOf({ kind: 'mist', strength: 1 }).reach).toBeGreaterThan(0.44);
    expect(moodOf({ kind: 'mist', strength: 0.5 }).reach).toBeGreaterThan(moodOf({ kind: 'mist', strength: 1 }).reach);
  });
});
