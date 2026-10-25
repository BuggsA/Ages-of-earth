import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DRESSED_AGES, buildingGeometry } from '../src/render/buildingModels';
import { AGE_PALETTES, NEW_LOOK_AGES } from '../src/render/ageLooks';
import { AGES } from '../src/sim/data';
import type { AgeId, BuildingType } from '../src/sim/types';

/** Every age has a look of its own (#803; the owner, 2026-10-25). */

const TRUNK: AgeId[] = ['stone', 'bronze', 'middle', 'gunpowder', 'industrial'];
const ALL = Object.keys(AGES) as AgeId[];
const SIDE = ALL.filter((a) => !TRUNK.includes(a));

/** WCAG relative luminance of an sRGB hex, and its HSV hue and saturation. */
function measure(hex: string): { L: number; h: number; s: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const s = max ? d / max : 0;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { L, h: (h * 60 + 360) % 360, s };
}

/** A geometry's look: its vertex count and its summed colours, so two models alike in shape but not paint still differ. */
function signature(g: THREE.BufferGeometry): string {
  const c = g.getAttribute('color').array;
  let sum = 0;
  for (let i = 0; i < c.length; i++) sum += c[i] * ((i % 3) + 1);
  return `${g.getAttribute('position').count}:${sum.toFixed(2)}`;
}

const hasColor = (g: THREE.BufferGeometry, hex: string): boolean => {
  const want = new THREE.Color(hex);
  const c = g.getAttribute('color').array;
  for (let i = 0; i < c.length; i += 3) if (Math.abs(c[i] - want.r) + Math.abs(c[i + 1] - want.g) + Math.abs(c[i + 2] - want.b) < 1e-4) return true;
  return false;
};

describe('every age has a look of its own', () => {
  it('every age past the trunk is dressed and has a palette', () => {
    for (const a of SIDE) {
      expect(DRESSED_AGES, a).toContain(a);
      expect(AGE_PALETTES[a], a).toBeDefined();
    }
  });

  it('no two ages build the same house or the same Town Center', () => {
    for (const type of ['house', 'towncenter'] as BuildingType[]) {
      const seen = new Map<string, string>();
      for (const a of ALL) {
        const sig = signature(buildingGeometry(type, AGES[a].tier, '#cc3333', 0, a));
        expect(seen.get(sig), `${type}: ${a} looks like ${seen.get(sig)}`).toBeUndefined();
        seen.set(sig, a);
      }
    }
  });

  it('the newly dressed ages add touches to their halls and houses', () => {
    for (const a of NEW_LOOK_AGES) {
      for (const type of ['house', 'towncenter', 'barracks', 'market'] as BuildingType[]) {
        const plain = buildingGeometry(type, AGES[a].tier, '#cc3333');
        const dressed = buildingGeometry(type, AGES[a].tier, '#cc3333', 0, a);
        expect(dressed.getAttribute('position').count, `${a} ${type}`).toBeGreaterThan(plain.getAttribute('position').count);
        const pos = dressed.getAttribute('position');
        for (let i = 0; i < pos.count * 3; i++) expect(Number.isFinite(pos.array[i])).toBe(true);
      }
    }
  });

  it('palettes keep to the art bands: roofs dark or light, trim muted, nothing green', () => {
    for (const [a, p] of Object.entries(AGE_PALETTES)) {
      for (const roof of [p!.roof, p!.roof2]) {
        const m = measure(roof);
        expect(m.L <= 0.08 || m.L >= 0.37, `${a} roof ${roof} L ${m.L.toFixed(3)}`).toBe(true);
        if (m.L > 0.08) expect(m.s, `${a} roof ${roof}`).toBeLessThanOrEqual(0.6);
      }
      // Trim can cover whole walls in a trunk model, so it stays muted: never a team colour's saturation.
      for (const c of [p!.trim, p!.wall, p!.wall2, p!.base]) {
        const m = measure(c);
        if (m.L > 0.09) expect(m.s, `${a} ${c} too saturated`).toBeLessThanOrEqual(0.45);
      }
      for (const c of [p!.wall, p!.wall2, p!.roof, p!.roof2, p!.trim]) {
        const m = measure(c);
        expect(m.h >= 75 && m.h <= 165 && m.s > 0.2, `${a} ${c} is green`).toBe(false);
      }
    }
  });

  it('a house wears its age\'s roof, and a Barracks keeps the war slate whatever the age', () => {
    for (const a of SIDE) {
      const p = AGE_PALETTES[a]!;
      if (AGES[a].tier >= 1) expect(hasColor(buildingGeometry('barracks', AGES[a].tier, '#cc3333', 0, a), '#3e4858'), a).toBe(true);
      expect(hasColor(buildingGeometry('house', AGES[a].tier, '#cc3333', 0, a), p.wall) || hasColor(buildingGeometry('house', AGES[a].tier, '#cc3333', 0, a), p.roof), a).toBe(true);
    }
  });
});
