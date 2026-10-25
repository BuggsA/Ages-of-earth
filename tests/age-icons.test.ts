import { describe, expect, it } from 'vitest';
import { AGES } from '../src/sim/data';
import type { AgeId } from '../src/sim/types';
import { AGE_ICONS, MOTIFS, PLATES, luminance, plateColors, plateSvg, plateUrl, stampOf } from '../src/ui/ageIcons';

const ids = Object.keys(AGES) as AgeId[];

// The owner, 2026-10-25: a look is "not a color change": the button icons are iconic to the age.
describe('every age has icons of its own', () => {
  it('dresses every age with a known plate, motif and stamp', () => {
    for (const id of ids) {
      const i = AGE_ICONS[id];
      expect(i, id).toBeDefined();
      expect(PLATES[i.plate], id).toBeTruthy();
      expect(MOTIFS[i.motif], id).toBeTruthy();
      expect(stampOf(id), id).toBe(i.stamp);
    }
    expect(Object.keys(AGE_ICONS).sort()).toEqual([...ids].sort());
  });

  it('gives no two ages the same plate and motif', () => {
    const seen = new Map<string, AgeId>();
    for (const id of ids) {
      const key = `${AGE_ICONS[id].plate}/${AGE_ICONS[id].motif}`;
      expect(seen.get(key), `${id} repeats ${seen.get(key)}`).toBeUndefined();
      seen.set(key, id);
    }
  });

  it('keeps the shapes varied: no plate on more than three ages, and many shapes in all', () => {
    const uses: Record<string, number> = {};
    for (const id of ids) uses[AGE_ICONS[id].plate] = (uses[AGE_ICONS[id].plate] ?? 0) + 1;
    expect(Math.max(...Object.values(uses))).toBeLessThanOrEqual(3);
    expect(Object.keys(uses).length).toBeGreaterThanOrEqual(15);
  });

  it('draws a distinct plate for every age, readable against its glyphs', () => {
    const svgs = new Set(ids.map((id) => plateSvg(id)));
    expect(svgs.size).toBe(ids.length);
    for (const id of ids) {
      expect(plateUrl(id)).toContain('data:image/svg+xml;base64,');
      const c = plateColors(id);
      // Light plates take dark ink and dark ones light ink: the motif and the glyphs stay legible.
      const mid = (luminance(c.top) + luminance(c.bottom)) / 2;
      expect(Math.abs(luminance(c.ink) - mid), id).toBeGreaterThan(0.1);
    }
  });
});
