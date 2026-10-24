import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { AGES, TIDE_ROUTE, secs } from '../src/sim/data';
import { checksum, createGame, step } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { findPath } from '../src/sim/path';
import { deserialize, serialize } from '../src/sim/save';
import { bared, isTidal, tidalLevel, tideClock, tideLevel, tideWaitLeft } from '../src/sim/tides';
import type { GameState, Unit } from '../src/sim/types';
import { restat, spawnUnit } from '../src/sim/world';

/** Routes that read the tide (#755): a unit sent over the flats crosses only if it beats the water, and otherwise goes round or waits. */

const heard: GameState['events'] = [];
const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec) && !s.over; i++) {
    step(s);
    heard.push(...s.events);
  }
};

/** A lakes map with player 0 in the Age of Tides, run on to low water. */
function lowWater(): GameState {
  const s = createGame({ seed: 1, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 1e9;
  s.animals = [];
  const p = s.players[0];
  restat(s, p, () => {
    p.epoch = AGES.tides.tier;
    p.age = 'tides';
  });
  for (let i = 0; i < secs(400) && (s.tideFrom === undefined || tideLevel(s) !== 0); i++) step(s);
  step(s);
  expect(tideLevel(s)).toBe(0);
  return s;
}

/** Run on until the water is `sec` seconds from rising off low water. */
function toFlood(s: GameState, sec: number): void {
  while (tideClock(s)!.next > sec) step(s);
  expect(tideLevel(s)).toBe(0);
}

const tileOf = (s: GameState, x: number, y: number) => Math.floor(y) * s.w + Math.floor(x);
const deep = (s: GameState, t: number) => isTidal(s, t) && tidalLevel(s, t) === 1;

/** A dry tile and, five tiles off in a straight row of open ground, a bared flat of the deepest level: away from the map's edges. */
function shoreAndFlat(s: GameState): { dry: { x: number; y: number }; flat: { x: number; y: number } } {
  for (let i = 0; i < s.w * s.h; i++) {
    const x = i % s.w;
    const y = (i - x) / s.w;
    if (x < 8 || y < 8 || x >= s.w - 8 || y >= s.h - 8 || !deep(s, i) || !bared(s, i)) continue;
    for (const dx of [-5, 5]) {
      if (!walkable(s, x + dx, y, 0) || isTidal(s, i + dx)) continue;
      let open = true;
      for (let k = x + dx; k !== x; k -= Math.sign(dx)) if (!walkable(s, k, y, 0)) open = false;
      if (open) return { dry: { x: x + dx + 0.5, y: y + 0.5 }, flat: { x: x + 0.5, y: y + 0.5 } };
    }
  }
  throw new Error('no shore by the deep flats on this map');
}

/** Two dry tiles by the deep flats whose short way runs over them, with a way round on dry ground (or shallower flats) a little longer. */
function bayToCross(s: GameState): { from: { x: number; y: number }; to: { x: number; y: number } } {
  const length = (pts: number[], x: number, y: number) => {
    let d = 0;
    for (let k = 0; k < pts.length; k += 2) {
      d += Math.sqrt((pts[k] - x) * (pts[k] - x) + (pts[k + 1] - y) * (pts[k + 1] - y));
      x = pts[k];
      y = pts[k + 1];
    }
    return d;
  };
  for (let y = 10; y < s.h - 10; y++)
    for (let x = 10; x < s.w - 10; x++) {
      const i = y * s.w + x;
      if (!walkable(s, x, y, 0) || isTidal(s, i)) continue;
      if (![i + 1, i - 1, i + s.w, i - s.w, i + 2, i - 2, i + 2 * s.w, i - 2 * s.w].some((j) => deep(s, j) && bared(s, j))) continue;
      for (const [dx, dy] of [[8, 0], [-8, 0], [0, 8], [0, -8], [10, 0], [-10, 0], [0, 10], [0, -10]]) {
        const bx = x + dx;
        const by = y + dy;
        if (!walkable(s, bx, by, 0) || isTidal(s, by * s.w + bx)) continue;
        const g = { x0: bx, y0: by, x1: bx, y1: by, px: bx + 0.5, py: by + 0.5 };
        const short = findPath(s, x + 0.5, y + 0.5, g, 8000, 0);
        const round = findPath(s, x + 0.5, y + 0.5, g, 8000, 0, (t) => deep(s, t));
        if (!short.complete || !round.complete) continue;
        const a = length(short.points, x + 0.5, y + 0.5);
        const b = length(round.points, x + 0.5, y + 0.5);
        if (b > a + 2 && b < a * 2.5) return { from: { x: x + 0.5, y: y + 0.5 }, to: { x: bx + 0.5, y: by + 0.5 } };
      }
    }
  throw new Error('no bay to cross on this map');
}

const move = (s: GameState, u: Unit, to: { x: number; y: number }) => applyCommand(s, { t: 'move', p: u.owner, ids: [u.id], x: to.x, y: to.y });
const swept = (u: Unit) => heard.filter((e) => e.k === 'tideSwept' && e.id === u.id).length;

describe('routes that read the tide', () => {
  it('cross the flats while the water stays off them', () => {
    const s = lowWater();
    const { dry, flat } = shoreAndFlat(s);
    // A whole low water ahead: the five tiles out are quickly walked.
    const u = spawnUnit(s, 0, 'infantry', dry.x, dry.y);
    move(s, u, flat);
    run(s, 0.2);
    expect(u.tideWait).toBeUndefined();
    run(s, 8);
    expect(tileOf(s, u.x, u.y)).toBe(tileOf(s, flat.x, flat.y));
  });

  it('wait on the shore when the flood would catch them, and cross at the next low water', () => {
    const s = lowWater();
    const { dry, flat } = shoreAndFlat(s);
    toFlood(s, 2);
    const u = spawnUnit(s, 0, 'infantry', dry.x, dry.y);
    heard.length = 0;
    move(s, u, flat);
    run(s, 0.2);
    // The deep flat goes under in two seconds: no way round to it, so it waits for the next low water.
    expect(tideWaitLeft(s, u)).toBeGreaterThan(100);
    expect(tideWaitLeft(s, u)).toBeLessThanOrEqual(TIDE_ROUTE.hold);
    expect(heard.some((e) => e.k === 'tideHold' && e.id === u.id)).toBe(true);
    expect(u.order.k).toBe('move');
    // It stands on dry ground through the flood.
    run(s, 60);
    expect(isTidal(s, tileOf(s, u.x, u.y))).toBe(false);
    expect(u.order.k).toBe('move');
    // And reaches the flat once the water is off it, never caught.
    let at = -1;
    for (let i = 0; i < secs(180) && at < 0; i++) {
      run(s, 1 / 20);
      if (tileOf(s, u.x, u.y) === tileOf(s, flat.x, flat.y)) at = s.tick;
    }
    expect(at).toBeGreaterThan(0);
    expect(tideLevel(s)).toBe(0);
    expect(swept(u)).toBe(0);
  });

  it('go round by dry ground when that is quicker than waiting', () => {
    const s = lowWater();
    const { from, to } = bayToCross(s);
    toFlood(s, 3);
    const u = spawnUnit(s, 0, 'infantry', from.x, from.y);
    heard.length = 0;
    move(s, u, to);
    run(s, 0.2);
    expect(u.tideWait).toBeUndefined();
    // Its way keeps off the deep flats the flood takes first.
    const walked = new Set<number>();
    for (let i = 0; i < secs(30) && tileOf(s, u.x, u.y) !== tileOf(s, to.x, to.y); i++) {
      run(s, 1 / 20);
      walked.add(tileOf(s, u.x, u.y));
    }
    expect(tileOf(s, u.x, u.y)).toBe(tileOf(s, to.x, to.y));
    expect([...walked].some((t) => deep(s, t))).toBe(false);
    expect(swept(u)).toBe(0);
  });

  it('a new order ends the wait', () => {
    const s = lowWater();
    const { dry, flat } = shoreAndFlat(s);
    toFlood(s, 2);
    const u = spawnUnit(s, 0, 'infantry', dry.x, dry.y);
    move(s, u, flat);
    run(s, 0.2);
    expect(tideWaitLeft(s, u)).toBeGreaterThan(0);
    applyCommand(s, { t: 'stop', p: 0, ids: [u.id] });
    run(s, 0.2);
    expect(tideWaitLeft(s, u)).toBe(0);
    expect(u.order.k).toBe('idle');
  });

  it('save and load while a unit waits, and play out the same way', () => {
    const s = lowWater();
    const { dry, flat } = shoreAndFlat(s);
    toFlood(s, 2);
    const u = spawnUnit(s, 0, 'infantry', dry.x, dry.y);
    move(s, u, flat);
    run(s, 1);
    expect(tideWaitLeft(s, u)).toBeGreaterThan(0);
    const t = deserialize(serialize(s));
    for (let i = 0; i < secs(200); i++) {
      step(s);
      step(t);
    }
    expect(checksum(t)).toBe(checksum(s));
    const v = t.byId.get(u.id) as Unit;
    expect(v.x).toBe(u.x);
    expect(v.y).toBe(u.y);
  });
});
