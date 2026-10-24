import { describe, expect, it } from 'vitest';
import { wallLine } from '../src/sim/commands';
import { AGES, AI_RIVERS, CANAL, DAM, RIVERS, ROADS, secs } from '../src/sim/data';
import { buildBarred, workRate } from '../src/sim/ages';
import { checksum, createGame, enterAge, step } from '../src/sim/game';
import { BARGE, NAVAL, placeProblem, walkable } from '../src/sim/grid';
import { findPath } from '../src/sim/path';
import { deserialize, serialize } from '../src/sim/save';
import { channelPlan, damTurns, dig, isCanal, isChannel, isInund, wading, type ChannelPlan } from '../src/sim/water';
import type { Building, GameState, MapType } from '../src/sim/types';
import { B_TERRAIN, T_WATER } from '../src/sim/types';
import { goalForPoint, placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The Age of Locks (#701 s5): canals deep enough for ships, bridges over them, and dams whose turbines drive the town. */

const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec) && !s.over; i++) step(s);
};

const lockAge = (s: GameState, o: number) => {
  const p = s.players[o];
  restat(s, p, () => {
    p.epoch = AGES.locks.tier;
    p.age = 'locks';
    p.walked = [...(p.walked ?? []), 'waterline', 'locks'];
  });
  p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
};

