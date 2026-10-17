import { describe, expect, it } from 'vitest';
import { buildingGeometry, HEIRLOOM_FIELD, HEIRLOOM_MARKS } from '../src/render/buildingModels';
import { LAST_EPOCH, TECHS } from '../src/sim/data';

const verts = (g: ReturnType<typeof buildingGeometry>) => g.getAttribute('position').count;

describe('heirloom looks (#224)', () => {
  it('each mark names a real heirloom tech', () => {
    for (const id of Object.values(HEIRLOOM_MARKS)) expect(TECHS[id as keyof typeof TECHS]?.walked).toBeDefined();
  });

  it('a Temple with the Bell Foundry and a Dock with Iron-Bound Hulls gain a touch, in every epoch', () => {
    for (const [type, id] of Object.entries(HEIRLOOM_MARKS)) {
      for (let e = 0; e <= LAST_EPOCH; e++) {
        const plain = buildingGeometry(type as 'temple', e, '#cc3333');
        const marked = buildingGeometry(type as 'temple', e, '#cc3333', 0, undefined, id);
        expect(verts(marked)).toBeGreaterThan(verts(plain));
        expect(buildingGeometry(type as 'temple', e, '#cc3333', 0, undefined, id)).toBe(marked);
      }
    }
  });

  it('a mark for another building changes nothing', () => {
    expect(buildingGeometry('temple', 2, '#cc3333', 0, undefined, 'ironHulls')).toBe(buildingGeometry('temple', 2, '#cc3333'));
  });
});

describe('second heirloom marks', () => {
  it('the Market shows the Joint-Stock Company and the Temple the Masons\' Lodge, beside the Bell Foundry', () => {
    for (let e = 0; e <= LAST_EPOCH; e++) {
      const market = buildingGeometry('market', e, '#cc3333');
      expect(verts(buildingGeometry('market', e, '#cc3333', 0, undefined, 'jointStock'))).toBeGreaterThan(verts(market));
      const bell = buildingGeometry('temple', e, '#cc3333', 0, undefined, 'bellFoundry');
      const lodge = buildingGeometry('temple', e, '#cc3333', 0, undefined, 'masonsLodge');
      const both = buildingGeometry('temple', e, '#cc3333', 0, undefined, 'bellFoundry,masonsLodge');
      expect(verts(lodge)).toBeGreaterThan(verts(buildingGeometry('temple', e, '#cc3333')));
      expect(verts(both)).toBeGreaterThan(verts(bell));
      expect(verts(both)).toBeGreaterThan(verts(lodge));
    }
  });
});

describe('Age of Lightning heirloom marks (#240)', () => {
  it('the Temple, Dock and Workshop each gain a touch for their Lightning heirloom, in every epoch', () => {
    for (const [type, id] of Object.entries(HEIRLOOM_FIELD)) {
      expect(TECHS[id as keyof typeof TECHS]?.walked).toBeDefined();
      for (let e = 0; e <= LAST_EPOCH; e++) {
        const plain = buildingGeometry(type as 'temple', e, '#cc3333');
        expect(verts(buildingGeometry(type as 'temple', e, '#cc3333', 0, undefined, id))).toBeGreaterThan(verts(plain));
      }
    }
  });
});
