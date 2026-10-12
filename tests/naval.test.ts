import { describe, expect, it } from 'vitest';
import { findDockSpot } from '../src/sim/ai';
import { EPOCHS, TICK_HZ, domainOf } from '../src/sim/data';
import { checksum, createGame, step, type GameSetup } from '../src/sim/game';
import { NAVAL, nearestWalkable, placeProblem, walkable } from '../src/sim/grid';
import { deserialize, serialize } from '../src/sim/save';
import { coastNear } from '../src/sim/units';
import type { Building, Command, GameState, Unit } from '../src/sim/types';
import { R_FISH } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** Ships, fishing, transports and aircraft. */

const game = (o: Partial<GameSetup> = {}): GameState =>
  createGame({
    seed: o.seed ?? 7,
    size: o.size ?? 'small',
    mapType: o.mapType ?? 'sea',
    startEpoch: o.startEpoch,
    players: o.players ?? [
      { name: 'A', ai: null, civ: 'romans' },
      { name: 'B', ai: null, civ: 'romans' },
    ],
  });

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};
const rich = (s: GameState, p = 0) => (s.players[p].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 });

/** A finished dock on the home shore. */
function dock(s: GameState, p = 0): Building {
  const pl = s.players[p];
  const at = findDockSpot(s, pl.startX, pl.startY, 30)!;
  expect(at).toBeTruthy();
  return placeBuilding(s, p, 'dock', at.tx, at.ty, true);
}

/** A spot on land near a point. */
function landNear(s: GameState, x: number, y: number, dx = 0): { x: number; y: number } {
  const t = nearestWalkable(s, x + dx, y, 12);
  return { x: (t % s.w) + 0.5, y: Math.floor(t / s.w) + 0.5 };
}

/** Open water near a dock, `d` tiles out. */
function waterNear(s: GameState, x: number, y: number, minD = 2): { x: number; y: number } {
  for (let r = minD; r < 30; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = Math.floor(x) + dx;
        const ty = Math.floor(y) + dy;
        let open = true;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (!walkable(s, tx + ox, ty + oy, NAVAL)) open = false;
        if (open) return { x: tx + 0.5, y: ty + 0.5 };
      }
    }
  }
  throw new Error('no water');
}

describe('docks and fishing', () => {
  it('a dock must stand on the shore', () => {
    const s = game();
    const p = s.players[0];
    // Inland, by the Town Center: no.
    let inland = false;
    for (let r = 5; r < 9 && !inland; r++) {
      if (placeProblem(s, 'dock', Math.floor(p.startX) + r, Math.floor(p.startY)) === 'shore') inland = true;
      if (placeProblem(s, 'dock', Math.floor(p.startX) - r, Math.floor(p.startY)) === 'shore') inland = true;
    }
    expect(inland).toBe(true);
    expect(findDockSpot(s, p.startX, p.startY, 30)).toBeTruthy();
  });

  it('a fishing boat fishes a shoal and brings the catch to the dock', () => {
    const s = game();
    const d = dock(s);
    rich(s);
    const food = s.players[0].res.food;
    run(s, 1, [{ t: 'train', p: 0, building: d.id, unit: 'fisher' }]);
    expect(s.players[0].res.food).toBe(food);
    run(s, 90);
    const boat = s.ents.find((e): e is Unit => e.kind === 'unit' && e.type === 'fisher')!;
    expect(boat).toBeTruthy();
    expect(walkable(s, Math.floor(boat.x), Math.floor(boat.y), NAVAL) || s.res[Math.floor(boat.y) * s.w + Math.floor(boat.x)] === R_FISH).toBe(true);
    expect(s.players[0].stats.gathered).toBeGreaterThan(0);
    expect(s.players[0].res.food).toBeGreaterThan(food);
  });
});

