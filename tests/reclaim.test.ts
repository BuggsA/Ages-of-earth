import { describe, expect, it } from 'vitest';
import { RECLAIM, secs } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { createGame, step } from '../src/sim/game';
import { placeBuilding } from '../src/sim/world';
import { buildingCostFor } from '../src/sim/stats';
import { foundationAt, raiseCost } from '../src/sim/reclaim';
import { findSpot } from '../src/sim/ai';

/** Foundations (#356 audit): the Age of Reclaimers rebuilds on what fell, cheaper and half built. */
function reclaimer() {
  const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  const p = s.players[0];
  p.epoch = 3;
  p.age = 'reclaimer';
  p.res.food = p.res.wood = p.res.stone = p.res.gold = 5000;
  return s;
}
function spotFor(s: ReturnType<typeof createGame>) {
  const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
  const spot = findSpot(s, 'barracks', tc.x, tc.y, 4, 14);
  expect(spot).toBeTruthy();
  return spot!;
}

describe('Foundations', () => {
  it('remember where a reclaimer\'s building fell, and cost less to raise there', () => {
    const s = reclaimer();
    const { tx, ty } = spotFor(s);
    const b = placeBuilding(s, 0, 'barracks', tx, ty, true);
    b.hp = 0;
    step(s, []);
    expect(foundationAt(s, 0, 'barracks', tx, ty)).toBeGreaterThanOrEqual(0);
    const full = buildingCostFor(s, 0, 'barracks');
    const cheap = raiseCost(s, 0, 'barracks', tx, ty);
    for (const r of ['food', 'wood', 'stone', 'gold'] as const) if (full[r]) expect(cheap[r]).toBe(Math.ceil(full[r]! * RECLAIM.cost));
    expect(s.events.some((e) => e.k === 'foundation' && e.what === 'kept')).toBe(true);
  });

  it('give a raised site its head start and are used up once', () => {
    const s = reclaimer();
    const { tx, ty } = spotFor(s);
    placeBuilding(s, 0, 'barracks', tx, ty, true).hp = 0;
    step(s, []);
    const wood = s.players[0].res.wood;
    const ids = s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen').map((e) => e.id).slice(0, 2);
    applyCommand(s, { t: 'build', p: 0, ids, type: 'barracks', tx, ty });
    const site = s.ents.find((e) => e.kind === 'building' && e.type === 'barracks' && !e.built)!;
    expect(site.kind === 'building' && site.progress).toBe(RECLAIM.head);
    expect(s.players[0].res.wood).toBe(wood - Math.ceil(buildingCostFor(s, 0, 'barracks').wood! * RECLAIM.cost));
    expect(foundationAt(s, 0, 'barracks', tx, ty)).toBe(-1);
  });

  it('are forgotten after the window, and never kept by other peoples or for walls', () => {
    const s = reclaimer();
    const { tx, ty } = spotFor(s);
    placeBuilding(s, 0, 'barracks', tx, ty, true).hp = 0;
    step(s, []);
    s.tick += secs(RECLAIM.window) + 20;
    for (let i = 0; i < 20; i++) step(s, []);
    expect(s.fallen).toBeUndefined();
    const t = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    t.players[0].epoch = 3;
    const q = spotFor(t);
    placeBuilding(t, 0, 'barracks', q.tx, q.ty, true).hp = 0;
    step(t, []);
    expect(t.fallen).toBeUndefined();
  });
});
