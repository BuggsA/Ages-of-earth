import { describe, expect, it } from 'vitest';
import { BUILDINGS, SHAFT, STRATA, secs } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { createGame, step } from '../src/sim/game';
import { clearResource, placeProblem } from '../src/sim/grid';
import { findSpot } from '../src/sim/ai';
import { deserialize, serialize } from '../src/sim/save';
import { crewOf, depthOf, digShare, roomLeft, seamsAt, shaftShare, spentAt, veinLeft } from '../src/sim/shafts';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import { R_GOLD, R_STONE, T_ROCK } from '../src/sim/types';
import type { Building, GameState, MapType, Unit } from '../src/sim/types';

/** The deep mine (#924 m1): a Mine Shaft sunk through layers of finite veins, never worse than the plain shaft. */

const game = (seed = 3, mapType: MapType = 'continental'): GameState => {
  const s = createGame({ seed, size: 'small', mapType, players: [{ name: 'A', ai: null, civ: 'greeks' }, { name: 'B', ai: null }] });
  const p = s.players[0];
  p.age = 'bronze';
  p.epoch = 1;
  p.res.wood = 5000;
  return s;
};

/** A free 2×2 site by player 0's start, away from rock and deposits, so its ground is plain earth. */
function site(s: GameState): { tx: number; ty: number } {
  const p = s.players[0];
  const clear = (tx: number, ty: number) => {
    for (let y = ty - SHAFT.near; y < ty + 2 + SHAFT.near; y++)
      for (let x = tx - SHAFT.near; x < tx + 2 + SHAFT.near; x++) {
        const i = y * s.w + x;
        if (x < 0 || y < 0 || x >= s.w || y >= s.h || s.terrain[i] === T_ROCK || s.res[i] === R_STONE || s.res[i] === R_GOLD) return false;
      }
    return true;
  };
  const spot = findSpot(s, 'shaft', p.startX, p.startY, 6, 30, 1, (tx, ty) => clear(tx, ty) && !placeProblem(s, 'storehouse', tx + 3, ty, true, 0));
  if (!spot) throw new Error('no site');
  return spot;
}

/** A finished shaft with a Storehouse beside it, set to `seam`, and `n` citizens working it. */
function mine(s: GameState, n: number, seam: 'stone' | 'gold' = 'stone'): { b: Building; us: Unit[] } {
  const at = site(s);
  const b = placeBuilding(s, 0, 'shaft', at.tx, at.ty, true);
  placeBuilding(s, 0, 'storehouse', at.tx + 3, at.ty, true);
  b.seam = seam;
  const us: Unit[] = [];
  for (let i = 0; i < n; i++) us.push(spawnUnit(s, 0, 'citizen', at.tx - 0.6, at.ty + 0.5 + i * 0.3));
  for (const u of us) applyCommand(s, { t: 'work', p: 0, ids: [u.id], target: b.id });
  return { b, us };
}

const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec); i++) step(s);
};

