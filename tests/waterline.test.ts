import { describe, expect, it } from 'vitest';
import { wallLine } from '../src/sim/commands';
import { AGES, AI_DYKE, AI_RIVERS, INUND, POLDER, ROADS, ROUTES, secs, unitStats } from '../src/sim/data';
import { buildBarred, leadsOn } from '../src/sim/ages';
import { checksum, createGame, step } from '../src/sim/game';
import { BARGE, NAVAL, placeProblem, walkable } from '../src/sim/grid';
import { findPath } from '../src/sim/path';
import { serialize, deserialize } from '../src/sim/save';
import { basinOf, channelPlan, dig, drowned, dykePlan, fieldBoost, floodFront, isInund, isPolder, lets, wading, waterLine, type DykePlan } from '../src/sim/water';
import type { Building, GameState } from '../src/sim/types';
import { T_GRASS, T_WATER } from '../src/sim/types';
import { goalForPoint, placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The Age of the Water Line (#701 s4): sluices that let the water out over your own low ground on purpose, and gun-barges that sail it. */

const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec) && !s.over; i++) step(s);
};

function millSpot(s: GameState, o: number, basin: number[]): { tx: number; ty: number } | null {
  const first = basin[0];
  const bx = first % s.w;
  const by = Math.floor(first / s.w);
  for (let r = 1; r < 12; r++)
    for (let ty = by - r; ty <= by + r; ty++)
      for (let tx = bx - r; tx <= bx + r; tx++) {
        if (placeProblem(s, 'windmill', tx, ty, true, o)) continue;
        if (basinOf(s, { tx, ty, size: 2 }).includes(first)) return { tx, ty };
      }
  return null;
}

/** A people with a bay dyked off and pumped dry, then come into the Age of the Water Line with a sluice in place of a dyke of the line. */
function polderTown(): { s: GameState; o: number; plan: DykePlan; sluice: Building } {
  for (let seed = 1; seed < 30; seed++) {
    const s = createGame({ seed, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }, { name: 'C', ai: null }] });
    for (const p of s.players) {
      const plan = dykePlan(s, p.startX, p.startY, AI_DYKE.reach, AI_DYKE, wallLine);
      if (!plan || plan.line.length < 2) continue;
      s.peaceUntil = 1e9;
      s.animals = [];
      restat(s, p, () => {
        p.epoch = AGES.dykes.tier;
        p.age = 'dykes';
      });
      p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
      for (const t of plan.line) placeBuilding(s, p.id, 'dyke', t % s.w, Math.floor(t / s.w), true);
      const spot = millSpot(s, p.id, plan.basin);
      if (!spot) continue;
      placeBuilding(s, p.id, 'windmill', spot.tx, spot.ty, true);
      run(s, POLDER.every * (plan.basin.length + 3));
      if (!plan.basin.every((t) => isPolder(s, t))) continue;
      restat(s, p, () => {
        p.epoch = AGES.waterline.tier;
        p.age = 'waterline';
        p.walked = [...(p.walked ?? []), 'dykes', 'waterline'];
      });
      // A citizen sets the sluice in the line, in place of its middle dyke.
      const mid = plan.line[plan.line.length >> 1];
      const c = spawnUnit(s, p.id, 'citizen', plan.from.x + 0.5, plan.from.y + 0.5);
      step(s, [{ t: 'build', p: p.id, ids: [c.id], type: 'sluice', tx: mid % s.w, ty: Math.floor(mid / s.w) }]);
      const sluice = s.byId.get(s.bldAt[mid]) as Building;
      if (!sluice || sluice.type !== 'sluice') continue;
      return { s, o: p.id, plan, sluice };
    }
  }
  throw new Error('no such map');
}

const underWater = (s: GameState, plan: DykePlan) => plan.basin.filter((t) => isInund(s, t)).length;

