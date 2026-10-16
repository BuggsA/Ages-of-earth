import { describe, expect, it } from 'vitest';
import { buildingGeometry, heirloomsFor } from '../src/render/buildingModels';

describe('Way marks at the Town Center (#336)', () => {
  it('each Way dresses the Town Center and only it, differently', () => {
    expect(heirloomsFor('towncenter')).toEqual(['way:hunt', 'way:hearth', 'way:warband']);
    expect(heirloomsFor('house')).toEqual([]);
    const count = (h: string) => {
      const g = buildingGeometry('towncenter', 0, '#cc3333', 0, undefined, h);
      const pos = g.getAttribute('position');
      let extent = 0;
      for (let i = 0; i < pos.count * 3; i++) {
        expect(Number.isFinite(pos.array[i])).toBe(true);
        extent = Math.max(extent, Math.abs(pos.array[i]));
      }
      expect(extent).toBeLessThan(12);
      return pos.count;
    };
    const plain = count('');
    const marked = ['way:hunt', 'way:hearth', 'way:warband'].map(count);
    for (const n of marked) expect(n).toBeGreaterThan(plain);
    expect(new Set(marked).size).toBe(3);
  });
});