describe('the deep mine (#924 m1)', () => {
  it('lays out three layers of stone and gold, richer and roomier the deeper', () => {
    expect(STRATA.length).toBeGreaterThanOrEqual(3);
    for (let l = 0; l < 3; l++) {
      expect(STRATA[l].add).toBeGreaterThan(0);
      if (l > 0) {
        expect(STRATA[l].add).toBeGreaterThan(STRATA[l - 1].add);
        expect(STRATA[l].room).toBeGreaterThanOrEqual(STRATA[l - 1].room);
        expect(STRATA[l].sink.wood ?? 0).toBeGreaterThan(0);
        expect(STRATA[l].time).toBeGreaterThan(0);
      }
    }
    // Between them, the first three layers hold both stone and gold.
    expect(STRATA.slice(0, 3).some((l) => (l.veins.stone ?? 0) > 0)).toBe(true);
    expect(STRATA.slice(0, 3).some((l) => (l.veins.gold ?? 0) > 0)).toBe(true);
    expect(BUILDINGS.shaft.blurb).toMatch(/deeper/);
  });

  it('a vein digs faster than the plain grade, runs out, and the shaft then digs at the plain grade (never worse than before)', () => {
    const s = game();
    const { b } = mine(s, 2);
    const floor = shaftShare(s, b, 'stone');
    expect(floor).toBe(SHAFT.grade.open);
    expect(digShare(s, b, 'stone', 0)).toBeCloseTo(SHAFT.grade.open + STRATA[0].add);
    const stone0 = s.players[0].res.stone;
    run(s, 120);
    expect(veinLeft(b, 0, 'stone')).toBeLessThan(STRATA[0].veins.stone!);
    expect(s.players[0].res.stone - stone0).toBeGreaterThan(20);
    // Spend the rest of it: the pace falls back to the plain grade, and the miners still dig.
    b.worked![0].stone = STRATA[0].veins.stone!;
    expect(veinLeft(b, 0, 'stone')).toBe(0);
    expect(spentAt(b, 'stone')).toBe(true);
    expect(digShare(s, b, 'stone', 0)).toBe(floor);
    const stone1 = s.players[0].res.stone;
    run(s, 120);
    expect(s.players[0].res.stone - stone1).toBeGreaterThan(5);
    expect(b.worked![0].stone).toBe(STRATA[0].veins.stone);
  });

  it('a layer holds only so many miners; the one over its room finds no place', () => {
    const s = game();
    const { b, us } = mine(s, STRATA[0].room + 1);
    run(s, 15);
    const { at } = crewOf(s, b);
    expect(at[0]).toBe(STRATA[0].room);
    expect(roomLeft(s, b)).toBeLessThanOrEqual(0);
    expect(us.filter((u) => u.order.k === 'shaft' && u.order.target === b.id).length).toBe(STRATA[0].room);
  });

  it('sinks a layer deeper for wood and time, digging nothing meanwhile, with room for more there', () => {
    const s = game();
    const { b } = mine(s, 2);
    run(s, 10);
    const wood0 = s.players[0].res.wood;
    applyCommand(s, { t: 'deepen', p: 0, building: b.id });
    expect(s.players[0].res.wood).toBe(wood0 - (STRATA[1].sink.wood ?? 0));
    expect(b.deepening).toBeDefined();
    // A second order while it sinks is refused and costs nothing.
    applyCommand(s, { t: 'deepen', p: 0, building: b.id });
    expect(s.players[0].res.wood).toBe(wood0 - (STRATA[1].sink.wood ?? 0));
    const dug = b.worked?.[0]?.stone ?? 0;
    run(s, STRATA[1].time - 2);
    expect(depthOf(b)).toBe(0);
    expect(b.worked?.[0]?.stone ?? 0).toBe(dug);
    run(s, 4);
    expect(depthOf(b)).toBe(1);
    expect(b.deepening).toBeUndefined();
    expect(roomLeft(s, b)).toBe(STRATA[0].room + STRATA[1].room - 2);
    // The third layer waits on the Iron Age.
    applyCommand(s, { t: 'deepen', p: 0, building: b.id });
    expect(depthOf(b)).toBe(1);
    expect(b.deepening).toBeUndefined();
  });

  it('a miner whose layer is spent moves down to one whose vein still holds; a click sends one to a layer', () => {
    const s = game();
    const { b, us } = mine(s, 1, 'gold');
    b.depth = 1;
    run(s, 30);
    // The first layer holds no gold: the miner went down to Bedrock.
    const u = us[0];
    expect(u.order.k === 'shaft' && u.order.layer).toBe(1);
    // Sent up to the first layer by a click, it digs there at the plain grade.
    applyCommand(s, { t: 'toLayer', p: 0, building: b.id, layer: 0 });
    expect(u.order.k === 'shaft' && u.order.layer).toBe(0);
    // A layer it doesn't reach is refused.
    applyCommand(s, { t: 'toLayer', p: 0, building: b.id, layer: 2 });
    expect(u.order.k === 'shaft' && u.order.layer).toBe(0);
  });

  it('a shaft from an old save, with no layers of its own, loads in the first layer and digs', () => {
    const s = game();
    const { b } = mine(s, 1);
    run(s, 5);
    delete b.depth;
    delete b.worked;
    delete b.deepening;
    for (const e of s.ents) if (e.kind === 'unit' && e.order.k === 'shaft') delete e.order.layer;
    const t = deserialize(serialize(s));
    const b2 = t.byId.get(b.id) as Building;
    expect(depthOf(b2)).toBe(0);
    expect(veinLeft(b2, 0, 'stone')).toBe(STRATA[0].veins.stone);
    const stone0 = t.players[0].res.stone;
    for (let i = 0; i < secs(120); i++) step(t);
    expect(t.players[0].res.stone - stone0).toBeGreaterThan(5);
    expect(veinLeft(b2, 0, 'stone')).toBeLessThan(STRATA[0].veins.stone!);
  });

  it('never starved: stone and gold lie under every town on every map type (rule 1)', () => {
    for (const map of ['continental', 'highlands', 'lakes', 'forest', 'plains', 'sea'] as MapType[]) {
      for (const seed of [1, 2, 3]) {
        const s = game(seed, map);
        for (const p of s.players) {
          const spot = findSpot(s, 'shaft', p.startX, p.startY, 4, 20, 1, (tx, ty) => !placeProblem(s, 'shaft', tx, ty, true, p.id));
          expect(spot, `${map} ${seed} ${p.id}`).toBeTruthy();
          const b = { ...spot!, size: 2, owner: p.id };
          expect(seamsAt(s, b), `${map} ${seed}`).toEqual(expect.arrayContaining(['stone', 'gold']));
        }
      }
    }
  });
});

describe('the computer sinks its shafts (#924 m1)', () => {
  it('sinks a shaft deeper once the vein it digs is spent in the layers it reaches', () => {
    const s = createGame({ seed: 2, size: 'small', players: [{ name: 'A', ai: 'hard', civ: 'greeks' }, { name: 'B', ai: null, civ: 'greeks' }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    p.age = 'bronze';
    p.epoch = 1;
    p.res = { food: 3000, wood: 3000, stone: 0, gold: 0 };
    for (let i = 0; i < 24; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
    placeBuilding(s, 0, 'storehouse', p.startX + 5, p.startY + 5, true);
    for (let i = 0; i < s.res.length; i++) if (s.res[i] === R_STONE || s.res[i] === R_GOLD) clearResource(s, i);
    s.tick = secs(600);
    s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: {} };
    const sunk = () => s.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === 'shaft' && (depthOf(e) > 0 || e.deepening !== undefined));
    for (let i = 0; i < secs(500) && !s.over && !sunk(); i++) step(s);
    expect(sunk()).toBe(true);
  });
});