/** A people in the Age of Locks with its channel line laid out as finished ditches, by real water (a lake or the sea, not a spring). */
function canalTown(mapType: MapType = 'lakes'): { s: GameState; o: number; plan: ChannelPlan } {
  for (let seed = 1; seed < 40; seed++) {
    const s = createGame({ seed, size: 'medium', mapType, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    s.peaceUntil = 1e9;
    s.animals = [];
    const p = s.players[0];
    const plan = channelPlan(s, p.startX, p.startY, AI_RIVERS, wallLine, (x, y) => !placeProblem(s, 'channel', x, y));
    if (!plan || plan.tiles.length < 6) continue;
    const head = plan.tiles[0];
    const sea = [1, -1, s.w, -s.w].map((d) => head + d).find((n) => s.terrain[n] === T_WATER && s.block[n] === B_TERRAIN);
    if (sea === undefined) continue;
    lockAge(s, 0);
    for (const t of plan.tiles) placeBuilding(s, 0, 'channel', t % s.w, Math.floor(t / s.w), true);
    return { s, o: 0, plan };
  }
  throw new Error('no such map');
}

describe('the Age of Locks in the data (#701 s5)', () => {
  it('is the Water Road instead of the Industrial Age, with crossings to and from it', () => {
    expect(AGES.locks.tier).toBe(4);
    expect(AGES.locks.routes).toEqual(['water']);
    expect(AGES.locks.keepsake!.building).toBe('dam');
    expect(ROADS.some((r) => r.from === 'industrial' && r.to === 'locks' && r.walked === 'waterline')).toBe(true);
    expect(ROADS.filter((r) => r.from === 'locks').map((r) => r.to).sort()).toEqual(['atomic', 'industrial']);
  });

  it('opens the Bridge and the Dam and digs channels again, and shuts stone walls and gates', () => {
    const s = createGame({ seed: 3, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    const p = s.players[0];
    expect(buildBarred(p, 'dam')).toMatch(/Locks/);
    lockAge(s, 0);
    expect(buildBarred(p, 'dam')).toBeNull();
    expect(buildBarred(p, 'bridge')).toBeNull();
    expect(buildBarred(p, 'channel')).toBeNull();
    expect(buildBarred(p, 'wall')).toMatch(/canals are the moat/);
  });
});

describe('canals (#701 s5)', () => {
  it('a channel dug in the age fills as a canal: every ship sails it, and soldiers swim it slower than a channel', () => {
    const { s, plan } = canalTown();
    run(s, RIVERS.fill * (plan.tiles.length + 2));
    expect(plan.tiles.every((t) => isCanal(s, t) && s.terrain[t] === T_WATER)).toBe(true);
    const end = plan.tiles[plan.tiles.length - 1];
    const ex = end % s.w;
    const ey = Math.floor(end / s.w);
    expect(walkable(s, ex, ey, NAVAL)).toBe(true);
    expect(walkable(s, ex, ey, BARGE)).toBe(true);
    // Land units still cross it, swimming.
    expect(walkable(s, ex, ey, s.players[0].team)).toBe(true);
    expect(wading(s, ex + 0.5, ey + 0.5)).toBe(CANAL.wade);
    expect(CANAL.wade).toBeLessThan(RIVERS.wade);
    // A warship on the open water finds its way to the canal's inland end.
    const head = plan.tiles[0];
    const sea = [1, -1, s.w, -s.w].map((d) => head + d).find((n) => s.block[n] === B_TERRAIN && s.terrain[n] === T_WATER)!;
    const ship = spawnUnit(s, 0, 'warship', (sea % s.w) + 0.5, Math.floor(sea / s.w) + 0.5);
    const path = findPath(s, ship.x, ship.y, goalForPoint(s, ex + 0.5, ey + 0.5, NAVAL), 8000, NAVAL);
    expect(path.complete).toBe(true);
  });

  it('an old channel is dug deep into a canal; outside the age a ditch fills as a channel', () => {
    const s = createGame({ seed: 2, size: 'medium', mapType: 'continental', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    const plan = channelPlan(s, p.startX, p.startY, AI_RIVERS, wallLine, (x, y) => !placeProblem(s, 'channel', x, y))!;
    for (const t of plan.tiles) dig(s, t, 0);
    const t = plan.tiles[2];
    expect(isChannel(s, t)).toBe(true);
    // Not before the age: a channel is water.
    expect(placeProblem(s, 'channel', t % s.w, Math.floor(t / s.w), true, 0)).toBe('water');
    lockAge(s, 0);
    expect(placeProblem(s, 'channel', t % s.w, Math.floor(t / s.w), true, 0)).toBeNull();
    placeBuilding(s, 0, 'channel', t % s.w, Math.floor(t / s.w), true);
    run(s, RIVERS.fill * 2);
    expect(isCanal(s, t)).toBe(true);
    expect(isChannel(s, plan.tiles[3])).toBe(true);
  });
});

describe('bridges (#701 s5)', () => {
  it('carry their own people over a canal at full pace, keep rivals off, and swing for ships', () => {
    const { s, plan } = canalTown();
    run(s, RIVERS.fill * (plan.tiles.length + 2));
    const t = plan.tiles[3];
    const tx = t % s.w;
    const ty = Math.floor(t / s.w);
    // Only over water a people dug.
    const land = [1, -1, s.w, -s.w].map((d) => t + d).find((n) => s.terrain[n] !== T_WATER)!;
    expect(placeProblem(s, 'bridge', land % s.w, Math.floor(land / s.w), true, 0)).toBe('dry');
    expect(placeProblem(s, 'bridge', tx, ty, true, 0)).toBeNull();
    placeBuilding(s, 0, 'bridge', tx, ty, true);
    expect(walkable(s, tx, ty, s.players[0].team)).toBe(true);
    expect(walkable(s, tx, ty, s.players[1].team)).toBe(false);
    expect(wading(s, tx + 0.5, ty + 0.5)).toBe(1);
    expect(walkable(s, tx, ty, NAVAL)).toBe(true);
    expect(walkable(s, tx, ty, BARGE)).toBe(true);
  });
});

/** A finished dam on the canal, and a barracks beside it. */
function damTown(): { s: GameState; o: number; plan: ChannelPlan; dam: Building; barracks: Building } {
  const { s, o, plan } = canalTown();
  run(s, RIVERS.fill * (plan.tiles.length + 2));
  const t = plan.tiles[plan.tiles.length >> 1];
  expect(placeProblem(s, 'dam', t % s.w, Math.floor(t / s.w), true, o)).toBeNull();
  const dam = placeBuilding(s, o, 'dam', t % s.w, Math.floor(t / s.w), true);
  let barracks: Building | null = null;
  for (let r = 2; r < DAM.reach && !barracks; r++)
    for (let dy = -r; dy <= r && !barracks; dy++)
      for (let dx = -r; dx <= r && !barracks; dx++) {
        const bx = dam.tx + dx;
        const by = dam.ty + dy;
        if (!placeProblem(s, 'barracks', bx, by, true, o) && (bx + 1.5 - dam.x) ** 2 + (by + 1.5 - dam.y) ** 2 < DAM.reach * DAM.reach) barracks = placeBuilding(s, o, 'barracks', bx, by, true);
      }
  expect(barracks).not.toBeNull();
  return { s, o, plan, dam, barracks: barracks! };
}

describe('dams (#701 s5)', () => {
  it('turn with water beside them and drive the buildings near them; a dam stops ships', () => {
    const { s, o, dam, barracks } = damTown();
    expect(damTurns(s, dam)).toBe(true);
    expect(workRate(s, barracks)).toBe(DAM.drive);
    // A barracks is trained from faster: two fifths more work a second.
    barracks.queue.push({ unit: 'infantry', done: 0, paid: {} });
    const before = barracks.queue[0].done;
    run(s, 1);
    expect(barracks.queue[0].done - before).toBeGreaterThan(secs(1) * 1.3);
    expect(walkable(s, dam.tx, dam.ty, NAVAL)).toBe(false);
    expect(walkable(s, dam.tx, dam.ty, BARGE)).toBe(false);
    expect(walkable(s, dam.tx, dam.ty, s.players[o].team)).toBe(true);
  });

  it('only in the age, or the one kept on leaving it', () => {
    const { s, o, dam, barracks } = damTown();
    const p = s.players[o];
    p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
    enterAge(s, p, 'industrial');
    expect(dam.keep).toBe('locks');
    expect(workRate(s, barracks)).toBe(DAM.drive);
    // A second dam, raised before leaving, would sleep; the keepsake turns on.
    expect(damTurns(s, dam)).toBe(true);
  });

  it('a dam that falls bursts: the low ground round it goes under at once, and those standing there are hurt', () => {
    const { s, o, dam } = damTown();
    const rival = s.players[1];
    // A rival's soldier on the meadow by the dam.
    let spot = -1;
    for (let r = 1; r < 5 && spot < 0; r++)
      for (const d of [1, -1, s.w, -s.w]) {
        const n = dam.ty * s.w + dam.tx + d * r;
        if (s.terrain[n] !== T_WATER && s.block[n] === 0) {
          spot = n;
          break;
        }
      }
    expect(spot).toBeGreaterThanOrEqual(0);
    const foe = spawnUnit(s, rival.id, 'infantry', (spot % s.w) + 0.5, Math.floor(spot / s.w) + 0.5);
    const hp = foe.hp;
    dam.hp = 0;
    step(s);
    expect(s.byId.has(dam.id)).toBe(false);
    const wet = s.inund ? Array.from(s.inund).filter((v) => v !== 0).length : 0;
    expect(wet).toBeGreaterThan(5);
    if (isInund(s, spot)) expect(foe.hp).toBeLessThanOrEqual(hp - DAM.hurt);
    // Then it drains as a flood does.
    run(s, DAM.surge * 2 + 4);
    expect(Array.from(s.inund!).some((v) => v !== 0)).toBe(false);
    void o;
  });

  it('is deterministic, and survives a save', () => {
    const a = damTown();
    const b = damTown();
    for (const x of [a, b]) {
      x.dam.hp = 0;
      run(x.s, 1.2);
    }
    expect(checksum(a.s)).toBe(checksum(b.s));
    const back = deserialize(serialize(a.s));
    expect(Array.from(back.channel!)).toEqual(Array.from(a.s.channel!));
    run(a.s, 2);
    run(back, 2);
    expect(checksum(back)).toBe(checksum(a.s));
  });
});
