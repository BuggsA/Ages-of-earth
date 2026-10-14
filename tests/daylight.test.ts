import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, clockWords, hourAt, lightAt } from '../src/render/daylight';

describe('daylight', () => {
  it('opens every match in the morning, by seed, and is the same each time', () => {
    for (let seed = 1; seed < 60; seed++) {
      const h = hourAt(seed, 0);
      expect(h).toBeGreaterThanOrEqual(7.5);
      expect(h).toBeLessThan(11);
      expect(hourAt(seed, 0)).toBe(h);
    }
  });

  it('turns one whole day in DAY_SECONDS', () => {
    expect(hourAt(7, DAY_SECONDS)).toBeCloseTo(hourAt(7, 0), 6);
    expect(hourAt(7, DAY_SECONDS / 2)).toBeCloseTo((hourAt(7, 0) + 12) % 24, 6);
  });

  it('is brightest at noon and dimmest at night, with the moon high', () => {
    const noon = lightAt(12);
    const night = lightAt(1);
    expect(noon.sun).toBe(1);
    expect(night.sun).toBeLessThan(0.4);
    expect(night.dir[1]).toBeGreaterThan(0.4);
    expect(noon.top).toBe('#5aa7e0');
  });

  it('is warm and low at the golden hour', () => {
    const gold = lightAt(18);
    const noon = lightAt(12);
    expect(gold.dir[1]).toBeLessThan(noon.dir[1]);
    expect(gold.sunColor).not.toBe(noon.sunColor);
  });

  it('never jumps: the light and its direction change a little each minute, all day', () => {
    let prev = lightAt(0);
    for (let m = 1; m <= 24 * 60; m++) {
      const l = lightAt(m / 60);
      expect(Math.abs(l.sun - prev.sun)).toBeLessThan(0.02);
      for (let i = 0; i < 3; i++) expect(Math.abs(l.dir[i] - prev.dir[i])).toBeLessThan(0.02);
      const len = Math.hypot(...l.dir);
      expect(len).toBeCloseTo(1, 6);
      prev = l;
    }
  });

  it('writes the clock', () => {
    expect(clockWords(8.5)).toBe('08:30');
    expect(clockWords(0)).toBe('00:00');
  });
});
