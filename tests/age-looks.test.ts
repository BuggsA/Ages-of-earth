import { describe, expect, it } from 'vitest';
import { LOOK_AGES, buildingGeometry } from '../src/render/buildingModels';
import { AGES, BUILDING_TYPES } from '../src/sim/data';
import type { BuildingType } from '../src/sim/types';

/** Side ages (#55) dress buildings in their own touches, baked into the same one geometry each. */
const DRESSED: Record<string, BuildingType[]> = {
  merchant: ['market', 'house', 'towncenter', 'storehouse'],
  iron: ['forge', 'house', 'towncenter', 'barracks', 'storehouse'],
  pilgrim: ['temple', 'house', 'towncenter', 'market'],
  fair: ['market', 'house', 'towncenter', 'temple'],
};

const verts = (g: ReturnType<typeof buildingGeometry>) => g.getAttribute('position').count;

describe('age looks', () => {
  it('every side age builds every building, sound and not huge', () => {
    for (const age of LOOK_AGES) {
      for (const t of BUILDING_TYPES) {
        const g = buildingGeometry(t, AGES[age].tier, '#cc3333', 0, age);
        const pos = g.getAttribute('position');
        expect(pos.count).toBeGreaterThan(0);
        for (let i = 0; i < pos.count * 3; i++) expect(Number.isFinite(pos.array[i])).toBe(true);
        for (const a of ['color', 'aTeam', 'aRig']) expect(g.getAttribute(a)).toBeDefined();
      }
    }
  });

  it('dressed buildings gain touches and stay one geometry', () => {
    for (const age of LOOK_AGES) {
      for (const t of DRESSED[age]) {
        const plain = buildingGeometry(t, AGES[age].tier, '#cc3333');
        const dressed = buildingGeometry(t, AGES[age].tier, '#cc3333', 0, age);
        expect(dressed).not.toBe(plain);
        expect(verts(dressed)).toBeGreaterThan(verts(plain));
      }
    }
  });

  it('the trunk ages, and walls, are drawn as before', () => {
    expect(buildingGeometry('market', 2, '#cc3333', 0, 'middle')).toBe(buildingGeometry('market', 2, '#cc3333'));
    expect(buildingGeometry('wall', 2, '#cc3333', 5, 'fair')).toBe(buildingGeometry('wall', 2, '#cc3333', 5));
  });

  it('each side age looks different on the same building', () => {
    const counts = new Set(LOOK_AGES.map((a) => verts(buildingGeometry('house', 2, '#cc3333', 0, a))));
    expect(counts.size).toBe(LOOK_AGES.length);
  });
});
