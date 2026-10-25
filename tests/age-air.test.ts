import { describe, expect, it } from 'vitest';
import { AGE_AIR } from '../src/render/ageAir';
import { AGES } from '../src/sim/data';
import type { AgeId } from '../src/sim/types';

/** The air of an age (#803): every age leans the sky its own way, and none hides the play area. */

const ALL = Object.keys(AGES) as AgeId[];
const rgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const NOON_HORIZON = '#cfe8f3';

/** The horizon colour at noon with an age's air laid over it (the view's own lerp). */
function horizonAt(age: AgeId): number[] {
  const a = AGE_AIR[age];
  const base = rgb(NOON_HORIZON);
  const t = rgb(a.tint);
  return base.map((c, i) => c + (t[i] - c) * Math.min(1, a.k * 1.3));
}

describe('the air of an age', () => {
  it('every age has one', () => {
    for (const a of ALL) expect(AGE_AIR[a], a).toBeDefined();
    expect(Object.keys(AGE_AIR).sort()).toEqual([...ALL].sort());
  });

  it('leans at most 0.4, so the land stays readable', () => {
    for (const a of ALL) {
      expect(AGE_AIR[a].k, a).toBeGreaterThan(0.1);
      expect(AGE_AIR[a].k, a).toBeLessThanOrEqual(0.4);
      expect(AGE_AIR[a].tint, a).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('no two ages have the same horizon at noon', () => {
    for (let i = 0; i < ALL.length; i++) {
      for (let j = i + 1; j < ALL.length; j++) {
        const a = horizonAt(ALL[i]);
        const b = horizonAt(ALL[j]);
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        expect(d, `${ALL[i]} and ${ALL[j]}`).toBeGreaterThanOrEqual(8);
      }
    }
  });
});
