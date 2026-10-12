/** A seeded random stream whose position can be read and restored. */
export interface Rng {
  (): number;
  state: number;
}

/** Small seeded PRNG (mulberry32). Same seed, same map, same match. */
export function mulberry32(seed: number): Rng {
  const next = (() => {
    next.state = (next.state + 0x6d2b79f5) >>> 0;
    let t = next.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rng;
  next.state = seed >>> 0;
  return next;
}

/** Stateless hash of two integers, for variation that never changes (0..1). */
export function hash2(x: number, y: number, salt = 0): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Smooth value noise built only from integer hashing, + - * and division, so it gives identical
 * results in every browser (no Math.sin or Math.pow, which can differ between engines).
 */
export function valueNoise(x: number, y: number, salt: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, salt);
  const b = hash2(ix + 1, iy, salt);
  const c = hash2(ix, iy + 1, salt);
  const d = hash2(ix + 1, iy + 1, salt);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Layered value noise in 0..1. */
export function fbm(x: number, y: number, salt: number, octaves = 4): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * f, y * f, salt + i * 101) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}
