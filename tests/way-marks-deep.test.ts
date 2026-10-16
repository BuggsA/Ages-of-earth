import { describe, expect, it } from 'vitest';
import { buildingGeometry } from '../src/render/buildingModels';

describe('A deepened Way shows a second flourish (#338)', () => {
  it('adds geometry to each Way mark, and only at the Town Center', () => {
    for (const w of ['way:hunt', 'way:hearth', 'way:warband']) {
      const plain = buildingGeometry('towncenter', 0, '#cc3333', 0, undefined, w).getAttribute('position').count;
      const deep = buildingGeometry('towncenter', 0, '#cc3333', 0, undefined, `${w},deep`);
      expect(deep.getAttribute('position').count).toBeGreaterThan(plain);
      for (const v of deep.getAttribute('position').array) expect(Number.isFinite(v)).toBe(true);
    }
    const house = buildingGeometry('house', 0, '#cc3333', 0, undefined, 'deep').getAttribute('position').count;
    expect(house).toBe(buildingGeometry('house', 0, '#cc3333').getAttribute('position').count);
  });
});
