import { describe, expect, it } from 'vitest';
import { AGES, BUILDINGS, GIANTS, LEVIATHANS, TICK_HZ, domainOf, secs } from '../src/sim/data';
import { createGame, enterAge, step } from '../src/sim/game';
import { placeProblem, sails } from '../src/sim/grid';
import { barred, trainsAt } from '../src/sim/ages';
import { krakenProblem, seaBy, seaPace } from '../src/sim/leviathans';
import { statsFor } from '../src/sim/stats';
import type { Building, Command, GameState, Unit } from '../src/sim/types';
import { canHit, maxHp, placeBuilding, spawnUnit } from '../src/sim/world';

/** The Age of Leviathans at sea (#789, `docs/wild-road.md` §5a): the Kraken bred at a Great Den by the sea, and the Reef Ship. */

/** Two people at war on a sea map; player 0 walked the Wild route into Leviathans, with stores to spend; nobody's computer. */
function sea(seed = 4): GameState {
  const s = createGame({ seed, size: 'small', mapType: 'sea', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  s.animals = [];
  s.peaceUntil = 0;
  for (const a of ['wild', 'grove', 'hive', 'wildwood', 'leviathans'] as const) enterAge(s, s.players[0], a);
  s.players[1].epoch = 3;
  for (const p of s.players) p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
  return s;
}

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

/** The open water tile nearest a point. */
function water(s: GameState, x: number, y: number): { x: number; y: number } {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < s.w * s.h; i++) {
    if (!sails(s, i)) continue;
    const d = ((i % s.w) + 0.5 - x) ** 2 + (Math.floor(i / s.w) + 0.5 - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { x: (best % s.w) + 0.5, y: Math.floor(best / s.w) + 0.5 };
}

/** A finished Great Den of player 0's nearest its start whose footprint is (or is not) within `LEVIATHANS.sea` tiles of the sea. */
function greatDen(s: GameState, bySea: boolean): Building {
  const p = s.players[0];
  for (let r = 4; r < 40; r++) {
    for (let ty = Math.floor(p.startY) - r; ty <= Math.floor(p.startY) + r; ty++) {
      for (let tx = Math.floor(p.startX) - r; tx <= Math.floor(p.startX) + r; tx++) {
        if (placeProblem(s, 'greatden', tx, ty) || seaBy(s, tx, ty, 3) !== bySea) continue;
        return placeBuilding(s, 0, 'greatden', tx, ty, true);
      }
    }
  }
  throw new Error('no spot');
}

/** A unit trained at a building: the queue run through until it steps out. */
function bred(s: GameState, b: Building, type: Unit['type'], seconds: number): Unit | undefined {
  const before = new Set(s.ents.map((e) => e.id));
  run(s, seconds, [{ t: 'train', p: b.owner, building: b.id, unit: type }]);
  return s.ents.find((e): e is Unit => e.kind === 'unit' && e.type === type && !before.has(e.id));
}

describe('the Age of Leviathans at sea (#789)', () => {
  it('breeds the Kraken at the Great Den as a giant of the sea, and grows Reef Ships at the Dock in the warship\'s place', () => {
    expect(BUILDINGS.greatden.trains).toContain('kraken');
    expect(BUILDINGS.dock.trains).not.toContain('reefship');
    expect(domainOf('kraken')).toBe('water');
    expect(domainOf('reefship')).toBe('water');
    expect(GIANTS).toContain('kraken');
    expect(AGES.leviathans.no!.units).toContain('warship');
    const s = sea();
    const [p, q] = s.players;
    expect(trainsAt(p, 'dock')).toEqual(['fisher', 'transport', 'reefship', 'cog']);
    expect(barred(p, 'warship', 'dock')).toBeTruthy();
    expect(barred(p, 'reefship', 'dock')).toBeNull();
    expect(barred(p, 'kraken', 'greatden')).toBeNull();
    // A people that never walked the age has neither; one that has left it keeps the Kraken but grows no more Reef Ships.
    expect(trainsAt(q, 'dock')).toContain('warship');
    expect(barred(q, 'kraken', 'greatden')).toMatch(/walked/);
    expect(barred(q, 'reefship', 'dock')).toMatch(/standing/);
    enterAge(s, p, 'atomic');
    expect(trainsAt(p, 'dock')).toContain('warship');
    expect(barred(p, 'reefship', 'dock')).toMatch(/standing/);
    expect(barred(p, 'kraken', 'greatden')).toBeNull();
  });

  it('breeds a Kraken only at a Great Den by the sea, at most two a people, and it comes out on the water', () => {
    const s = sea();
    const inland = greatDen(s, false);
    expect(krakenProblem(s, inland)).toMatch(/within 5 tiles of the sea/);
    const food = s.players[0].res.food;
    run(s, 1, [{ t: 'train', p: 0, building: inland.id, unit: 'kraken' }]);
    expect(inland.queue).toHaveLength(0);
    expect(s.players[0].res.food).toBe(food);
    const den = greatDen(s, true);
    expect(krakenProblem(s, den)).toBeNull();
    const k = bred(s, den, 'kraken', 65);
    expect(k).toBeDefined();
    expect(sails(s, Math.floor(k!.y) * s.w + Math.floor(k!.x))).toBe(true);
    // The second waits in the queue and counts; a third is refused.
    run(s, 1, [{ t: 'train', p: 0, building: den.id, unit: 'kraken' }]);
    expect(den.queue).toHaveLength(1);
    expect(krakenProblem(s, den)).toMatch(/has its 2 Krakens/);
    run(s, 1, [{ t: 'train', p: 0, building: den.id, unit: 'kraken' }]);
    expect(den.queue).toHaveLength(1);
  });

  it('grips the ship it strikes so it cannot sail, until the grip lets go', () => {
    const s = sea();
    const at = water(s, s.w / 2, s.h / 2);
    const prey = spawnUnit(s, 1, 'warship', at.x, at.y);
    const k = spawnUnit(s, 0, 'kraken', at.x, at.y);
    k.x = prey.x + 0.6;
    expect(canHit(s, k, prey)).toBe(true);
    // A soldier on foot can't strike it; an archer can.
    expect(canHit(s, spawnUnit(s, 1, 'infantry', 1, 1), k)).toBe(false);
    expect(canHit(s, spawnUnit(s, 1, 'ranged', 1, 2), k)).toBe(true);
    run(s, 3, [{ t: 'attack', p: 0, ids: [k.id], target: prey.id }]);
    expect(prey.hp).toBeLessThan(maxHp(s, prey));
    expect(prey.gripped).toBeGreaterThan(s.tick);
    expect(seaPace(s, prey)).toBe(0);
    // Held while the Kraken keeps striking: ordered away, it stays where it is.
    const from = { x: prey.x, y: prey.y };
    const away = water(s, prey.x + 12, prey.y);
    run(s, 2, [{ t: 'move', p: 1, ids: [prey.id], x: away.x, y: away.y }]);
    expect(Math.hypot(prey.x - from.x, prey.y - from.y)).toBeLessThan(0.3);
    // Once the Kraken lets go (a truce calls it off), the grip fades and the ship sails.
    s.peaceUntil = s.tick + secs(60);
    run(s, LEVIATHANS.grip + 1);
    expect(seaPace(s, prey)).toBe(1);
    run(s, 2, [{ t: 'move', p: 1, ids: [prey.id], x: away.x, y: away.y }]);
    expect(Math.hypot(prey.x - from.x, prey.y - from.y)).toBeGreaterThan(1);
  });

  it("shoves its own people's ships along, and no rival's", () => {
    const s = sea();
    const at = water(s, s.w / 2, s.h / 2);
    const k = spawnUnit(s, 0, 'kraken', at.x, at.y);
    const mine = spawnUnit(s, 0, 'transport', at.x, at.y);
    const theirs = spawnUnit(s, 1, 'transport', at.x, at.y);
    run(s, 1);
    expect(seaPace(s, mine)).toBe(LEVIATHANS.shoveMul);
    expect(theirs.shoved).toBeUndefined();
    expect(seaPace(s, k)).toBe(1);
    // Far from it, the shove fades.
    const far = water(s, at.x + 20, at.y + 20);
    mine.x = far.x;
    mine.y = far.y;
    run(s, 3);
    expect(seaPace(s, mine)).toBe(1);
  });

  it('launches a Reef Ship young, grows it to full on the water, and mends it only once the blows stop', () => {
    const s = sea();
    const p = s.players[0];
    const shore = water(s, p.startX, p.startY);
    let dock: Building | null = null;
    for (let r = 1; r < 8 && !dock; r++) {
      for (let ty = Math.floor(shore.y) - r; ty <= Math.floor(shore.y) + r && !dock; ty++) {
        for (let tx = Math.floor(shore.x) - r; tx <= Math.floor(shore.x) + r && !dock; tx++) if (!placeProblem(s, 'dock', tx, ty)) dock = placeBuilding(s, 0, 'dock', tx, ty, true);
      }
    }
    expect(dock).not.toBeNull();
    // A warship is refused at a Leviathan people's Dock; a Reef Ship is grown there, for no gold.
    run(s, 1, [{ t: 'train', p: 0, building: dock!.id, unit: 'warship' }]);
    expect(dock!.queue).toHaveLength(0);
    expect(statsFor(s, 0, 'reefship').cost.gold ?? 0).toBe(0);
    const reef = bred(s, dock!, 'reefship', 30);
    expect(reef).toBeDefined();
    const full = maxHp(s, reef!);
    expect(reef!.hp).toBeLessThanOrEqual(Math.round(full * LEVIATHANS.reefBorn) + LEVIATHANS.reefMend);
    run(s, Math.ceil((full * (1 - LEVIATHANS.reefBorn)) / LEVIATHANS.reefMend) + 2);
    expect(reef!.hp).toBe(full);
    // A blow stops the mending for `reefCalm` seconds; then it mends again.
    reef!.hp = full - 100;
    reef!.hurt = s.tick;
    run(s, LEVIATHANS.reefCalm - 2);
    expect(reef!.hp).toBe(full - 100);
    run(s, 4);
    expect(reef!.hp).toBeGreaterThan(full - 100);
  });

  it('is a beast, not a hull: no shipwright reaches the Kraken, and no priest turns it', () => {
    const s = sea();
    const before = statsFor(s, 0, 'kraken');
    const reefBefore = statsFor(s, 0, 'reefship');
    s.players[0].techs.push('shipwright');
    s.players[0].statsVersion++;
    expect(statsFor(s, 0, 'kraken').hp).toBe(before.hp);
    expect(statsFor(s, 0, 'kraken').range).toBe(before.range);
    expect(statsFor(s, 0, 'reefship').hp).toBeGreaterThan(reefBefore.hp);
    const at = water(s, s.w / 2, s.h / 2);
    const k = spawnUnit(s, 0, 'kraken', at.x, at.y);
    const priest = spawnUnit(s, 1, 'priest', at.x, at.y);
    run(s, 20, [{ t: 'convert', p: 1, ids: [priest.id], target: k.id }]);
    expect(k.owner).toBe(0);
  });

  it('the computer breeds a Kraken at its Great Den by the sea, and grows Reef Ships, never warships', () => {
    const s = createGame({ seed: 4, size: 'small', mapType: 'sea', players: [{ name: 'A', ai: 'normal', civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    s.peaceUntil = 0;
    const p = s.players[0];
    for (const a of ['wild', 'grove', 'hive', 'wildwood', 'leviathans'] as const) enterAge(s, p, a);
    p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
    const den = greatDen(s, true);
    const shore = water(s, p.startX, p.startY);
    let dock: Building | null = null;
    for (let r = 1; r < 8 && !dock; r++) {
      for (let ty = Math.floor(shore.y) - r; ty <= Math.floor(shore.y) + r && !dock; ty++) {
        for (let tx = Math.floor(shore.x) - r; tx <= Math.floor(shore.x) + r && !dock; tx++) if (!placeProblem(s, 'dock', tx, ty)) dock = placeBuilding(s, 0, 'dock', tx, ty, true);
      }
    }
    expect(dock).not.toBeNull();
    spawnUnit(s, 0, 'behemoth', p.startX + 2, p.startY + 2).packed = 'towncenter';
    for (let i = 0; i < 4; i++) spawnUnit(s, 0, 'infantry', p.startX + 3, p.startY + i);
    const trained: string[] = [];
    for (let i = 0; i < 180 * TICK_HZ; i++) {
      step(s);
      for (const e of s.events) if (e.k === 'trained' && e.owner === 0) trained.push(e.type);
    }
    expect(trained).toContain('kraken');
    expect(trained).toContain('reefship');
    expect(trained).not.toContain('warship');
    expect(den.queue.filter((q) => q.unit === 'kraken').length + s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'kraken').length).toBe(LEVIATHANS.aiKrakens);
  });
});
