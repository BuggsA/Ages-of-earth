import { describe, expect, it } from 'vitest';
import { applyCommand, wallLine } from '../src/sim/commands';
import { AGES, AI_BARRAGE, AI_EBB, BARRAGE, KEG, TIDE, secs } from '../src/sim/data';
import { checksum, createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import {
  TIDE_CAUSEWAY,
  TIDE_TOP,
  bareThrough,
  bared,
  barragePlan,
  breachAt,
  causewayOwner,
  ebbTiming,
  flatsCrossing,
  isCauseway,
  isPond,
  kegTileProblem,
  millShares,
  tidalLevel,
  tideLevel,
} from '../src/sim/tides';
import type { AgeId, BarragePlan, Building, GameState } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** Barrages, breaches and the low-water strike (#748): a causeway line that shuts a bay makes a pond, and powder lets it out. */

/** Play on, keeping every event of the way (a step clears the last step's). */
const heard: GameState['events'] = [];
const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec) && !s.over; i++) {
    step(s);
    heard.push(...s.events);
  }
};
const enter = (s: GameState, o: number, age: AgeId) => {
  const p = s.players[o];
  restat(s, p, () => {
    p.epoch = AGES[age].tier;
    p.age = age;
  });
};

/** A lakes map with player 0 in the Age of Tides and the tide awake; player 1 a rival. */
function tidal(seed = 1): GameState {
  const s = createGame({ seed, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 0;
  s.animals = [];
  enter(s, 0, 'tides');
  s.players[0].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
  step(s);
  return s;
}

/** The first spot (scanning the map) where a mill would have a barrage worth laying, and that barrage. */
function bay(s: GameState): { mill: { tx: number; ty: number; size: number }; plan: BarragePlan } {
  for (let y = 4; y < s.h - 4; y += 12)
    for (let x = 4; x < s.w - 4; x += 12) {
      const mill = { tx: x, ty: y, size: 2 };
      const plan = barragePlan(s, mill, AI_BARRAGE, wallLine);
      if (plan) return { mill, plan };
    }
  throw new Error('no bay on this map');
}

/** Lay a barrage's whole line as finished causeways of a player's, and let them settle into tidal ground. */
function lay(s: GameState, plan: BarragePlan, owner = 0): void {
  for (const t of plan.line) placeBuilding(s, owner, 'causeway', t % s.w, Math.floor(t / s.w), true);
  run(s, 1);
}

/** Run the tide on to a level, and play the turn. */
function toLevel(s: GameState, level: number): void {
  for (let i = 0; i < secs(TIDE.period) * 2 && tideLevel(s) !== level; i++) {
    step(s);
    heard.push(...s.events);
  }
  expect(tideLevel(s)).toBe(level);
  step(s);
  heard.push(...s.events);
}

describe('barrages', () => {
  it('a causeway line that shuts a bay off makes a pond whose flats stay wet at low water', () => {
    const s = tidal();
    const { plan } = bay(s);
    expect(plan.line.length).toBeLessThanOrEqual(AI_BARRAGE.line);
    heard.length = 0;
    lay(s, plan);
    for (const t of plan.line) {
      expect(isCauseway(s, t)).toBe(true);
      expect(causewayOwner(s, t)).toBe(0);
    }
    const pond = [...s.pond!.keys()].filter((i) => s.pond![i]);
    expect(pond.length).toBeGreaterThanOrEqual(plan.pond);
    expect(heard.some((e) => e.k === 'pond' && e.owner === 0 && e.tiles > 0)).toBe(true);
    toLevel(s, 0);
    for (const t of pond) expect(bared(s, t)).toBe(false);
    // The flats outside it bare as ever, and the barrage itself is a road.
    expect([...s.tidal!.keys()].some((i) => s.tidal![i] && !isPond(s, i) && bared(s, i))).toBe(true);
    for (const t of plan.line) expect(bared(s, t)).toBe(true);
  });

  it('a Tide Mill grinds its pond twice: on the flood and on the ebb', () => {
    const s = tidal();
    const { plan } = bay(s);
    lay(s, plan);
    const pond = [...s.pond!.keys()].filter((i) => s.pond![i]);
    // A mill on the shore by the pond.
    let mill: Building | null = null;
    for (const t of pond) {
      const x = t % s.w;
      const y = Math.floor(t / s.w);
      for (let dy = -4; dy <= 4 && !mill; dy++)
        for (let dx = -4; dx <= 4 && !mill; dx++) {
          const b = placeBuilding(s, 0, 'tidemill', x + dx, y + dy, true);
          if (b) mill = b;
        }
      if (mill) break;
    }
    expect(mill).toBeTruthy();
    const withPond = millShares(s).get(mill!.id)!;
    const saved = s.pond;
    delete s.pond;
    const without = millShares(s).get(mill!.id)!;
    s.pond = saved;
    expect(withPond).toBeGreaterThan(without);
    expect(withPond).toBeLessThanOrEqual(TIDE.mill.gold * BARRAGE.mill);
  });
});

describe('breaching a causeway', () => {
  it('a rival Sapper carries a keg to a barrage tile and blows it: the road is cut and the pond drains', () => {
    const s = tidal();
    const { plan } = bay(s);
    lay(s, plan);
    expect(s.pond).toBeDefined();
    enter(s, 1, 'sapper');
    s.players[1].kegs = 3;
    toLevel(s, 1);
    const t = plan.line[Math.floor(plan.line.length / 2)];
    expect(bared(s, t)).toBe(true);
    // Its own side may not breach it; the rival may.
    s.players[0].kegs = 1;
    expect(kegTileProblem(s, 0, t)).not.toBeNull();
    expect(kegTileProblem(s, 1, t)).toBeNull();
    const u = spawnUnit(s, 1, 'infantry', (plan.line[0] % s.w) + 0.5, Math.floor(plan.line[0] / s.w) + 0.5);
    applyCommand(s, { t: 'kegTile', p: 1, ids: [u.id], tile: t });
    expect(u.order.k).toBe('kegTile');
    for (let i = 0; i < secs(20) && s.players[1].kegs === 3; i++) step(s);
    expect(s.players[1].kegs).toBe(2);
    // Walk away from the fuse, out of the blast and of the defender's reach.
    applyCommand(s, { t: 'move', p: 1, ids: [u.id], x: u.x, y: u.y });
    heard.length = 0;
    run(s, KEG.fuse + 1);
    expect(isCauseway(s, t)).toBe(false);
    expect(causewayOwner(s, t)).toBe(-1);
    expect(heard.some((e) => e.k === 'breached' && e.by === 1 && e.owner === 0)).toBe(true);
    expect(s.players[1].stats.breached).toBeGreaterThan(0);
    // At the next turn the pond's flats bare like any others: it drained.
    toLevel(s, 0);
    expect(s.pond).toBeUndefined();
  });

  it('a warhead breaches rival causeways in its reach, never its own side\'s', () => {
    const s = tidal();
    const { plan } = bay(s);
    lay(s, plan);
    const t = plan.line[0];
    const x = (t % s.w) + 0.5;
    const y = Math.floor(t / s.w) + 0.5;
    expect(breachAt(s, x, y, 5, 0)).toBe(0);
    expect(isCauseway(s, t)).toBe(true);
    const n = breachAt(s, x, y, 5, 1);
    expect(n).toBeGreaterThan(0);
    expect(isCauseway(s, t)).toBe(false);
    expect(s.tidal![t]).not.toBe(TIDE_CAUSEWAY);
  });

  it('the flood drowns a keg left burning on ground it covers', () => {
    const s = tidal();
    toLevel(s, 0);
    const t = [...s.tidal!.keys()].find((i) => tidalLevel(s, i) === 1 && bared(s, i) && i % s.w > 8 && i % s.w < s.w - 8)!;
    s.kegs = [{ id: s.nextId++, x: (t % s.w) + 0.5, y: Math.floor(t / s.w) + 0.5, owner: 1, at: s.tick + secs(TIDE.period) }];
    heard.length = 0;
    toLevel(s, 1);
    expect(s.kegs).toBeUndefined();
    expect(heard.some((e) => e.k === 'keg' && e.what === 'drowned')).toBe(true);
  });
});

describe('the low-water strike', () => {
  it('finds a march over the flats, and sets out only when it would cross them bare', () => {
    const s = tidal();
    // A march across a line of the deepest flats: from dry land on one side to the other.
    let from: { x: number; y: number } | null = null;
    let to: { x: number; y: number } | null = null;
    for (let i = 0; i < s.w * s.h && !from; i++) {
      if (tidalLevel(s, i) !== 2) continue;
      const x = i % s.w;
      const y = Math.floor(i / s.w);
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ]) {
        let a = 1;
        while (a < 8 && s.tidal![(y - dy * a) * s.w + x - dx * a]) a++;
        let b = 1;
        while (b < 8 && s.tidal![(y + dy * b) * s.w + x + dx * b]) b++;
        if (a >= 8 || b >= 8 || a + b < AI_EBB.across + 2) continue;
        const f = { x: x - dx * (a + 2) + 0.5, y: y - dy * (a + 2) + 0.5 };
        const g = { x: x + dx * (b + 2) + 0.5, y: y + dy * (b + 2) + 0.5 };
        const c = flatsCrossing(s, f, g);
        if (c && c.tiles >= AI_EBB.across) {
          from = f;
          to = g;
          break;
        }
      }
    }
    expect(from).toBeTruthy();
    const c = flatsCrossing(s, from!, to!)!;
    expect(c.level).toBeGreaterThan(0);
    const seen = new Set<boolean>();
    for (let k = 0; k < secs(TIDE.period); k += secs(5)) {
      const e = ebbTiming(s, from!, to!, 1)!;
      expect(e).not.toBeNull();
      seen.add(e.go);
      if (e.go) {
        // Setting out now, it finds each tile of the flats bare as it reaches it.
        for (const f of c.flats) {
          const at = s.tick + secs(f.d * AI_EBB.slack);
          expect(bareThrough(s, f.level, at, at + secs(AI_EBB.slack))).toBe(true);
        }
      }
      run(s, 5);
    }
    expect(seen).toEqual(new Set([true, false]));
    // No tidal ground on the way: the tide is nothing to the march.
    expect(ebbTiming(s, { x: s.players[0].startX, y: s.players[0].startY }, { x: s.players[0].startX + 1, y: s.players[0].startY }, 1)).toBeNull();
    expect(TIDE_TOP).toBe(TIDE.flats.length);
  });
});

describe('determinism', () => {
  it('saves and loads with a barrage standing, and plays out the same way', () => {
    const s = tidal();
    lay(s, bay(s).plan);
    toLevel(s, 1);
    const saved = deserialize(serialize(s));
    run(saved, 40);
    run(s, 40);
    expect(checksum(saved)).toBe(checksum(s));
    expect(serialize(saved)).toBe(serialize(s));
  });
});
