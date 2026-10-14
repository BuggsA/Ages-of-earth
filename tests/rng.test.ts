import { describe, expect, it } from 'vitest';
import { fbm, hash2, mulberry32, valueNoise } from '../src/sim/rng';

describe('seeded randomness', () => {
  it('draws the same stream from the same seed, and a different one from another', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const xs = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(xs);
    expect(Array.from({ length: 50 }, () => c())).not.toEqual(xs);
  });

  it('stays in 0..1 and spreads evenly', () => {
    const r = mulberry32(7);
    const bins = new Array(10).fill(0);
    for (let i = 0; i < 20000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      bins[Math.floor(v * 10)]++;
    }
    for (const n of bins) expect(Math.abs(n - 2000)).toBeLessThan(200);
  });

  it('picks up where it left off from a saved state (saves and online play rely on it)', () => {
    const r = mulberry32(99);
    for (let i = 0; i < 17; i++) r();
    const saved = r.state;
    const ahead = [r(), r(), r()];
    const resumed = mulberry32(saved);
    expect([resumed(), resumed(), resumed()]).toEqual(ahead);
  });

  it('hashes a tile to a fixed value in 0..1 that changes with the tile and the salt', () => {
    expect(hash2(3, 5)).toBe(hash2(3, 5));
    expect(hash2(3, 5, 1)).toBe(hash2(3, 5, 1));
    const seen = new Set<number>();
    for (let x = -20; x < 20; x++) {
      for (let y = -20; y < 20; y++) {
        const h = hash2(x, y, 11);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(1);
        seen.add(h);
      }
    }
    expect(seen.size).toBeGreaterThan(1590);
    expect(hash2(3, 5, 1)).not.toBe(hash2(3, 5, 2));
    expect(hash2(3, 5)).not.toBe(hash2(5, 3));
  });

  it('gives smooth value noise that meets the lattice hashes at whole numbers', () => {
    for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) expect(valueNoise(x, y, 4)).toBeCloseTo(hash2(x, y, 4), 12);
    // Smooth: a small step moves the value only a little.
    for (let i = 0; i < 200; i++) {
      const x = i * 0.137;
      const y = i * 0.071;
      const v = valueNoise(x, y, 4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(Math.abs(valueNoise(x + 0.001, y, 4) - v)).toBeLessThan(0.01);
    }
  });

  it('layers noise into 0..1, with one octave the plain noise', () => {
    for (let i = 0; i < 300; i++) {
      const x = i * 0.31;
      const y = i * 0.17;
      const v = fbm(x, y, 9);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(fbm(x, y, 9, 1)).toBe(valueNoise(x, y, 9));
    }
    expect(fbm(2.5, 7.25, 3)).toBe(fbm(2.5, 7.25, 3));
  });
});
