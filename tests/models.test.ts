import { describe, expect, it } from 'vitest';
import { buildingGeometry } from '../src/render/buildingModels';
import { unitGeometry } from '../src/render/unitModels';
import { BUILDING_TYPES, UNIT_TYPES } from '../src/sim/data';

/**
 * A render check that needs no browser or GPU: every model builds in every epoch, is not empty, has
 * no NaN vertices, and stays a sensible size. It catches a model that throws, vanishes or explodes,
 * which is most of what a look in the browser would catch for a model change.
 */
function sound(g: ReturnType<typeof unitGeometry>, maxExtent: number): void {
  const pos = g.getAttribute('position');
  expect(pos.count).toBeGreaterThan(0);
  let extent = 0;
  for (let i = 0; i < pos.count * 3; i++) {
    expect(Number.isFinite(pos.array[i])).toBe(true);
    extent = Math.max(extent, Math.abs(pos.array[i]));
  }
  expect(extent).toBeLessThan(maxExtent);
  for (const a of ['color', 'aTeam', 'aRig']) expect(g.getAttribute(a)).toBeDefined();
}

describe('models', () => {
  it('every unit builds in every epoch', () => {
    for (const t of UNIT_TYPES) for (let e = 0; e < 5; e++) sound(unitGeometry(t, e), 6);
  });
  it('every building builds in every epoch', () => {
    for (const t of BUILDING_TYPES) for (let e = 0; e < 5; e++) sound(buildingGeometry(t, e, '#cc3333'), 12);
  });
});
