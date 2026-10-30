import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { AGES, KEG, ROADS, UNDER, secs } from '../src/sim/data';
import { buildBarred, roadKnown, roadProblem } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';
import { placeProblem, walkable } from '../src/sim/grid';
import { findSpot } from '../src/sim/ai';
import { hiddenFrom, inert, sinkProblem, surfaceProblem } from '../src/sim/undercity';
import { updateVision } from '../src/sim/vision';
import { RES } from '../src/sim/types';
import type { Building, BuildingType, GameState, Unit } from '../src/sim/types';
import { canHit, nearestDrop, placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The Deep Road's third age (#876 s3, #883): the Age of the Undercity, buildings sunk below the ground and surfaced again. */

const make = (seed = 2) => {
  const s = createGame({ seed, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null, civ: 'egyptians' }, { name: 'B', ai: null, civ: 'romans' }] });
  s.peaceUntil = 0;
  s.animals = [];
  return s;
};
const enter = (s: GameState, o: number, age: 'undercity' | 'gunpowder' | 'delvings') => {
  const p = s.players[o];
  restat(s, p, () => {
    p.epoch = AGES[age].tier;
    p.age = age;
  });
  p.walked = ['megaliths', 'delvings'];
  p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
};
const raise = (s: GameState, type: BuildingType, o = 0, near = 6) => {
  const p = s.players[o];
  const spot = findSpot(s, type, p.startX, p.startY, near, 20, 1, (tx, ty) => !placeProblem(s, type, tx, ty, true, o))!;
  return placeBuilding(s, o, type, spot.tx, spot.ty, true);
};
const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec); i++) step(s);
};
/** A building sunk at once, its time run out. */
const sunk = (s: GameState, b: Building) => {
  applyCommand(s, { t: 'sink', p: b.owner, building: b.id });
  run(s, UNDER.sink + 0.1);
  expect(b.sunk).toBe(true);
  return b;
};
/** A foot soldier of `o`'s at a building's door. */
const at = (s: GameState, b: Building, o: number, type: 'infantry' | 'ranged' = 'infantry'): Unit => spawnUnit(s, o, type, b.tx + b.size + 0.6, b.ty + 0.5);

describe('the road (#883)', () => {
  it('is the Deep Road\'s tier 3, instead of the Gunpowder Age: a climb from the Delvings, a turn from Gunpowder, and back at Gunpowder or Industrial', () => {
    expect(AGES.undercity.tier).toBe(AGES.gunpowder.tier);
    expect(AGES.undercity.routes).toEqual(['deep']);
    expect(AGES.undercity.verb && AGES.undercity.door && AGES.undercity.good).toBeTruthy();
    expect(AGES.undercity.keepsake?.building).toBe('storehouse');
    const climb = ROADS.find((r) => r.from === 'delvings' && r.to === 'undercity')!;
    const turn = ROADS.find((r) => r.from === 'gunpowder' && r.to === 'undercity')!;
    expect(climb.walked).toBe('delvings');
    expect(turn.walked).toBe('delvings');
    expect(ROADS.some((r) => r.from === 'undercity' && r.to === 'gunpowder')).toBe(true);
    expect(ROADS.some((r) => r.from === 'undercity' && r.to === 'industrial')).toBe(true);
    const s = make();
    enter(s, 0, 'delvings');
    const p = s.players[0];
    p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
    expect(roadKnown(s, p, climb)).toBe(true);
    expect(roadProblem(s, p, climb)).toBeNull();
  });

  it('needs nothing the map may lack: its roads and its sinking cost only food, wood, stone and gold, with no deed, ore or clue', () => {
    for (const r of ROADS.filter((r) => r.to === 'undercity' || r.from === 'undercity')) {
      for (const k of Object.keys(r.cost)) expect(RES).toContain(k);
      expect(r.deed).toBeUndefined();
      expect(r.ore).toBeUndefined();
      expect(r.found).toBeUndefined();
      expect(r.clue).toBeUndefined();
    }
    const s = make();
    enter(s, 0, 'undercity');
    const h = raise(s, 'house');
    s.players[0].res = { food: 0, wood: 0, stone: 0, gold: 0 };
    expect(sinkProblem(s, 0, h)).toMatch(/stone/);
    s.players[0].res.stone = UNDER.cost * h.size * h.size;
    expect(sinkProblem(s, 0, h)).toBeNull();
  });

  it('shuts walls, gates, Watch Towers and the Stable', () => {
    const s = make();
    enter(s, 0, 'undercity');
    for (const t of ['wall', 'gate', 'tower', 'stable'] as const) expect(buildBarred(s.players[0], t)).toBeTruthy();
    expect(buildBarred(s.players[0], 'barracks')).toBeFalsy();
  });
});

