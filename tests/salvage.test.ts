import { describe, expect, it } from 'vitest';
import { SALVAGE, secs } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { createGame, step } from '../src/sim/game';
import { placeBuilding } from '../src/sim/world';
import { buildingCostFor } from '../src/sim/stats';
import { foundationAt } from '../src/sim/reclaim';
import { findSpot } from '../src/sim/ai';

/** Salvage (#503): the Age of Reclaimers strips the rubble of fallen buildings into stock. */
function game(age: 'reclaimer' | null = 'reclaimer') {
  const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  const p = s.players[0];
  if (age) {
    p.epoch = 3;
    p.age = age;
  }
  p.res.food = p.res.wood = p.res.stone = p.res.gold = 5000;
  return s;
}
function fell(s: ReturnType<typeof game>, owner: number, at = owner) {
  const tc = s.ents.find((e) => e.kind === 'building' && e.owner === at && e.type === 'towncenter')!;
  const spot = findSpot(s, 'barracks', tc.x, tc.y, 4, 14)!;
  const b = placeBuilding(s, owner, 'barracks', spot.tx, spot.ty, true);
  b.hp = 0;
  step(s, []);
  return { spot, rubble: s.rubble![0] };
}
const citizens = (s: ReturnType<typeof game>) => s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen').slice(0, 2).map((e) => e.id);

describe('Salvage', () => {
  it('leaves rubble worth half the price when a building falls', () => {
    const s = game();
    const full = buildingCostFor(s, 1, 'barracks');
    const { rubble } = fell(s, 1);
    for (const r of ['food', 'wood', 'stone', 'gold'] as const) expect(rubble.worth[r] ?? 0).toBe(Math.floor((full[r] ?? 0) * SALVAGE.share));
  });

  it('leaves none when no people in the match salvages', () => {
    const s = game(null);
    const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter')!;
    const spot = findSpot(s, 'barracks', tc.x, tc.y, 4, 14)!;
    placeBuilding(s, 1, 'barracks', spot.tx, spot.ty, true).hp = 0;
    step(s, []);
    expect(s.rubble).toBeUndefined();
  });

  it('pays a rival\'s rubble into stock once citizens have stripped it, and clears it', () => {
    const s = game();
    const { rubble } = fell(s, 1, 0);
    const id = rubble.id;
    const before = { ...s.players[0].res };
    const ids = citizens(s);
    for (const u of ids) { const e = s.byId.get(u)!; e.x = rubble.x; e.y = rubble.y; }
    applyCommand(s, { t: 'salvage', p: 0, ids, target: id });
    for (let i = 0; i < secs(SALVAGE.work) * 3 && s.rubble?.some((r) => r.id === id); i++) step(s, []);
    expect(s.rubble?.some((r) => r.id === id)).toBeFalsy();
    for (const r of ['wood', 'stone'] as const) if (rubble.worth[r]) expect(s.players[0].res[r]).toBeGreaterThan(before[r]);
  });

  it('uses up the foundations when you strip your own rubble', () => {
    const s = game();
    const { spot, rubble } = fell(s, 0);
    expect(foundationAt(s, 0, 'barracks', spot.tx, spot.ty)).toBeGreaterThanOrEqual(0);
    const ids = citizens(s);
    for (const u of ids) { const e = s.byId.get(u)!; e.x = rubble.x; e.y = rubble.y; }
    applyCommand(s, { t: 'salvage', p: 0, ids, target: rubble.id });
    for (let i = 0; i < secs(SALVAGE.work) * 3; i++) step(s, []);
    expect(foundationAt(s, 0, 'barracks', spot.tx, spot.ty)).toBe(-1);
  });

  it('refuses a people that is not a reclaimer', () => {
    const s = game();
    const { rubble } = fell(s, 1);
    s.players[0].age = undefined;
    s.players[0].epoch = 2;
    applyCommand(s, { t: 'salvage', p: 0, ids: citizens(s), target: rubble.id });
    expect(s.ents.some((e) => e.kind === 'unit' && e.order.k === 'salvage')).toBe(false);
  });

  it('is cleared away after its window', () => {
    const s = game();
    fell(s, 1);
    for (let i = 0; i < secs(SALVAGE.window) + 40; i++) step(s, []);
    expect(s.rubble).toBeUndefined();
  });
});

describe('The computer', () => {
  it('sends citizens to strip rubble near home', () => {
    const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    const p = s.players[0];
    p.epoch = 3;
    p.age = 'reclaimer';
    const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    const spot = findSpot(s, 'barracks', tc.x, tc.y, 4, 14)!;
    placeBuilding(s, 1, 'barracks', spot.tx, spot.ty, true).hp = 0;
    let sent = false;
    for (let i = 0; i < secs(120) && !sent; i++) {
      step(s, []);
      sent = s.ents.some((e) => e.kind === 'unit' && e.owner === 0 && e.order.k === 'salvage');
      if (i === 0 && !s.rubble) throw new Error('no rubble left');
    }
    expect(sent || !s.rubble, 'the computer ignored the rubble').toBe(true);
  });
});
