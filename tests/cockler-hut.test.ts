import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { AGES, COCKLE, COCKLER, secs } from '../src/sim/data';
import { checksum, createGame, step } from '../src/sim/game';
import { distToRect, placeProblem, walkable } from '../src/sim/grid';
import { deserialize, serialize } from '../src/sim/save';
import { ashoreLeft, bared, cocklerDrop, cocklerSpotNear, isTidal, tidalLevel, tideClock, tideLevel, tideWaitLeft, TIDE_TOP } from '../src/sim/tides';
import type { Building, GameState, Unit } from '../src/sim/types';
import { R_COCKLE } from '../src/sim/types';
import { goalForTile, nearestDrop, placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The Cockler's Hut, and shore waits that hold their ground (#779). */

const heard: GameState['events'] = [];
const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec) && !s.over; i++) {
    step(s);
    heard.push(...s.events);
  }
};

/** A lakes map with player 0 in the Age of Tides, run on until the tide has woken and first stands at `level`. */
function tideAt(level: number, seed = 1): GameState {
  const s = createGame({ seed, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 1e9;
  s.animals = [];
  const p = s.players[0];
  restat(s, p, () => {
    p.epoch = AGES.tides.tier;
    p.age = 'tides';
  });
  for (let i = 0; i < secs(600) && (s.tideFrom === undefined || tideLevel(s) !== level || s.tick === s.tideFrom); i++) step(s);
  step(s);
  expect(tideLevel(s)).toBe(level);
  return s;
}

const beds = (s: GameState) => {
  const out: number[] = [];
  for (let i = 0; i < s.w * s.h; i++) if (s.cockles && s.cockles[i]) out.push(i);
  return out;
};
const tileOf = (s: GameState, x: number, y: number) => Math.floor(y) * s.w + Math.floor(x);
const fits = (s: GameState) => (tx: number, ty: number) => !placeProblem(s, 'cockler', tx, ty, true, 0);

/** A bed away from the edges and far from player 0's Town Center, with a finished hut of player 0's raised by it. */
function hutByBed(s: GameState): { bed: number; hut: Building } {
  const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
  for (const bed of beds(s)) {
    const x = bed % s.w;
    const y = (bed - x) / s.w;
    if (x < 10 || y < 10 || x >= s.w - 10 || y >= s.h - 10 || s.res[bed] !== R_COCKLE || distToRect(x + 0.5, y + 0.5, tc) < 20) continue;
    const spot = cocklerSpotNear(s, bed, fits(s));
    if (!spot) continue;
    return { bed, hut: placeBuilding(s, 0, 'cockler', spot.tx, spot.ty, true) };
  }
  throw new Error('no bed with room for a hut on this map');
}

/** A dry tile that can be walked on, within a few tiles of the hut. */
function besideHut(s: GameState, hut: Building): { x: number; y: number } {
  for (let r = 1; r <= 4; r++)
    for (let y = hut.ty - r; y <= hut.ty + hut.size - 1 + r; y++)
      for (let x = hut.tx - r; x <= hut.tx + hut.size - 1 + r; x++) if (walkable(s, x, y, 0) && !isTidal(s, y * s.w + x)) return { x: x + 0.5, y: y + 0.5 };
  throw new Error('no dry ground by the hut');
}

describe("the Cockler's Hut", () => {
  it('goes only within reach of a cockle bed, and not before the beds are laid', () => {
    const before = createGame({ seed: 1, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    const tc = before.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    expect(placeProblem(before, 'cockler', tc.tx + 5, tc.ty + 5, true, 0)).toBe('beds');
    const s = tideAt(TIDE_TOP - 1);
    const bed = beds(s).find((b) => cocklerSpotNear(s, b, fits(s)))!;
    const spot = cocklerSpotNear(s, bed, fits(s))!;
    expect(placeProblem(s, 'cockler', spot.tx, spot.ty, true, 0)).toBeNull();
    expect(distToRect((bed % s.w) + 0.5, Math.floor(bed / s.w) + 0.5, { ...spot, size: 2 })).toBeLessThanOrEqual(COCKLER.reach);
    // Far from every bed: refused, and the reason says why.
    let far: { tx: number; ty: number } | null = null;
    for (let ty = 2; ty < s.h - 4 && !far; ty++)
      for (let tx = 2; tx < s.w - 4 && !far; tx++) {
        const near = beds(s).some((b) => distToRect((b % s.w) + 0.5, Math.floor(b / s.w) + 0.5, { tx, ty, size: 2 }) <= COCKLER.reach + 1);
        if (!near && placeProblem(s, 'tidemill', tx, ty, true, 0) !== 'water' && placeProblem(s, 'house', tx, ty, true, 0) === null) far = { tx, ty };
      }
    expect(far).not.toBeNull();
    expect(placeProblem(s, 'cockler', far!.tx, far!.ty, true, 0)).toBe('beds');
  });

  it('takes in baskets of cockles, and nothing else', () => {
    const s = tideAt(0);
    const { bed, hut } = hutByBed(s);
    const at = besideHut(s, hut);
    const u = spawnUnit(s, 0, 'citizen', at.x, at.y);
    applyCommand(s, { t: 'gather', p: 0, ids: [u.id], tile: bed });
    step(s);
    u.carry = 5;
    u.carryRes = 'food';
    const store = nearestDrop(s, 0, 'food', u.x, u.y);
    expect(store?.type).not.toBe('cockler');
    expect(cocklerDrop(s, u, store)).toBe(hut);
    // A basket of berries goes to the food store: the hut takes cockles only.
    u.order = { k: 'gather', tile: bed, res: 'food', phase: 'drop' };
    expect(cocklerDrop(s, u, store)).toBe(store);
  });

  it('pickers empty their baskets at the hut by the bed instead of walking home', () => {
    const s = tideAt(0);
    const { bed, hut } = hutByBed(s);
    const at = besideHut(s, hut);
    const u = spawnUnit(s, 0, 'citizen', at.x, at.y);
    const food = s.players[0].res.food;
    heard.length = 0;
    applyCommand(s, { t: 'gather', p: 0, ids: [u.id], tile: bed });
    run(s, 40);
    const drops = heard.filter((e) => e.k === 'deliver' && e.owner === 0 && e.res === 'food');
    expect(drops.length).toBeGreaterThan(0);
    for (const d of drops) if (d.k === 'deliver') expect(distToRect(d.x, d.y, hut)).toBeLessThan(2);
    expect(s.players[0].res.food).toBeGreaterThan(food);
  });

  it('a picker whose bed is under water waits beside the hut, on dry ground', () => {
    const s = tideAt(0);
    const { bed, hut } = hutByBed(s);
    while (tideLevel(s) !== TIDE_TOP) step(s);
    step(s);
    expect(bared(s, bed)).toBe(false);
    const at = besideHut(s, hut);
    const u = spawnUnit(s, 0, 'citizen', at.x + 0.2, at.y);
    heard.length = 0;
    applyCommand(s, { t: 'gather', p: 0, ids: [u.id], tile: bed });
    run(s, 15);
    expect(ashoreLeft(s, u)).toBeGreaterThan(0);
    expect(distToRect(u.x, u.y, hut)).toBeLessThan(1.6);
    expect(isTidal(s, tileOf(s, u.x, u.y))).toBe(false);
    expect(u.order.k).toBe('gather');
  });

  it('tends the beds round it: they come back richer at high water', () => {
    const s = tideAt(1);
    const { bed, hut } = hutByBed(s);
    const far = beds(s).find((b) => distToRect((b % s.w) + 0.5, Math.floor(b / s.w) + 0.5, hut) > COCKLER.reach + 2 && tidalLevel(s, b) === tidalLevel(s, bed))!;
    expect(far).toBeDefined();
    for (const b of [bed, far]) {
      s.res[b] = R_COCKLE;
      s.amount[b] = 1;
    }
    while (tideLevel(s) !== TIDE_TOP) step(s);
    run(s, 1);
    expect(s.amount[bed]).toBe(Math.min(COCKLE.amount, 1 + COCKLER.regrow));
    expect(s.amount[far]).toBe(Math.min(COCKLE.amount, 1 + COCKLE.regrow));
  });

  it('save and load with a hut and its picker, and play out the same way', () => {
    const s = tideAt(0);
    const { bed, hut } = hutByBed(s);
    const at = besideHut(s, hut);
    const u = spawnUnit(s, 0, 'citizen', at.x, at.y);
    applyCommand(s, { t: 'gather', p: 0, ids: [u.id], tile: bed });
    run(s, 10);
    const t = deserialize(serialize(s));
    run(s, 60);
    run(t, 60);
    expect(checksum(t)).toBe(checksum(s));
  });

  it('a Tide computer raises one by its busiest bed', () => {
    const s = createGame({ seed: 3, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }, { name: 'C', ai: 'hard' }] });
    for (const p of s.players)
      restat(s, p, () => {
        p.epoch = AGES.tides.tier;
        p.age = 'tides';
      });
    for (const p of s.players) p.res = { food: 3000, wood: 3000, stone: 3000, gold: 3000 };
    let hut: Building | undefined;
    for (let i = 0; i < secs(240) && !hut; i++) {
      step(s);
      hut = s.ents.find((e): e is Building => e.kind === 'building' && e.type === 'cockler');
    }
    expect(hut).toBeDefined();
    expect(beds(s).some((b) => distToRect((b % s.w) + 0.5, Math.floor(b / s.w) + 0.5, hut!) <= COCKLER.reach)).toBe(true);
  });
});

describe('waiting for the tide', () => {
  it('a picker turned for home with its basket drops its wait to cross to the bed', () => {
    const s = tideAt(0);
    const bed = beds(s).find((b) => s.res[b] === R_COCKLE)!;
    while (tideLevel(s) !== TIDE_TOP) step(s);
    step(s);
    const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    const u = spawnUnit(s, 0, 'citizen', tc.x + 3, tc.y + 3);
    applyCommand(s, { t: 'gather', p: 0, ids: [u.id], tile: bed });
    step(s);
    // As if it had been waiting on the shore to cross to the bed, a basket already in hand.
    u.carry = 5;
    u.carryRes = 'food';
    u.path = null;
    u.goal = goalForTile(s, bed);
    u.wantPath = true;
    u.tideWait = s.tick + secs(120);
    u.ashore = undefined;
    const food = s.players[0].res.food;
    run(s, 20);
    expect(u.tideWait).toBeUndefined();
    expect(s.players[0].res.food).toBe(food + 5);
  });

  it('a crowd waiting on the shore keeps to dry ground through the flood', () => {
    const s = createGame({ seed: 1, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    s.peaceUntil = 1e9;
    s.animals = [];
    restat(s, s.players[0], () => {
      s.players[0].epoch = AGES.tides.tier;
      s.players[0].age = 'tides';
    });
    for (let i = 0; i < secs(400) && (s.tideFrom === undefined || tideLevel(s) !== 0); i++) step(s);
    step(s);
    // A dry tile and, five tiles off in a straight row of open ground, a bared flat of the deepest level.
    let dry: { x: number; y: number } | null = null;
    let flat: { x: number; y: number } | null = null;
    for (let i = 0; i < s.w * s.h && !dry; i++) {
      const x = i % s.w;
      const y = (i - x) / s.w;
      if (x < 8 || y < 8 || x >= s.w - 8 || y >= s.h - 8 || !isTidal(s, i) || tidalLevel(s, i) !== 1 || !bared(s, i)) continue;
      for (const dx of [-5, 5]) {
        if (!walkable(s, x + dx, y, 0) || isTidal(s, i + dx)) continue;
        let open = true;
        for (let k = x + dx; k !== x; k -= Math.sign(dx)) if (!walkable(s, k, y, 0)) open = false;
        if (!open) continue;
        dry = { x: x + dx + 0.5, y: y + 0.5 };
        flat = { x: x + 0.5, y: y + 0.5 };
        break;
      }
    }
    expect(dry).not.toBeNull();
    while (tideClock(s)!.next > 2) step(s);
    const crowd: Unit[] = [];
    for (let k = 0; k < 6; k++) crowd.push(spawnUnit(s, 0, 'infantry', dry!.x + ((k % 3) - 1) * 0.05, dry!.y + (Math.floor(k / 3) - 0.5) * 0.05));
    heard.length = 0;
    applyCommand(s, { t: 'move', p: 0, ids: crowd.map((u) => u.id), x: flat!.x, y: flat!.y });
    run(s, 0.5);
    expect(crowd.filter((u) => tideWaitLeft(s, u) > 0).length).toBeGreaterThan(3);
    // Through the flood and high water: jostled, but never off dry ground, and never swept.
    for (let i = 0; i < secs(80); i++) {
      run(s, 1 / 20);
      for (const u of crowd) if (tideWaitLeft(s, u) > 0 && !u.path) expect(isTidal(s, tileOf(s, u.x, u.y))).toBe(false);
    }
    expect(tideLevel(s)).toBeGreaterThan(0);
    expect(heard.filter((e) => e.k === 'tideSwept' && crowd.some((u) => u.id === e.id)).length).toBe(0);
  });
});