describe('the Age of the Water Line in the data (#701 s4)', () => {
  it('is the Water Road instead of the Gunpowder Age, with crossings to and from it', () => {
    expect(AGES.waterline.tier).toBe(3);
    expect(AGES.waterline.routes).toEqual(['water']);
    expect(ROUTES.water).toBeDefined();
    expect(leadsOn('dykes').map((r) => r.to)).toEqual(expect.arrayContaining(['waterline', 'gunpowder']));
    expect(ROADS.some((r) => r.from === 'gunpowder' && r.to === 'waterline' && r.walked === 'dykes')).toBe(true);
    expect(ROADS.filter((r) => r.from === 'waterline').map((r) => r.to).sort()).toEqual(['gunpowder', 'industrial']);
    expect(AGES.waterline.keepsake!.building).toBe('sluice');
  });

  it('opens the Sluice, and shuts stone walls and gates', () => {
    const s = createGame({ seed: 3, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    const p = s.players[0];
    expect(buildBarred(p, 'sluice')).toMatch(/Water Line/);
    restat(s, p, () => {
      p.epoch = 3;
      p.age = 'waterline';
    });
    expect(buildBarred(p, 'sluice')).toBeNull();
    expect(buildBarred(p, 'wall')).toMatch(/water is its wall/);
    expect(unitStats('barge', 3)!.name).toBe('Gun-barge');
  });
});

describe('sluices (#701 s4)', () => {
  it('a sluice set in a dyke line holds the sea back, built or not', () => {
    const { s, plan } = polderTown();
    expect(floodFront(s)).toEqual([]);
    run(s, 3);
    expect(plan.basin.every((t) => isPolder(s, t) && s.terrain[t] === T_GRASS)).toBe(true);
  });

  it('opened, it lets the water over the polder a ring a second, waded and not walked dry, and shut, the water goes again', () => {
    const { s, o, plan, sluice } = polderTown();
    // Finish it the way builders do.
    sluice.progress = 0.999;
    for (let i = 0; i < secs(60) && !sluice.built; i++) step(s);
    expect(sluice.built).toBe(true);
    step(s, [{ t: 'pack', p: o, building: sluice.id }]);
    expect(sluice.open).toBe(true);
    expect(lets(s, sluice)).toBe(true);
    const reach = waterLine(s, sluice);
    expect(reach.length).toBeGreaterThan(0);
    run(s, INUND.every + 0.05);
    const first = underWater(s, plan);
    expect(first).toBeGreaterThan(0);
    run(s, INUND.every * (INUND.reach + 1));
    const full = plan.basin.filter((t) => reach.includes(t));
    expect(full.length).toBeGreaterThan(3);
    expect(full.every((t) => isInund(s, t) && s.terrain[t] === T_WATER)).toBe(true);
    // Never the sea's flood: the polder is still polder, under a sluice's water.
    expect(floodFront(s)).toEqual([]);
    const t = full[0];
    const x = (t % s.w) + 0.5;
    const y = Math.floor(t / s.w) + 0.5;
    expect(walkable(s, t % s.w, Math.floor(t / s.w), s.players[o].team)).toBe(true);
    expect(wading(s, x, y)).toBe(INUND.wade);
    expect(wading(s, x, y, true)).toBe(INUND.siege);
    // A gun-barge sails it; a galleon does not.
    expect(walkable(s, t % s.w, Math.floor(t / s.w), BARGE)).toBe(true);
    expect(walkable(s, t % s.w, Math.floor(t / s.w), NAVAL)).toBe(false);
    // Shut it: the water drains back to polder from its edges in.
    step(s, [{ t: 'pack', p: o, building: sluice.id }]);
    expect(sluice.open).toBeFalsy();
    run(s, INUND.every * (INUND.reach * 2 + 4));
    expect(underWater(s, plan)).toBe(0);
    expect(plan.basin.every((b) => isPolder(s, b) && s.terrain[b] === T_GRASS)).toBe(true);
  });

  it('a field under the flood yields nothing until the water goes', () => {
    const { s, o, plan, sluice } = polderTown();
    sluice.progress = 0.999;
    for (let i = 0; i < secs(60) && !sluice.built; i++) step(s);
    const reach = new Set(waterLine(s, sluice));
    let farm: Building | null = null;
    for (const t of plan.basin) {
      const tx = t % s.w;
      const ty = Math.floor(t / s.w);
      if (placeProblem(s, 'farm', tx, ty, true, o)) continue;
      const fp = [t, t + 1, t + s.w, t + s.w + 1];
      if (!fp.every((f) => reach.has(f))) continue;
      farm = placeBuilding(s, o, 'farm', tx, ty, true);
      break;
    }
    expect(farm).not.toBeNull();
    expect(fieldBoost(s, farm!)).toBeGreaterThan(0);
    step(s, [{ t: 'pack', p: o, building: sluice.id }]);
    run(s, INUND.every * (INUND.reach + 2));
    expect(drowned(s, farm!)).toBe(true);
    expect(fieldBoost(s, farm!)).toBe(0);
    expect(farm!.hp).toBeGreaterThan(0);
  });

  it('only a people in the age (or keeping its sluice) opens one; a gun-barge is launched from it onto the flood', () => {
    const { s, o, sluice } = polderTown();
    sluice.progress = 0.999;
    for (let i = 0; i < secs(60) && !sluice.built; i++) step(s);
    step(s, [{ t: 'pack', p: o, building: sluice.id }]);
    run(s, INUND.every * (INUND.reach + 2));
    // A barge finds its way from the sluice over the flood.
    const reach = waterLine(s, sluice);
    const far = reach[reach.length - 1];
    const barge = spawnUnit(s, o, 'barge', sluice.x, sluice.y);
    const path = findPath(s, barge.x, barge.y, goalForPoint(s, (far % s.w) + 0.5, Math.floor(far / s.w) + 0.5, BARGE), 8000, BARGE);
    expect(path.complete).toBe(true);
    // Another people's order does nothing.
    const other = s.players.find((p) => p.id !== o)!;
    step(s, [{ t: 'pack', p: other.id, building: sluice.id }]);
    expect(sluice.open).toBe(true);
  });

  it('the flood is deterministic, and survives a save', () => {
    const a = polderTown();
    const b = polderTown();
    for (const x of [a, b]) {
      x.sluice.progress = 0.999;
      for (let i = 0; i < secs(60) && !x.sluice.built; i++) step(x.s);
      step(x.s, [{ t: 'pack', p: x.o, building: x.sluice.id }]);
      run(x.s, 3.3);
    }
    expect(checksum(a.s)).toBe(checksum(b.s));
    const back = deserialize(serialize(a.s));
    expect(Array.from(back.inund!)).toEqual(Array.from(a.s.inund!));
    run(a.s, 2);
    run(back, 2);
    expect(checksum(back)).toBe(checksum(a.s));
  });
});

describe('the Water Line on a dry map (#701 s4)', () => {
  it('a sluice on a channel dug through the meadow floods the meadow round it, and a barge stranded by the ebb is lost', () => {
    const s = createGame({ seed: 2, size: 'medium', mapType: 'continental', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    restat(s, p, () => {
      p.epoch = 3;
      p.age = 'waterline';
    });
    const plan = channelPlan(s, p.startX, p.startY, AI_RIVERS, wallLine, (x, y) => !placeProblem(s, 'channel', x, y));
    expect(plan).not.toBeNull();
    for (const t of plan!.tiles) dig(s, t, 0);
    const at = plan!.tiles.reduce((a, t) => (waterLine(s, { tx: t % s.w, ty: Math.floor(t / s.w) }).length > waterLine(s, { tx: a % s.w, ty: Math.floor(a / s.w) }).length ? t : a));
    expect(placeProblem(s, 'sluice', at % s.w, Math.floor(at / s.w), true, 0)).toBeNull();
    const sluice = placeBuilding(s, 0, 'sluice', at % s.w, Math.floor(at / s.w), true);
    const reach = waterLine(s, sluice);
    expect(reach.length).toBeGreaterThan(20);
    step(s, [{ t: 'pack', p: 0, building: sluice.id }]);
    run(s, INUND.every * (INUND.reach + 1));
    expect(reach.every((t) => isInund(s, t))).toBe(true);
    // A barge left out on the flood's far edge, and the sluice shut: the water goes, and the barge with it.
    const far = reach[reach.length - 1];
    const barge = spawnUnit(s, 0, 'barge', (far % s.w) + 0.5, Math.floor(far / s.w) + 0.5);
    step(s, [{ t: 'pack', p: 0, building: sluice.id }]);
    run(s, INUND.every * (INUND.reach * 2 + 4));
    expect(reach.some((t) => isInund(s, t))).toBe(false);
    expect(barge.hp).toBe(0);
  });

  it('siege bogs down in the flood: a tenth of its pace', () => {
    const s = createGame({ seed: 2, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    const t = Math.floor(s.players[0].startY + 4) * s.w + Math.floor(s.players[0].startX + 4);
    s.inund = new Uint8Array(s.w * s.h);
    s.inund[t] = s.terrain[t] + 1;
    s.terrain[t] = T_WATER;
    const x = (t % s.w) + 0.5;
    const y = Math.floor(t / s.w) + 0.5;
    expect(wading(s, x, y, true)).toBe(INUND.siege);
    expect(wading(s, x, y)).toBe(INUND.wade);
  });
});
