import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { AGES, COCKLE, TIDE, secs } from '../src/sim/data';
import { checksum, createGame, step } from '../src/sim/game';
import { placeProblem, walkable } from '../src/sim/grid';
import { deserialize, serialize } from '../src/sim/save';
import { ashoreLeft, bared, bedClock, causewaySpot, isTidal, tidalLevel, tideClock, tideLevel, TIDE_TOP } from '../src/sim/tides';
import type { GameState, Unit } from '../src/sim/types';
import { R_COCKLE, T_SAND, T_WATER } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** Cockle beds, and work on the flats that reads the tide (#767). */

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

/** A bared bed with dry, walkable ground within a few tiles, away from the edges; and that dry tile. */
function bedByShore(s: GameState): { bed: number; dry: { x: number; y: number } } {
  for (const bed of beds(s)) {
    const x = bed % s.w;
    const y = (bed - x) / s.w;
    if (x < 8 || y < 8 || x >= s.w - 8 || y >= s.h - 8 || !bared(s, bed) || s.res[bed] !== R_COCKLE) continue;
    for (let r = 2; r <= 5; r++)
      for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
        const t = (y + dy) * s.w + x + dx;
        if (walkable(s, x + dx, y + dy, 0) && !isTidal(s, t)) return { bed, dry: { x: x + dx + 0.5, y: y + dy + 0.5 } };
      }
  }
  throw new Error('no bed by the shore on this map');
}

describe('cockle beds', () => {
  it('are laid on the deeper flats when the tide wakes, the same from the same seed', () => {
    const s = tideAt(TIDE_TOP - 1);
    const b = beds(s);
    expect(b.length).toBeGreaterThan(5);
    expect(b.length).toBeLessThan(200);
    for (const t of b) {
      expect(isTidal(s, t)).toBe(true);
      expect(tidalLevel(s, t)).toBeLessThanOrEqual(COCKLE.deep);
      expect(s.res[t]).toBe(R_COCKLE);
      expect(s.amount[t]).toBe(COCKLE.amount);
    }
    expect(beds(tideAt(TIDE_TOP - 1))).toEqual(b);
  });

  it('bare and go under with the tide, and say so', () => {
    const s = tideAt(0);
    const b = beds(s);
    for (const t of b) expect(s.terrain[t]).toBe(T_SAND);
    const c = bedClock(s, b[0])!;
    expect(c.bare).toBe(true);
    expect(c.secs).toBeGreaterThan(0);
    while (tideLevel(s) !== TIDE_TOP) step(s);
    step(s);
    for (const t of b) expect(s.terrain[t]).toBe(T_WATER);
    const d = bedClock(s, b[0])!;
    expect(d.bare).toBe(false);
    expect(d.secs).toBeGreaterThan(0);
    expect(d.secs).toBeLessThanOrEqual(TIDE.period);
  });

  it('grow back at high water, up to what a bed holds', () => {
    const s = tideAt(0);
    const [a, b] = beds(s);
    s.amount[a] = 10;
    s.res[b] = 0;
    s.amount[b] = 0;
    heard.length = 0;
    while (tideLevel(s) !== TIDE_TOP) {
      step(s);
      heard.push(...s.events);
    }
    // The turn itself is played on the next step.
    step(s);
    heard.push(...s.events);
    expect(s.amount[a]).toBe(10 + COCKLE.regrow);
    expect(s.res[b]).toBe(R_COCKLE);
    expect(s.amount[b]).toBe(COCKLE.regrow);
    expect(heard.some((e) => e.k === 'cockles')).toBe(true);
    for (const t of beds(s)) expect(s.amount[t]).toBeLessThanOrEqual(COCKLE.amount);
  });

  it('keep a causeway off them until picked out', () => {
    const s = tideAt(0);
    const t = bedByShore(s).bed;
    expect(causewaySpot(s, t % s.w, Math.floor(t / s.w))).toBeNull();
    // The bed itself is the blocker: a causeway is refused on it while it holds cockles, and taken once it is picked out.
    expect(placeProblem(s, 'causeway', t % s.w, Math.floor(t / s.w))).toBe('blocked');
    s.res[t] = 0;
    s.amount[t] = 0;
    expect(placeProblem(s, 'causeway', t % s.w, Math.floor(t / s.w))).not.toBe('blocked');
  });
});

