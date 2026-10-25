import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AGE_GROUNDS, GROUND_AGES, ageSparks, groundColor } from '../src/render/ageGrounds';
import { AGES } from '../src/sim/data';
import type { AgeId } from '../src/sim/types';

/** The ground wears your age (#815, after #803; the owner, 2026-10-25: "each age should have a distinct or unique look"). */

const ALL = Object.keys(AGES) as AgeId[];

/** WCAG relative luminance of an sRGB hex, and its HSV saturation. */
function measure(hex: string): { L: number; s: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const max = Math.max(r, g, b);
  return { L: 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b), s: max ? (max - Math.min(r, g, b)) / max : 0 };
}

/** A ground's look over an 8 by 8 patch of tiles, both facets each: the colours it lays, in order. */
function patch(age: AgeId): number[] {
  const c = new THREE.Color();
  const out: number[] = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) for (const t of [0, 1]) out.push(...groundColor(c, age, x, y, t, 0.5).toArray());
  return out;
}

describe('the ground wears your age', () => {
  it('every age has a ground, and the tiles can name it', () => {
    for (const a of ALL) expect(AGE_GROUNDS[a], a).toBeDefined();
    expect([...GROUND_AGES].sort()).toEqual([...ALL].sort());
  });

  it('stays the quietest thing on screen: dark and dull enough for units and buildings to stand off it (docs/art.md)', () => {
    for (const a of ALL) {
      const main = measure(AGE_GROUNDS[a].a);
      const accent = measure(AGE_GROUNDS[a].b);
      expect(main.L, `${a} ground`).toBeGreaterThanOrEqual(0.02);
      expect(main.L, `${a} ground`).toBeLessThanOrEqual(0.3);
      expect(accent.L, `${a} accent`).toBeLessThanOrEqual(0.42);
      expect(main.s, `${a} ground`).toBeLessThanOrEqual(0.5);
      // An accent is a fleck (a flower, a shell, rust), so it may be as bright in colour as a berry bush, not more.
      expect(accent.s, `${a} accent`).toBeLessThanOrEqual(0.66);
    }
  });

  it('no two ages lay the same ground', () => {
    const looks = ALL.map((a) => [a, patch(a)] as const);
    for (let i = 0; i < looks.length; i++) {
      for (let j = i + 1; j < looks.length; j++) {
        const [a, pa] = looks[i];
        const [b, pb] = looks[j];
        let d = 0;
        for (let k = 0; k < pa.length; k++) d += Math.abs(pa[k] - pb[k]);
        // Mean difference per colour channel over the patch.
        expect(d / pa.length, `${a} vs ${b}`).toBeGreaterThan(0.015);
      }
    }
  });

  it("lights a side age's age-up in its own colours; the main road keeps its gold", () => {
    expect(ageSparks('middle')).toBeNull();
    expect(ageSparks(undefined)).toBeNull();
    const seen = new Set<string>();
    for (const a of ALL) {
      const c = ageSparks(a);
      if (!c) continue;
      expect(c).toHaveLength(3);
      seen.add(c.join());
    }
    expect(seen.size).toBeGreaterThan(30);
  });
});