describe('fighting on the water', () => {
  it('warships sink boats; swords cannot reach a ship but arrows can', () => {
    const s = game({ startEpoch: 2 });
    const d = dock(s);
    const w = waterNear(s, d.x, d.y, 3);
    const ship = spawnUnit(s, 0, 'warship', w.x, w.y);
    const boat = spawnUnit(s, 1, 'fisher', w.x + 1.2, w.y);
    expect(domainOf(ship.type)).toBe('water');
    run(s, 30, [{ t: 'attack', p: 0, ids: [ship.id], target: boat.id }]);
    expect(boat.hp).toBeLessThanOrEqual(0);
    // An enemy warship by the shore: pikemen won't (can't) go for it, crossbowmen will.
    const foe = spawnUnit(s, 1, 'warship', w.x, w.y);
    const pike = spawnUnit(s, 0, 'infantry', d.x, d.y + 2);
    const xbow = spawnUnit(s, 0, 'ranged', d.x, d.y + 2);
    step(s, [{ t: 'attack', p: 0, ids: [pike.id, xbow.id], target: foe.id }]);
    expect(pike.order.k).toBe('idle');
    expect(xbow.order.k).toBe('attack');
  });
});

describe('transports', () => {
  it('soldiers board a transport, sail across and land on the far shore', () => {
    const s = game({ startEpoch: 1 });
    const d = dock(s);
    const w = waterNear(s, d.x, d.y, 2);
    const ship = spawnUnit(s, 0, 'transport', w.x, w.y);
    const men = [0, 1, 2].map((k) => {
      const at = landNear(s, s.players[0].startX, s.players[0].startY, k);
      return spawnUnit(s, 0, 'infantry', at.x, at.y);
    });
    run(s, 30, [{ t: 'board', p: 0, ids: men.map((m) => m.id), target: ship.id }]);
    expect(ship.cargo.length).toBe(3);
    expect(men.every((m) => m.inside === ship.id)).toBe(true);
    // Across the sea: the shore on the far side of the middle.
    const far = { x: s.w - d.x, y: s.h - d.y };
    run(s, 80, [{ t: 'unload', p: 0, ids: [ship.id], x: far.x, y: far.y }]);
    expect(ship.cargo.length).toBe(0);
    for (const m of men) {
      expect(m.inside).toBe(0);
      expect(walkable(s, Math.floor(m.x), Math.floor(m.y))).toBe(true);
      expect(Math.hypot(m.x - far.x, m.y - far.y)).toBeLessThan(20);
    }
    expect(coastNear(s, far.x, far.y)).toBeTruthy();
  });

  it('a full load meets the ship at a shore both can reach, wherever the ship lies', () => {
    // Seeds where the shore nearest the ship was cut off from the soldiers, or the ship lay by the dock.
    for (const seed of [5, 8, 12]) {
      const s = game({ seed, startEpoch: 2 });
      const p = s.players[0];
      const d = dock(s);
      const w = waterNear(s, d.x, d.y, 4);
      const ship = spawnUnit(s, 0, 'transport', w.x, w.y);
      const men = [...Array(10).keys()].map((k) => {
        const at = landNear(s, p.startX + 3 + (k % 5) * 0.6, p.startY + 3 + Math.floor(k / 5) * 0.6);
        return spawnUnit(s, 0, 'infantry', at.x, at.y);
      });
      run(s, 40, [{ t: 'board', p: 0, ids: men.map((m) => m.id), target: ship.id }]);
      expect(ship.cargo.length).toBe(10);
    }
  });

  it('passengers go down with their ship', () => {
    const s = game({ startEpoch: 1 });
    const d = dock(s);
    const w = waterNear(s, d.x, d.y, 2);
    const ship = spawnUnit(s, 0, 'transport', w.x, w.y);
    const at = landNear(s, s.players[0].startX, s.players[0].startY);
    const man = spawnUnit(s, 0, 'infantry', at.x, at.y);
    run(s, 30, [{ t: 'board', p: 0, ids: [man.id], target: ship.id }]);
    expect(man.inside).toBe(ship.id);
    ship.hp = 0;
    run(s, 1);
    expect(s.byId.has(man.id)).toBe(false);
  });
});