describe('sinking (#883)', () => {
  it('takes its time, doing nothing meanwhile, and is paid for in stone', () => {
    const s = make();
    enter(s, 0, 'undercity');
    const h = raise(s, 'house');
    const stone = s.players[0].res.stone;
    applyCommand(s, { t: 'sink', p: 0, building: h.id });
    expect(s.players[0].res.stone).toBe(stone - UNDER.cost * 4);
    expect(inert(h)).toBe(true);
    expect(h.sunk).toBeUndefined();
    // Going down, it can still be seen and struck.
    expect(hiddenFrom(s, h, 1)).toBe(false);
    run(s, UNDER.sink - 1);
    expect(h.sunk).toBeUndefined();
    run(s, 1.1);
    expect(h.sunk).toBe(true);
  });

  it('only what the age sinks, finished, of its own people, in the age', () => {
    const s = make();
    enter(s, 0, 'undercity');
    const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    expect(sinkProblem(s, 0, tc)).toMatch(/can't go below/);
    const h = raise(s, 'house');
    expect(sinkProblem(s, 1, h)).toBeTruthy();
    applyCommand(s, { t: 'sink', p: 1, building: h.id });
    expect(h.sinking).toBeUndefined();
    enter(s, 0, 'gunpowder');
    expect(sinkProblem(s, 0, h)).toMatch(/Undercity/);
  });

  it('a sunk building still houses its people and takes in what is gathered, but trains and researches nothing', () => {
    const s = make();
    enter(s, 0, 'undercity');
    const h = raise(s, 'house');
    const store = raise(s, 'storehouse', 0, 9);
    const bar = raise(s, 'barracks', 0, 12);
    run(s, 0.1);
    const cap = s.players[0].cap;
    applyCommand(s, { t: 'train', p: 0, building: bar.id, unit: 'infantry' });
    expect(bar.queue.length).toBe(1);
    applyCommand(s, { t: 'sink', p: 0, building: bar.id });
    const done = bar.queue[0].done;
    sunk(s, h);
    sunk(s, store);
    expect(bar.sunk).toBe(true);
    expect(s.players[0].cap).toBe(cap);
    expect(nearestDrop(s, 0, 'wood', store.x, store.y + 3)?.id).toBe(store.id);
    expect(bar.queue[0].done).toBe(done);
    applyCommand(s, { t: 'train', p: 0, building: bar.id, unit: 'infantry' });
    expect(bar.queue.length).toBe(1);
  });
});

describe('hidden below (#883)', () => {
  it('is bare ground to a rival who hasn\'t found it: no shot, no blade, no command reaches it', () => {
    const s = make();
    enter(s, 0, 'undercity');
    const h = sunk(s, raise(s, 'house'));
    expect(hiddenFrom(s, h, 1)).toBe(true);
    expect(hiddenFrom(s, h, 0)).toBe(false);
    const archer = at(s, h, 1, 'ranged');
    const sword = at(s, h, 1);
    expect(canHit(s, archer, h)).toBe(false);
    expect(canHit(s, sword, h)).toBe(false);
    applyCommand(s, { t: 'attack', p: 1, ids: [sword.id, archer.id], target: h.id });
    expect(sword.order.k).toBe('idle');
    expect(archer.order.k).toBe('idle');
    applyCommand(s, { t: 'convert', p: 1, ids: [sword.id], target: h.id });
    // Its footprint is open ground while it is below, so feet can stand on it.
    expect(walkable(s, h.tx, h.ty)).toBe(true);
    const hp = h.hp;
    run(s, 2);
    expect(h.hp).toBe(hp);
  });

  it('foot soldiers standing on it find it for their team for good; then a blade reaches it, never a shot', () => {
    const s = make();
    enter(s, 0, 'undercity');
    const h = sunk(s, raise(s, 'house'));
    const sword = at(s, h, 1);
    sword.stance = 'stand';
    const archer = at(s, h, 1, 'ranged');
    archer.stance = 'stand';
    run(s, UNDER.find - 1.5);
    expect(hiddenFrom(s, h, 1)).toBe(true);
    run(s, 2.5);
    expect(hiddenFrom(s, h, 1)).toBe(false);
    expect(h.found).toEqual([1]);
    expect(canHit(s, sword, h)).toBe(true);
    expect(canHit(s, archer, h)).toBe(false);
    const hp = h.hp;
    applyCommand(s, { t: 'attack', p: 1, ids: [sword.id], target: h.id });
    run(s, 4);
    expect(h.hp).toBeLessThan(hp);
  });

  it('a keg blown on it caves it in, harder than a standing building, and shows it to the keg\'s people', () => {
    const s = make();
    enter(s, 0, 'undercity');
    const h = sunk(s, raise(s, 'house'));
    const hp = h.hp;
    s.kegs = [{ id: s.nextId++, x: h.x, y: h.y, owner: 1, at: s.tick + 1 }];
    run(s, 0.2);
    expect(hp - h.hp).toBeGreaterThanOrEqual(Math.min(hp, KEG.building * UNDER.keg));
    if (h.hp > 0) expect(hiddenFrom(s, h, 1)).toBe(false);
  });

  it('sees only a little way out from its vents', () => {
    const s = make();
    enter(s, 0, 'undercity');
    for (const e of s.ents) if (e.owner === 0 && e.kind === 'unit') e.hp = 0;
    const h = raise(s, 'house', 0, 14);
    const far = (x: number, y: number) => s.players[0].vis[Math.floor(y) * s.w + Math.floor(x)];
    for (const e of s.ents) if (e.owner === 0 && e.kind === 'building' && e !== h) e.hp = 0;
    updateVision(s);
    expect(far(h.x + 4, h.y)).toBe(1);
    h.sunk = true;
    updateVision(s);
    expect(far(h.x + 4, h.y)).toBe(0);
    expect(far(h.x + 1, h.y)).toBe(1);
  });
});

describe('surfacing (#883)', () => {
  it('stands on the ground again at once, moving those on its footprint off, and goes back to work after its time', () => {
    const s = make();
    enter(s, 0, 'undercity');
    const bar = sunk(s, raise(s, 'barracks', 0, 10));
    const u = spawnUnit(s, 1, 'infantry', bar.tx + 1.5, bar.ty + 1.5);
    expect(surfaceProblem(s, 0, bar)).toBeNull();
    applyCommand(s, { t: 'sink', p: 0, building: bar.id, up: true });
    expect(bar.sunk).toBeUndefined();
    expect(hiddenFrom(s, bar, 1)).toBe(false);
    expect(walkable(s, bar.tx, bar.ty)).toBe(false);
    expect(u.x < bar.tx || u.x > bar.tx + bar.size || u.y < bar.ty || u.y > bar.ty + bar.size).toBe(true);
    applyCommand(s, { t: 'train', p: 0, building: bar.id, unit: 'infantry' });
    expect(bar.queue.length).toBe(0);
    run(s, UNDER.rise + 0.1);
    expect(inert(bar)).toBe(false);
    applyCommand(s, { t: 'train', p: 0, building: bar.id, unit: 'infantry' });
    expect(bar.queue.length).toBe(1);
  });

  it('anything sunk may come up on any road, and the kept Storehouse goes down on any road', () => {
    const s = make();
    enter(s, 0, 'undercity');
    const h = sunk(s, raise(s, 'house'));
    const store = raise(s, 'storehouse', 0, 9);
    applyCommand(s, { t: 'keepsake', p: 0, building: store.id });
    enter(s, 0, 'gunpowder');
    store.keep = 'undercity';
    expect(surfaceProblem(s, 0, h)).toBeNull();
    expect(sinkProblem(s, 0, store)).toBeNull();
    const h2 = raise(s, 'house', 0, 12);
    expect(sinkProblem(s, 0, h2)).toMatch(/Undercity/);
  });
});
