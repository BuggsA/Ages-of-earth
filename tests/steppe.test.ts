import { describe, expect, it } from 'vitest';
import { ageOf, buildBarred, roadKnown, roadProblem } from '../src/sim/ages';
import { landOwnerAt } from '../src/sim/borders';
import { BUILDINGS, ROADS, STEPPE, UNITS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { pitchSpot } from '../src/sim/steppe';
import { trainCostFor, trainTimeFor } from '../src/sim/stats';
import { maxHp, placeBuilding, restat, spawnUnit } from '../src/sim/world';
import type { Building, GameState, Unit } from '../src/sim/types';

/** The Age of the Steppe (#297): a town on wheels. */

const game = () => createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const tc = (s: GameState, owner = 0) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const wagons = (s: GameState) => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'wagon');
const road = ROADS.find((r) => r.to === 'steppe')!;
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const rich = (s: GameState) => { s.players[0].res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 }; };
/** Puts player 0 on the steppe directly. */
const nomads = (s: GameState) => restat(s, s.players[0], () => { s.players[0].age = 'steppe'; s.players[0].epoch = 1; });
const refusals = (s: GameState) => s.events.filter((e) => e.k === 'refused').map((e) => (e.k === 'refused' ? e.why : ''));

describe('the Age of the Steppe (#297)', () => {
  it('is shown by a finished Hunting Camp and opens once the hunters have butchered 400 meat', () => {
    const s = game(); const p = s.players[0]; rich(s);
    expect(roadKnown(s, p, road)).toBe(false);
    placeBuilding(s, 0, 'huntcamp', p.startX + 8, p.startY + 6, true);
    expect(roadKnown(s, p, road)).toBe(true);
    expect(roadProblem(s, p, road)).toContain('(0/400)');
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'steppe' }]);
    expect(tc(s).advance).toBe(-1);
    p.stats.hunted = 400;
    expect(roadProblem(s, p, road)).toBeNull();
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'steppe' }]);
    run(s, road.time + 1);
    expect(ageOf(p)).toBe('steppe');
    expect(p.epoch).toBe(1);
  });

  it('counts meat butchered by hunters toward the deed', () => {
    const s = game(); const p = s.players[0];
    const deer = s.animals.filter((a) => a.kind === 'deer').sort((a, b) => Math.hypot(a.x - p.startX, a.y - p.startY) - Math.hypot(b.x - p.startX, b.y - p.startY))[0];
    expect(deer).toBeTruthy();
    const hunters = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen').slice(0, 3);
    step(s, [{ t: 'hunt', p: 0, ids: hunters.map((u) => u.id), target: deer.id }]);
    run(s, 60);
    expect(p.stats.hunted ?? 0).toBeGreaterThan(0);
  });

  it('raises no Farms, Walls or Gates, and its riders come cheaper and quicker', () => {
    const s = game(); const p = s.players[0]; rich(s);
    restat(s, p, () => { p.epoch = 1; p.age = 'bronze'; });
    const bronze = { cost: trainCostFor(s, 0, 'cavalry', 'stable'), time: trainTimeFor(s, 0, 'cavalry', 'stable') };
    nomads(s);
    const steppe = { cost: trainCostFor(s, 0, 'cavalry', 'stable'), time: trainTimeFor(s, 0, 'cavalry', 'stable') };
    expect(steppe.cost.food!).toBeLessThan(bronze.cost.food!);
    expect(steppe.cost.gold!).toBeLessThan(bronze.cost.gold!);
    expect(steppe.time).toBeLessThan(bronze.time);
    const ids = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen').map((u) => u.id);
    const before = s.ents.length;
    step(s, [{ t: 'build', p: 0, ids, type: 'farm', tx: p.startX + 7, ty: p.startY - 8 }]);
    expect(s.ents.length).toBe(before);
    expect(refusals(s).some((w) => w.includes('tills no fields'))).toBe(true);
    step(s, [{ t: 'wall', p: 0, ids, x0: p.startX + 7, y0: p.startY + 9, x1: p.startX + 10, y1: p.startY + 9 }]);
    expect(s.ents.some((e) => e.kind === 'building' && e.type === 'wall')).toBe(false);
    // Houses, camps and the rest still go up.
    expect(buildBarred(p, 'house')).toBeNull();
    expect(buildBarred(p, 'huntcamp')).toBeNull();
    expect(buildBarred(p, 'gate')).toBeTruthy();
  });

  it('packs a Town Center onto a wagon, sheltering people stepping out; only on the steppe and only when idle', () => {
    const s = game(); rich(s);
    const t = tc(s);
    step(s, [{ t: 'pack', p: 0, building: t.id }]);
    expect(s.byId.has(t.id)).toBe(true);
    expect(refusals(s)).toContain('Only a steppe people strikes camp');
    nomads(s);
    step(s, [{ t: 'train', p: 0, building: t.id, unit: 'citizen' }]);
    step(s, [{ t: 'pack', p: 0, building: t.id }]);
    expect(s.byId.has(t.id)).toBe(true);
    step(s, [{ t: 'cancel', p: 0, building: t.id, index: 0 }]);
    // Ring the bell so citizens shelter inside, then pack: they come out.
    step(s, [{ t: 'bell', p: 0, ring: true }]);
    run(s, 8);
    expect(t.garrison.length).toBeGreaterThan(0);
    t.hp = maxHp(s, t) / 2;
    step(s, [{ t: 'pack', p: 0, building: t.id }]);
    expect(s.byId.has(t.id)).toBe(false);
    expect(s.ents.some((e) => e.kind === 'unit' && e.inside === t.id)).toBe(false);
    const [w] = wagons(s);
    expect(w.packed).toBe('towncenter');
    expect(w.packedHp).toBeCloseTo(0.5, 5);
    expect(w.hp).toBe(UNITS.wagon[1]!.hp);
    // The land went with it.
    expect(landOwnerAt(s, Math.floor(t.x), Math.floor(t.y))).toBe(-1);
  });

  it('drives, then pitches where it stands: the building raises itself with the health it was packed with, and its land comes back', () => {
    const s = game(); const p = s.players[0]; rich(s); nomads(s);
    const t = tc(s);
    t.hp = maxHp(s, t) * 0.75;
    step(s, [{ t: 'pack', p: 0, building: t.id }]);
    const [w] = wagons(s);
    const to = { x: t.x + (s.players[1].startX > p.startX ? 10 : -10), y: t.y };
    step(s, [{ t: 'move', p: 0, ids: [w.id], x: to.x, y: to.y }]);
    run(s, 20);
    expect(Math.hypot(w.x - t.x, w.y - t.y)).toBeGreaterThan(6);
    const spot = pitchSpot(s, w)!;
    expect(spot).toBeTruthy();
    step(s, [{ t: 'pitch', p: 0, ids: [w.id] }]);
    expect(s.byId.has(w.id)).toBe(false);
    const b = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    expect(b.tx).toBe(spot.tx); expect(b.ty).toBe(spot.ty);
    expect(b.built).toBe(false); expect(b.pitch).toBeCloseTo(0.75, 5);
    run(s, STEPPE.pitch + 1);
    expect(b.built).toBe(true); expect(b.pitch).toBeUndefined();
    expect(b.hp / maxHp(s, b)).toBeCloseTo(0.75, 1);
    expect(landOwnerAt(s, Math.floor(b.x), Math.floor(b.y))).toBe(0);
    // A pitched camp works: it trains a citizen.
    const before = s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen').length;
    step(s, [{ t: 'train', p: 0, building: b.id, unit: 'citizen' }]);
    run(s, 15);
    expect(s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen').length).toBe(before + 1);
  });

  it('will not pitch in a rival\'s land, and a freshly pitched camp torn down refunds nothing', () => {
    const s = game(); const p = s.players[0]; rich(s); nomads(s);
    step(s, [{ t: 'pack', p: 0, building: tc(s).id }]);
    const [w] = wagons(s);
    const rival = tc(s, 1);
    w.x = rival.x + 6; w.y = rival.y + 6; w.px = w.x; w.py = w.y;
    expect(pitchSpot(s, w)).toBeNull();
    step(s, [{ t: 'pitch', p: 0, ids: [w.id] }]);
    expect(s.byId.has(w.id)).toBe(true);
    expect(refusals(s).some((r) => r.includes('rival'))).toBe(true);
    // Back home, pitch, and tear it straight down: no Town Center's worth of wood and stone appears.
    w.x = p.startX + 0.5; w.y = p.startY + 0.5; w.px = w.x; w.py = w.y;
    step(s, [{ t: 'pitch', p: 0, ids: [w.id] }]);
    const b = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    const wood = p.res.wood;
    step(s, [{ t: 'delete', p: 0, ids: [b.id] }]);
    expect(p.res.wood).toBe(wood);
  });

  it('a packed House gives no room until pitched again', () => {
    const s = game(); const p = s.players[0]; rich(s); nomads(s);
    const h = placeBuilding(s, 0, 'house', p.startX + 7, p.startY + 7, true);
    step(s);
    const cap = p.cap;
    const pop = p.pop;
    step(s, [{ t: 'pack', p: 0, building: h.id }]);
    step(s);
    expect(p.cap).toBe(cap - BUILDINGS.house.pop);
    // The wagon itself takes no room.
    expect(p.pop).toBe(pop);
    const [w] = wagons(s);
    step(s, [{ t: 'pitch', p: 0, ids: [w.id] }]);
    run(s, STEPPE.pitch + 1);
    expect(p.cap).toBe(cap);
  });

  it('wagons and a camp going up survive a save, and pitch the same after it', () => {
    const s = game(); rich(s); nomads(s);
    step(s, [{ t: 'pack', p: 0, building: tc(s).id }]);
    const copy = deserialize(serialize(s));
    const [a] = wagons(s);
    const [b] = wagons(copy);
    expect(b.packed).toBe('towncenter');
    step(s, [{ t: 'pitch', p: 0, ids: [a.id] }]);
    step(copy, [{ t: 'pitch', p: 0, ids: [b.id] }]);
    run(s, 3); run(copy, 3);
    const mid = deserialize(serialize(copy));
    run(s, STEPPE.pitch); run(copy, STEPPE.pitch); run(mid, STEPPE.pitch);
    expect(serialize(copy)).toBe(serialize(s));
    expect(serialize(mid)).toBe(serialize(s));
  });

  it('wagons are cavalry\'s easy prey', () => {
    const s = game(); nomads(s);
    const w = spawnUnit(s, 0, 'wagon', s.players[0].startX + 5, s.players[0].startY + 5);
    expect(UNITS.wagon[1]!.cls).toBe('trader');
    expect(w.hp).toBeGreaterThan(0);
  });
});