describe('aircraft', () => {
  it('the Industrial Age follows the Gunpowder Age and re-arms everyone', () => {
    const s = game({ startEpoch: 3, mapType: 'plains' });
    rich(s);
    expect(EPOCHS.length).toBe(5);
    const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    run(s, EPOCHS[4].time + 2, [{ t: 'advance', p: 0, building: tc.id }]);
    expect(s.players[0].epoch).toBe(4);
  });

  it('planes fly over water and woods; fighters down bombers; bombers wreck buildings', () => {
    const s = game({ startEpoch: 4 });
    const p0 = s.players[0];
    const p1 = s.players[1];
    // A bomber flies straight across the sea to the rival's town.
    const bomber = spawnUnit(s, 0, 'bomber', p0.startX, p0.startY);
    const target = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter')!;
    const hp = target.hp;
    run(s, 40, [{ t: 'attack', p: 0, ids: [bomber.id], target: target.id }]);
    expect(bomber.hp).toBeGreaterThan(0);
    expect(target.hp).toBeLessThan(hp);
    // Swords can't touch it; a fighter can.
    const sword = spawnUnit(s, 1, 'infantry', bomber.x + 1, bomber.y);
    step(s, [{ t: 'attack', p: 1, ids: [sword.id], target: bomber.id }]);
    expect(sword.order.k).not.toBe('attack');
    const fighter = spawnUnit(s, 1, 'fighter', p1.startX, p1.startY);
    run(s, 60, [{ t: 'attack', p: 1, ids: [fighter.id], target: bomber.id }]);
    expect(bomber.hp).toBeLessThanOrEqual(0);
  });

  it('riflemen shoot at aircraft overhead', () => {
    const s = game({ startEpoch: 4, mapType: 'plains' });
    const p = s.players[0];
    const plane = spawnUnit(s, 1, 'fighter', p.startX + 6, p.startY + 6);
    const rifles = [0, 1, 2, 3].map((k) => spawnUnit(s, 0, 'ranged', p.startX + 4 + k * 0.5, p.startY + 4));
    run(s, 30, [{ t: 'attack', p: 0, ids: rifles.map((r) => r.id), target: plane.id }]);
    expect(plane.hp).toBeLessThanOrEqual(0);
  });
});

describe('determinism with ships and planes', () => {
  it('two runs of a sea match with computer players stay identical', { timeout: 60000 }, () => {
    const setup: GameSetup = { seed: 21, size: 'small', mapType: 'sea', startEpoch: 3, players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }] };
    const a = createGame(setup);
    const b = createGame(setup);
    for (let i = 0; i < TICK_HZ * 300; i++) {
      step(a);
      step(b);
    }
    expect(checksum(a)).toBe(checksum(b));
  });

  it('a saved sea match with ships, planes and passengers aboard plays on exactly as the original', { timeout: 60000 }, () => {
    const s = createGame({ seed: 9, size: 'small', mapType: 'sea', startEpoch: 4, players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'normal' }] });
    for (let i = 0; i < TICK_HZ * 200; i++) step(s);
    // Put some soldiers aboard a transport too.
    const d = dock(s);
    const w = waterNear(s, d.x, d.y, 2);
    const ship = spawnUnit(s, 0, 'transport', w.x, w.y);
    const at = landNear(s, d.x, d.y, 2);
    const man = spawnUnit(s, 0, 'infantry', at.x, at.y);
    run(s, 25, [{ t: 'board', p: 0, ids: [man.id], target: ship.id }]);
    expect(ship.cargo).toEqual([man.id]);
    const t = deserialize(serialize(s));
    for (let i = 0; i < TICK_HZ * 60; i++) {
      step(s);
      step(t);
    }
    expect(checksum(t)).toBe(checksum(s));
    expect(t.ents.some((e) => e.kind === 'unit' && (e.type === 'fighter' || e.type === 'bomber' || e.type === 'fisher'))).toBe(true);
  });
});
