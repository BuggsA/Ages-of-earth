import { describe, expect, it } from 'vitest';
import { SORTIE } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { serialize } from '../src/sim/save';
import { findSpot } from '../src/sim/ai';
import { placeBuilding } from '../src/sim/world';
import { RangeGuides, sortieRings } from '../src/render/rangeGuides';

/** The Sorties range rings (#356 audit, lane look): the fuel bands round an Airfield. */
function setup(age: 'aeronaut' | 'industrial') {
  const s = createGame({ seed: 5, size: 'medium', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  s.players[0].epoch = 4;
  s.players[0].age = age;
  const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
  return { s, tc };
}
const airfield = (s: ReturnType<typeof setup>['s'], owner: number, near: { x: number; y: number }, built = true) => {
  const spot = findSpot(s, 'airfield', near.x, near.y, 4, 24)!;
  return placeBuilding(s, owner, 'airfield', spot.tx, spot.ty, built);
};

describe('sortie rings', () => {
  it('draws mend, turn and burn bands round a finished own Airfield, at the SORTIE distances', () => {
    const { s, tc } = setup('aeronaut');
    const f = airfield(s, 0, tc);
    const rings = sortieRings(s, 0, tc);
    expect(rings.map((r) => [r.band, r.reach])).toEqual([['rearm', SORTIE.rearm], ['turn', SORTIE.turn], ['reach', SORTIE.reach]]);
    for (const r of rings) expect([r.x, r.y]).toEqual([f.x, f.y]);
  });

  it('shows nothing outside the age, for unfinished or rival Airfields, or with none', () => {
    const { s, tc } = setup('aeronaut');
    expect(sortieRings(s, 0, tc)).toEqual([]);
    airfield(s, 0, tc, false);
    airfield(s, 1, tc);
    expect(sortieRings(s, 0, tc)).toEqual([]);
    const o = setup('industrial');
    airfield(o.s, 0, o.tc);
    expect(sortieRings(o.s, 0, o.tc)).toEqual([]);
  });

  it('keeps only the nearest Airfields, ties broken by id, without touching the state', () => {
    const { s, tc } = setup('aeronaut');
    const fields = [0, 1, 2, 3, 4].map(() => airfield(s, 0, tc));
    const before = serialize(s);
    const near = { x: fields[2].x, y: fields[2].y };
    const rings = sortieRings(s, 0, near, 2);
    expect(rings).toHaveLength(6);
    expect([rings[0].x, rings[0].y]).toEqual([fields[2].x, fields[2].y]);
    expect(sortieRings(s, 0, near, 2)).toEqual(rings);
    expect(serialize(s)).toBe(before);
  });

  it('is drawn: nine bands fit the guide budget and each adds line segments', () => {
    const { s, tc } = setup('aeronaut');
    for (let i = 0; i < 4; i++) airfield(s, 0, tc);
    const rings = sortieRings(s, 0, tc);
    expect(rings).toHaveLength(9);
    const guides = new RangeGuides();
    guides.update(s, rings.slice(0, 3), () => true);
    const three = guides.mesh.geometry.drawRange.count;
    guides.update(s, rings, () => true);
    expect(three).toBeGreaterThan(0);
    expect(guides.mesh.geometry.drawRange.count).toBeGreaterThan(three);
  });
});