describe('picking cockles', () => {
  it('a citizen picks a bared bed, and steps ashore before the flood without being swept', () => {
    const s = tideAt(1);
    const { bed, dry } = bedByShore(s);
    const u = spawnUnit(s, 0, 'citizen', dry.x, dry.y);
    const food = s.players[0].res.food;
    applyCommand(s, { t: 'gather', p: 0, ids: [u.id], tile: bed });
    heard.length = 0;
    let wentAshore = false;
    let picked = false;
    for (let i = 0; i < secs(TIDE.period * 1.5); i++) {
      step(s);
      heard.push(...s.events);
      if (ashoreLeft(s, u) > 0 || s.events.some((e) => e.k === 'tideAshore' && e.id === u.id)) wentAshore = true;
      if (u.order.k === 'gather' && u.order.phase === 'work' && u.carry > 0) picked = true;
    }
    expect(picked).toBe(true);
    expect(wentAshore).toBe(true);
    expect(heard.some((e) => e.k === 'tideSwept' && e.id === u.id)).toBe(false);
    expect(u.hp).toBeGreaterThan(0);
    expect(u.order.k).toBe('gather');
    expect(s.players[0].res.food).toBeGreaterThan(food);
  });

  it('a picker sent to a bed under water waits by it, and goes out when it bares', () => {
    const s = tideAt(0);
    const { bed, dry } = bedByShore(s);
    while (tideLevel(s) !== TIDE_TOP) step(s);
    expect(bared(s, bed)).toBe(false);
    const u = spawnUnit(s, 0, 'citizen', dry.x, dry.y);
    applyCommand(s, { t: 'gather', p: 0, ids: [u.id], tile: bed });
    run(s, 2);
    expect(ashoreLeft(s, u)).toBeGreaterThan(0);
    expect(u.order.k).toBe('gather');
    // Until it bares.
    const before = s.amount[bed];
    while (!bared(s, bed)) step(s);
    run(s, 40);
    expect(s.amount[bed]).toBeLessThan(before);
    expect(u.order.k).toBe('gather');
  });

  it('a new order ends the wait ashore', () => {
    const s = tideAt(0);
    const { bed, dry } = bedByShore(s);
    while (tideLevel(s) !== TIDE_TOP) step(s);
    const u: Unit = spawnUnit(s, 0, 'citizen', dry.x, dry.y);
    applyCommand(s, { t: 'gather', p: 0, ids: [u.id], tile: bed });
    run(s, 2);
    expect(ashoreLeft(s, u)).toBeGreaterThan(0);
    applyCommand(s, { t: 'stop', p: 0, ids: [u.id] });
    expect(ashoreLeft(s, u)).toBe(0);
  });

  it('save and load while a picker waits ashore, and play out the same way', () => {
    const s = tideAt(0);
    const { bed, dry } = bedByShore(s);
    while (tideLevel(s) !== TIDE_TOP) step(s);
    const u = spawnUnit(s, 0, 'citizen', dry.x, dry.y);
    applyCommand(s, { t: 'gather', p: 0, ids: [u.id], tile: bed });
    run(s, 2);
    const t = deserialize(serialize(s));
    for (let i = 0; i < secs(120); i++) {
      step(s);
      step(t);
    }
    expect(checksum(t)).toBe(checksum(s));
  });
});

describe('building on the flats', () => {
  it('a builder at a causeway site out on the flats steps ashore before the flood, and is not swept', () => {
    const s = tideAt(0);
    // A bared flat of the top level by dry ground, with no bed on it.
    let site = -1;
    let dry = { x: 0, y: 0 };
    for (let i = 0; i < s.w * s.h && site < 0; i++) {
      const x = i % s.w;
      const y = (i - x) / s.w;
      if (x < 8 || y < 8 || x >= s.w - 8 || y >= s.h - 8 || !bared(s, i) || s.res[i] !== 0 || tidalLevel(s, i) !== 2 || causewaySpot(s, x, y)) continue;
      for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3], [4, 0], [-4, 0], [0, 4], [0, -4]])
        if (walkable(s, x + dx, y + dy, 0) && !isTidal(s, (y + dy) * s.w + x + dx)) {
          site = i;
          dry = { x: x + dx + 0.5, y: y + dy + 0.5 };
          break;
        }
    }
    expect(site).toBeGreaterThanOrEqual(0);
    const b = placeBuilding(s, 0, 'causeway', site % s.w, Math.floor(site / s.w), false);
    const u = spawnUnit(s, 0, 'citizen', dry.x, dry.y);
    applyCommand(s, { t: 'work', p: 0, ids: [u.id], target: b.id });
    expect(tideClock(s)!.level).toBe(0);
    heard.length = 0;
    // Through the flood that covers the site's ground.
    run(s, TIDE.period / 2);
    expect(heard.some((e) => e.k === 'tideSwept' && e.id === u.id)).toBe(false);
    expect(heard.some((e) => e.k === 'tideAshore' && e.id === u.id)).toBe(true);
    expect(isTidal(s, Math.floor(u.y) * s.w + Math.floor(u.x)) && s.terrain[Math.floor(u.y) * s.w + Math.floor(u.x)] === T_WATER).toBe(false);
  });

  it('an idle citizen left on the flats walks ashore before the flood', () => {
    const s = tideAt(0);
    const { bed } = bedByShore(s);
    const u = spawnUnit(s, 0, 'citizen', (bed % s.w) + 0.5, Math.floor(bed / s.w) + 0.5);
    heard.length = 0;
    run(s, TIDE.period / 2);
    expect(heard.some((e) => e.k === 'tideSwept' && e.id === u.id)).toBe(false);
    expect(heard.some((e) => e.k === 'tideAshore' && e.id === u.id)).toBe(true);
  });
});

describe('the computer and cockle beds', () => {
  it('a Tide computer sends hands to pick a bared bed near home', () => {
    const s = createGame({ seed: 1, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }, { name: 'C', ai: 'hard' }] });
    for (const p of s.players)
      restat(s, p, () => {
        p.epoch = AGES.tides.tier;
        p.age = 'tides';
      });
    for (const p of s.players) p.res = { food: 3000, wood: 3000, stone: 3000, gold: 3000 };
    let picking = false;
    for (let i = 0; i < secs(420) && !picking; i++) {
      step(s);
      picking = s.ents.some((e) => e.kind === 'unit' && e.order.k === 'gather' && e.order.phase === 'work' && s.res[e.order.tile] === R_COCKLE);
    }
    expect(picking).toBe(true);
  });
});
