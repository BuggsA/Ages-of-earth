import { describe, expect, it } from 'vitest';
import { BUILDINGS, unitStats } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { serialize } from '../src/sim/save';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import { MAX_RANGE_GUIDES, placementRange, RangeGuides, selectedRange } from '../src/render/rangeGuides';
import { heightAt } from '../src/render/terrain';
import { WATER_Y } from '../src/render/water';

const game = () => createGame({ seed: 11, size: 'small', startEpoch: 2, players: [
  { name: 'A', ai: null, civ: 'britons' }, { name: 'B', ai: null, civ: 'romans' },
] });

describe('tactical reach', () => {
  it('tracks civilization, research and epoch changes without changing the state', () => {
    const s = game();
    const u = spawnUnit(s, 0, 'ranged', 20, 20);
    const base = unitStats('ranged', 2);
    expect(selectedRange(s, 0, u)!.reach).toBeCloseTo(base.range + base.radius + 1);
    restat(s, s.players[0], () => s.players[0].techs.push('fletching'));
    expect(selectedRange(s, 0, u)!.reach).toBeCloseTo(base.range + base.radius + 2);
    restat(s, s.players[0], () => { s.players[0].epoch = 4; s.players[0].age = 'industrial'; });
    const before = serialize(s);
    expect(selectedRange(s, 0, u)!.reach).toBeCloseTo(unitStats('ranged', 4).range + unitStats('ranged', 4).radius + 2);
    expect(serialize(s)).toBe(before);
  });

  it('excludes rivals, dead units, passengers, workers and unfinished defenses', () => {
    const s = game();
    const enemy = spawnUnit(s, 1, 'ranged', 20, 20);
    expect(selectedRange(s, 0, enemy)).toBeNull();
    const u = spawnUnit(s, 0, 'ranged', 20, 20);
    u.hp = 0;
    expect(selectedRange(s, 0, u)).toBeNull();
    u.hp = 40; u.inside = 123;
    expect(selectedRange(s, 0, u)).toBeNull();
    for (const type of ['citizen', 'priest', 'trader', 'infantry', 'fisher', 'transport'] as const) {
      expect(selectedRange(s, 0, spawnUnit(s, 0, type, 20, 20))).toBeNull();
    }
    expect(selectedRange(s, 0, placeBuilding(s, 0, 'tower', 20, 20, false))).toBeNull();
  });

  it('uses the same building center radius in a placement preview and a completed defense', () => {
    const s = game();
    restat(s, s.players[0], () => s.players[0].techs.push('fletching'));
    for (const type of ['tower', 'towncenter'] as const) {
      const b = placeBuilding(s, 0, type, 20, 20, true);
      const preview = placementRange(s, 0, type, 20, 20)!;
      expect(preview).toEqual(selectedRange(s, 0, b));
      expect(preview.reach).toBe(BUILDINGS[type].guns!.range + 2 + b.size / 2);
    }
    expect(placementRange(s, 0, 'house', 20, 20)).toBeNull();
    const siege = spawnUnit(s, 0, 'siege', 20, 20);
    expect(selectedRange(s, 0, siege)!.minimum).toBe(unitStats('siege', 2).minRange! + unitStats('siege', 2).radius);
    expect(selectedRange(s, 0, spawnUnit(s, 0, 'warship', 20, 20))!.reach).toBeGreaterThan(0);
  });

  it('drapes over hills and water, clips hidden ground and map edges, and clears on release', () => {
    const s = game();
    for (let y = 0; y <= s.h; y++) for (let x = 0; x <= s.w; x++) s.height[y * (s.w + 1) + x] = x < 20 ? -1 : x / 10;
    const guides = new RangeGuides();
    const g = { x: 20, y: 20, reach: 5, minimum: 3 };
    guides.update(s, [g], () => true);
    const full = guides.mesh.geometry.drawRange.count;
    const positions = guides.mesh.geometry.getAttribute('position');
    for (let i = 0; i < full; i++) {
      const x = positions.getX(i); const y = positions.getZ(i);
      expect(positions.getY(i)).toBeCloseTo(Math.max(WATER_Y, heightAt(s, x, y)) + 0.08, 4);
    }
    const before = serialize(s);
    guides.update(s, [g], (x) => x >= 20);
    expect(guides.mesh.geometry.drawRange.count).toBeLessThan(full);
    expect(guides.mesh.geometry.drawRange.count).toBeGreaterThan(0);
    for (let i = 0; i < guides.mesh.geometry.drawRange.count; i++) expect(positions.getX(i)).toBeGreaterThanOrEqual(20);
    guides.update(s, [{ ...g, x: 1, y: 1 }], () => true);
    for (let i = 0; i < guides.mesh.geometry.drawRange.count; i++) {
      expect(positions.getX(i)).toBeGreaterThanOrEqual(0);
      expect(positions.getZ(i)).toBeGreaterThanOrEqual(0);
    }
    guides.update(s, [g], () => false);
    expect(guides.mesh.geometry.drawRange.count).toBe(0);
    guides.update(s, [], () => true);
    expect(guides.mesh.geometry.drawRange.count).toBe(0);
    expect(serialize(s)).toBe(before);
  });

  it('draws siege dead zones as dashes and bounds large selections with reusable geometry', () => {
    const s = game(); const guides = new RangeGuides();
    const g = { x: 20, y: 20, reach: 5, minimum: 0 };
    guides.update(s, [g], () => true);
    const outer = guides.mesh.geometry.drawRange.count;
    guides.update(s, [{ ...g, minimum: 3 }], () => true);
    expect(guides.mesh.geometry.drawRange.count).toBe(outer * 1.5);
    const geometry = guides.mesh.geometry;
    guides.update(s, Array.from({ length: 400 }, () => ({ ...g, minimum: 3 })), () => true);
    expect(guides.mesh.geometry.drawRange.count).toBe(outer * 1.5 * MAX_RANGE_GUIDES);
    expect(guides.mesh.geometry).toBe(geometry);
  });
});

describe('coil fields (Age of Lightning)', () => {
  it('shows each finished own tower\'s field only in the Age of Lightning', async () => {
    const { coilFields, placementField } = await import('../src/render/rangeGuides');
    const { LIGHTNING } = await import('../src/sim/data');
    const s = game();
    placeBuilding(s, 0, 'tower', 20, 20, true);
    placeBuilding(s, 0, 'tower', 30, 20, false);
    placeBuilding(s, 1, 'tower', 40, 20, true);
    expect(coilFields(s, 0)).toEqual([]);
    expect(placementField(s, 0, 'tower', 10, 10)).toBeNull();
    restat(s, s.players[0], () => { s.players[0].epoch = 4; s.players[0].age = 'lightning'; });
    const f = coilFields(s, 0);
    expect(f).toHaveLength(1);
    expect(f[0].reach).toBe(LIGHTNING.reach);
    expect(placementField(s, 0, 'tower', 10, 10)!.field).toBe(true);
    expect(placementField(s, 0, 'house', 10, 10)).toBeNull();
  });
});
