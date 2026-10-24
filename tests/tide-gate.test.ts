import { describe, expect, it } from 'vitest';
import { applyCommand, wallLine } from '../src/sim/commands';
import { AGES, AI_BARRAGE, KEG, TIDE, TIDE_GATE, secs } from '../src/sim/data';
import { checksum, createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import { deserialize, serialize } from '../src/sim/save';
import {
  bared,
  barragePlan,
  breachAt,
  gateHead,
  gateLoaded,
  gateReach,
  gateRisk,
  isCauseway,
  isPond,
  millShares,
  pondBehind,
  tideGateSpotIn,
  tideLevel,
  tideRoute,
} from '../src/sim/tides';
import type { AgeId, BarragePlan, Building, GameState } from '../src/sim/types';
import { T_WATER } from '../src/sim/types';
import { goalForPoint, placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The Tide Gate (#785): a gate in a barrage that holds the pond, or lets it out at low water as a scour over the flats below. */

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

/** The first barrage worth laying on the map (as `tests/barrages.test.ts` finds one). */
function bay(s: GameState): BarragePlan {
  for (let y = 4; y < s.h - 4; y += 12)
    for (let x = 4; x < s.w - 4; x += 12) {
      const plan = barragePlan(s, { tx: x, ty: y, size: 2 }, AI_BARRAGE, wallLine);
      if (plan) return plan;
    }
  throw new Error('no bay on this map');
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

/** A barrage of player 0's laid and filled, low water, and a finished gate in it. */
function gated(seed = 1): { s: GameState; plan: BarragePlan; gate: Building } {
  const s = tidal(seed);
  const plan = bay(s);
  for (const t of plan.line) placeBuilding(s, 0, 'causeway', t % s.w, Math.floor(t / s.w), true);
  run(s, 1);
  const spot = tideGateSpotIn(s, plan.line, 0);
  expect(spot).not.toBeNull();
  const gate = placeBuilding(s, 0, 'tidegate', spot!.tx, spot!.ty, true);
  // The pond fills at the next turn; then down to low water, the pond held above the sea.
  toLevel(s, 0);
  return { s, plan, gate };
}

const pondTiles = (s: GameState, gate: Building) => pondBehind(s, gate);

describe('the Tide Gate', () => {
  it('goes only on a causeway tile of its owner\'s own barrage, beside the pond', () => {
    const s = tidal();
    const plan = bay(s);
    const t = plan.line[Math.floor(plan.line.length / 2)];
    // Before the barrage stands there is no causeway to set it in.
    expect(placeProblem(s, 'tidegate', t % s.w, Math.floor(t / s.w), true, 0)).toBe('barrage');
    for (const i of plan.line) placeBuilding(s, 0, 'causeway', i % s.w, Math.floor(i / s.w), true);
    run(s, 1);
    const spot = tideGateSpotIn(s, plan.line, 0)!;
    expect(placeProblem(s, 'tidegate', spot.tx, spot.ty, true, 0)).toBeNull();
    // Not in a rival's barrage, and not on plain flats or dry land.
    expect(placeProblem(s, 'tidegate', spot.tx, spot.ty, true, 1)).toBe('barrage');
    expect(placeProblem(s, 'tidegate', 2, 2, true, 0)).toBe('barrage');
    // The order raises a site there; a refusal says why elsewhere.
    heard.length = 0;
    const u = spawnUnit(s, 0, 'citizen', (plan.line[0] % s.w) + 0.5, Math.floor(plan.line[0] / s.w) + 0.5);
    applyCommand(s, { t: 'build', p: 0, ids: [u.id], type: 'tidegate', tx: 2, ty: 2 });
    expect(s.events.some((e) => e.k === 'refused' && /barrage/.test(e.why))).toBe(true);
    applyCommand(s, { t: 'build', p: 0, ids: [u.id], type: 'tidegate', tx: spot.tx, ty: spot.ty });
    const site = s.byId.get(s.bldAt[spot.ty * s.w + spot.tx]) as Building;
    expect(site?.type).toBe('tidegate');
    expect(isCauseway(s, spot.ty * s.w + spot.tx)).toBe(true);
  });

  it('shut, the barrage holds: the pond stays wet at low water, loaded, and its mills grind it twice', () => {
    const { s, gate } = gated();
    const pond = pondTiles(s, gate);
    expect(pond.length).toBeGreaterThan(0);
    for (const t of pond) expect(bared(s, t)).toBe(false);
    expect(gateHead(s, gate).length).toBeGreaterThanOrEqual(TIDE_GATE.least);
    expect(gateLoaded(s, gate)).toBe(true);
    // Everyone can read it: the flats it would scour.
    expect(gateReach(s, gate).length).toBeGreaterThan(0);
    expect(gateReach(s, gate).every((t) => bared(s, t) && !isPond(s, t))).toBe(true);
  });

  it('opened at low water, the pond scours the flats below: a rival there is swept, then the flats bare again and the pond runs empty', () => {
    const { s, gate } = gated();
    const reach = gateReach(s, gate);
    const head = gateHead(s, gate).length;
    expect(reach.length).toBeLessThanOrEqual(head * TIDE_GATE.spread);
    const t = reach[0];
    const foe = spawnUnit(s, 1, 'infantry', (t % s.w) + 0.5, Math.floor(t / s.w) + 0.5);
    const hp = foe.hp;
    heard.length = 0;
    applyCommand(s, { t: 'pack', p: 0, building: gate.id });
    expect(gate.open).toBe(true);
    const ev = s.events.find((e) => e.k === 'tideGate');
    expect(ev && ev.k === 'tideGate' && ev.open && ev.scour === reach.length && ev.swept === 1).toBe(true);
    for (const r of reach) expect(s.terrain[r]).toBe(T_WATER);
    // Swept off, hurt (or drowned), and counted to the gate's people.
    expect(foe.hp <= hp - TIDE_GATE.hurt || foe.hp <= 0).toBe(true);
    expect(s.events.some((e) => e.k === 'tideSwept' && e.id === foe.id && e.by === 0)).toBe(true);
    expect(s.players[0].stats.scoured).toBe(1);
    // While it runs the gate can't be worked, and the pond pours out behind the scour.
    heard.length = 0;
    applyCommand(s, { t: 'pack', p: 0, building: gate.id });
    expect(s.events.some((e) => e.k === 'refused')).toBe(true);
    run(s, TIDE_GATE.secs + 0.5);
    expect(s.scour).toBeUndefined();
    expect(tideLevel(s)).toBe(0);
    for (const r of reach) expect(bared(s, r)).toBe(true);
    const pond = pondTiles(s, gate);
    for (const p of pond) expect(isPond(s, p)).toBe(false);
    expect(pond.some((p) => bared(s, p))).toBe(true);
    expect(gateLoaded(s, gate)).toBe(false);
  });

  it('an open gate\'s pond is ground once; shut again, the next flood fills it and it holds at low water', () => {
    const { s, gate } = gated();
    const before = millsFor(s, gate);
    applyCommand(s, { t: 'pack', p: 0, building: gate.id });
    run(s, TIDE_GATE.secs + 0.5);
    if (before) expect(millShares(s).get(before.id)!).toBeLessThan(before.gold);
    // Shut at low water: the pond stays empty until the flood comes in.
    applyCommand(s, { t: 'pack', p: 0, building: gate.id });
    expect(gate.open).toBeUndefined();
    const pond = pondTiles(s, gate);
    expect(pond.some((p) => bared(s, p))).toBe(true);
    toLevel(s, 3);
    for (const p of pond) expect(isPond(s, p)).toBe(true);
    toLevel(s, 0);
    for (const p of pond) expect(bared(s, p)).toBe(false);
    expect(gateLoaded(s, gate)).toBe(true);
  });

  it('opened at high water there is no head and no scour: the pond just runs with the tide', () => {
    const { s, gate } = gated();
    toLevel(s, 3);
    expect(gateHead(s, gate).length).toBe(0);
    heard.length = 0;
    applyCommand(s, { t: 'pack', p: 0, building: gate.id });
    const ev = s.events.find((e) => e.k === 'tideGate');
    expect(ev && ev.k === 'tideGate' && ev.open && ev.scour === 0).toBe(true);
    expect(s.scour).toBeUndefined();
    toLevel(s, 0);
    const pond = pondTiles(s, gate);
    expect(pond.some((p) => bared(s, p))).toBe(true);
  });

  it('a rival reads a loaded gate as a risk: its routes and its workers keep off the flats below; its owner\'s do not', () => {
    const { s, gate } = gated();
    const risk = gateRisk(s, 1)!;
    expect(risk).not.toBeNull();
    expect(gateRisk(s, 0)).toBeNull();
    const reach = gateReach(s, gate);
    for (const t of reach) expect(risk(t)).toBe(true);
    // A rival route over the scour's flats is worked out again (the round it looks for costs it a search); its owner's is not.
    const from = reach[reach.length - 1];
    const to = reach[0];
    const walk = (o: number) => {
      const u = spawnUnit(s, o, 'infantry', (from % s.w) + 0.5, Math.floor(from / s.w) + 0.5);
      u.goal = goalForPoint(s, (to % s.w) + 0.5, Math.floor(to / s.w) + 0.5, s.players[o].team);
      u.path = [(to % s.w) + 0.5, Math.floor(to / s.w) + 0.5];
      u.pathI = 0;
      return tideRoute(s, u, s.players[o].team, 4000);
    };
    expect(walk(1)).toBeGreaterThan(0);
    expect(walk(0)).toBe(0);
    // A rival citizen standing idle on those flats walks ashore; the gate's own stays.
    const idle = (o: number) => spawnUnit(s, o, 'citizen', (to % s.w) + 0.5, Math.floor(to / s.w) + 0.5);
    const theirs = idle(1);
    const mine = idle(0);
    run(s, 1);
    expect(theirs.order.k).toBe('move');
    expect(mine.order.k).toBe('idle');
    // Once the gate is opened and run out, nothing is loaded and nothing is at risk.
    applyCommand(s, { t: 'pack', p: 0, building: gate.id });
    run(s, TIDE_GATE.secs + 0.5);
    expect(gateRisk(s, 1)).toBeNull();
  });

  it('a keg that breaches the causeway under a gate wrecks the gate', () => {
    const { s, gate } = gated();
    enter(s, 1, 'sapper');
    const n = breachAt(s, gate.x, gate.y, 0.6, 1);
    expect(n).toBeGreaterThan(0);
    run(s, 0.5);
    expect(s.byId.has(gate.id)).toBe(false);
    expect(KEG.reach).toBeGreaterThan(0);
  });

  it('saves and loads mid-scour, and plays out the same way', () => {
    const { s, gate } = gated();
    applyCommand(s, { t: 'pack', p: 0, building: gate.id });
    run(s, 1);
    expect(s.scour).toBeDefined();
    const copy = deserialize(serialize(s));
    for (let i = 0; i < secs(TIDE.period / 2); i++) {
      step(s);
      step(copy);
    }
    expect(checksum(copy)).toBe(checksum(s));
    expect(copy.scour).toBeUndefined();
  });
});

/** A Tide Mill of player 0's by the gate's pond, if one fits, and what it grinds a turn with the pond held. */
function millsFor(s: GameState, gate: Building): { id: number; gold: number } | null {
  for (const t of pondBehind(s, gate)) {
    const x = t % s.w;
    const y = Math.floor(t / s.w);
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++)
        if (!placeProblem(s, 'tidemill', x + dx, y + dy, true, 0)) {
          const b = placeBuilding(s, 0, 'tidemill', x + dx, y + dy, true);
          return { id: b.id, gold: millShares(s).get(b.id)! };
        }
  }
  return null;
}

describe('the computer and its Tide Gate', () => {
  /** Player 0 a computer in the Age of Tides with a barrage of its own laid, the tide awake; player 1 a rival with no computer. */
  function aiBarrage(): { s: GameState; plan: BarragePlan } {
    const s = createGame({ seed: 1, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: null }] });
    s.peaceUntil = 0;
    s.animals = [];
    enter(s, 0, 'tides');
    s.players[0].res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
    step(s);
    const plan = bay(s);
    for (const t of plan.line) placeBuilding(s, 0, 'causeway', t % s.w, Math.floor(t / s.w), true);
    // A few idle hands on the shore by it: a new town's are all at work raising houses.
    for (let k = 0; k < 4; k++) spawnUnit(s, 0, 'citizen', plan.from.x + 0.5, plan.from.y + 0.5);
    run(s, 1);
    return { s, plan };
  }

  it('sets a gate in its barrage', () => {
    const { s } = aiBarrage();
    run(s, 40);
    const gate = s.ents.find((e) => e.kind === 'building' && e.type === 'tidegate' && e.owner === 0) as Building | undefined;
    expect(gate).toBeDefined();
    expect(isCauseway(s, gate!.ty * s.w + gate!.tx)).toBe(true);
    expect(pondBehind(s, gate!).length).toBeGreaterThan(0);
  });

  it('opens it on a rival army standing on the flats below at low water, and shuts it again after', () => {
    const { s, plan } = aiBarrage();
    const spot = tideGateSpotIn(s, plan.line, 0)!;
    const gate = placeBuilding(s, 0, 'tidegate', spot.tx, spot.ty, true);
    toLevel(s, 0);
    const reach = gateReach(s, gate);
    expect(reach.length).toBeGreaterThan(0);
    // One rival soldier is not worth the pond; an army is.
    spawnUnit(s, 1, 'infantry', (reach[0] % s.w) + 0.5, Math.floor(reach[0] / s.w) + 0.5);
    run(s, 2);
    expect(gate.open).toBeUndefined();
    for (let k = 1; k < 4; k++) {
      const t = reach[k % reach.length];
      spawnUnit(s, 1, 'infantry', (t % s.w) + 0.5, Math.floor(t / s.w) + 0.5);
    }
    heard.length = 0;
    run(s, 2);
    expect(heard.some((e) => e.k === 'tideGate' && e.owner === 0 && e.open && e.scour > 0 && e.swept >= 3)).toBe(true);
    run(s, 10);
    expect(gate.open).toBeUndefined();
  });
});
