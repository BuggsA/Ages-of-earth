import { describe, expect, it } from 'vitest';
import { gateAnswer, gateSprung } from '../src/sim/ai';
import { applyCommand, wallLine } from '../src/sim/commands';
import { AGES, AI_BARRAGE, AI_GATE_ANSWER, TIDE, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { barragePlan, gateAhead, gateLoaded, gateOnWay, gateReach, isTidal, tideGateSpotIn, tideLevel } from '../src/sim/tides';
import type { AgeId, AiMemory, Building, Command, GameState, Unit } from '../src/sim/types';
import { T_WATER } from '../src/sim/types';
import { findPath } from '../src/sim/path';
import { goalForPoint, placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The computer answers a rival's Tide Gate (#792): it baits it, blows it with a keg, or waits it out, and turns back short of one. */

const run = (s: GameState, sec: number, each?: () => void) => {
  for (let i = 0; i < secs(sec) && !s.over; i++) {
    step(s);
    each?.();
  }
};
const enter = (s: GameState, o: number, age: AgeId) => {
  const p = s.players[o];
  restat(s, p, () => {
    p.epoch = AGES[age].tier;
    p.age = age;
  });
};
type Pt = { x: number; y: number };
const mid = (s: GameState, t: number): Pt => ({ x: (t % s.w) + 0.5, y: Math.floor(t / s.w) + 0.5 });

/**
 * Seed 1, lakes: player 0's barrage laid with a gate in it, loaded at low water; player 1 a rival (a computer when `ai`). And a march for
 * player 1 between two shore tiles near the gate's flats whose way steps onto them with no fair way round.
 */
function setup(ai = false): { s: GameState; gate: Building; from: Pt; to: Pt } {
  const s = createGame({ seed: 1, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: ai ? 'hard' : null }] });
  s.peaceUntil = 0;
  s.animals = [];
  enter(s, 0, 'tides');
  step(s);
  let plan = null;
  for (let y = 4; y < s.h - 4 && !plan; y += 12) for (let x = 4; x < s.w - 4 && !plan; x += 12) plan = barragePlan(s, { tx: x, ty: y, size: 2 }, AI_BARRAGE, wallLine);
  expect(plan).not.toBeNull();
  for (const t of plan!.line) placeBuilding(s, 0, 'causeway', t % s.w, Math.floor(t / s.w), true);
  run(s, 1);
  const spot = tideGateSpotIn(s, plan!.line, 0)!;
  const gate = placeBuilding(s, 0, 'tidegate', spot.tx, spot.ty, true);
  for (let i = 0; i < secs(TIDE.period) * 2 && tideLevel(s) !== 0; i++) step(s);
  step(s);
  expect(gateLoaded(s, gate)).toBe(true);
  const reach = gateReach(s, gate);
  const near = new Set<number>();
  for (const t of reach) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) near.add(t + dy * s.w + dx);
  const land = [...near].sort((a, b) => a - b).filter((i) => i > s.w && i < s.w * (s.h - 1) && !isTidal(s, i) && s.terrain[i] !== T_WATER && walkable(s, i % s.w, Math.floor(i / s.w), -1));
  for (let a = 0; a < land.length; a++)
    for (let b = land.length - 1; b > a; b--)
      if (gateOnWay(s, 1, s.players[1].team, mid(s, land[a]), mid(s, land[b]))) return { s, gate, from: mid(s, land[a]), to: mid(s, land[b]) };
  throw new Error('no march under the gate');
}

const wave = (s: GameState, at: Pt, n: number): Unit[] => {
  const out: Unit[] = [];
  for (let i = 0; i < n; i++) out.push(spawnUnit(s, 1, 'infantry', at.x + (i % 3) * 0.3, at.y + Math.floor(i / 3) * 0.3));
  return out;
};
const issuer = (s: GameState) => (c: Command) => applyCommand(s, c);

describe('the computer reads a rival\'s Tide Gate on its way', () => {
  it('finds the gate a march would walk under; its owner, and anyone once it has fired, finds none', () => {
    const { s, gate, from, to } = setup();
    expect(gateOnWay(s, 1, s.players[1].team, from, to)?.id).toBe(gate.id);
    expect(gateOnWay(s, 0, s.players[0].team, from, to)).toBeNull();
    // The plain way there does step onto the flats below the gate.
    const plain = findPath(s, from.x, from.y, goalForPoint(s, to.x, to.y, s.players[1].team), AI_GATE_ANSWER.search, s.players[1].team);
    expect(gateAhead(s, 1, from.x, from.y, plain.points)?.gate).toBe(gate.id);
    applyCommand(s, { t: 'pack', p: 0, building: gate.id });
    step(s);
    expect(gateOnWay(s, 1, s.players[1].team, from, to)).toBeNull();
  });

  it('baits it: a big wave sends its weakest onto the flats, holds, and goes once the gate has fired on them', () => {
    const { s, gate, from, to } = setup();
    const units = wave(s, from, 10);
    const mem = { muster: from } as AiMemory;
    expect(gateAnswer(s, s.players[1], mem, units, to, issuer(s))).toBe(true);
    expect(mem.tide?.answer?.how).toBe('bait');
    const bait = mem.tide!.answer!.ids;
    expect(bait.length).toBe(AI_GATE_ANSWER.bait);
    const reach = new Set(gateReach(s, gate));
    run(s, 6);
    const on = bait.filter((id) => {
      const u = s.byId.get(id) as Unit;
      return reach.has(Math.floor(u.y) * s.w + Math.floor(u.x));
    });
    expect(on.length).toBeGreaterThan(0);
    // Still loaded: the wave holds.
    expect(gateAnswer(s, s.players[1], mem, units, to, issuer(s))).toBe(true);
    // The gate's owner takes the bait.
    applyCommand(s, { t: 'pack', p: 0, building: gate.id });
    run(s, AI_GATE_ANSWER.look + 0.5);
    expect(gateAnswer(s, s.players[1], mem, units.filter((u) => u.hp > 0), to, issuer(s))).toBe(false);
    expect(gateSprung(s, mem)).toBe(true);
  });

  it('blows it: a Sapper people carries a keg to the gate, and the wave goes once it is wrecked', () => {
    const { s, gate, from, to } = setup();
    enter(s, 1, 'sapper');
    s.players[1].kegs = 3;
    const units = wave(s, from, 10);
    const mem = { muster: from } as AiMemory;
    expect(gateAnswer(s, s.players[1], mem, units, to, issuer(s))).toBe(true);
    expect(mem.tide?.answer?.how).toBe('keg');
    const carrier = s.byId.get(mem.tide!.answer!.ids[0]) as Unit;
    expect(carrier.order.k).toBe('kegTile');
    let held = 0;
    run(s, AI_GATE_ANSWER.keg, () => {
      if (s.byId.has(gate.id) && gateAnswer(s, s.players[1], mem, units.filter((u) => u.hp > 0), to, issuer(s))) held++;
    });
    expect(held).toBeGreaterThan(0);
    expect(s.byId.has(gate.id)).toBe(false);
    expect(s.players[1].kegs).toBeLessThan(3);
    expect(gateAnswer(s, s.players[1], mem, units.filter((u) => u.hp > 0), to, issuer(s))).toBe(false);
  });

  it('waits it out: a small wave holds at the muster as long as the gate stays loaded on its way, then goes', () => {
    const { s, gate, from, to } = setup();
    const units = wave(s, from, 4);
    const mem = { muster: from } as AiMemory;
    expect(gateAnswer(s, s.players[1], mem, units, to, issuer(s))).toBe(true);
    expect(mem.tide?.answer?.how).toBe('wait');
    expect(units.every((u) => u.order.k === 'idle')).toBe(true);
    let went = -1;
    let early = false;
    run(s, AI_GATE_ANSWER.wait + AI_GATE_ANSWER.look + 1, () => {
      if (went >= 0) return;
      const onWay = gateOnWay(s, 1, s.players[1].team, from, to);
      if (!gateAnswer(s, s.players[1], mem, units, to, issuer(s))) {
        went = s.tick;
        // Gone while the gate still stood loaded on its way: only after the whole wait.
        if (onWay && mem.tide?.dare !== gate.id) early = true;
      }
    });
    expect(went).toBeGreaterThan(0);
    expect(early).toBe(false);
    expect(units.every((u) => u.order.k === 'idle')).toBe(true);
  });

  it('plays the same on the same state: the answer is deterministic', () => {
    const a = setup();
    const b = setup();
    const ua = wave(a.s, a.from, 10);
    const ub = wave(b.s, b.from, 10);
    const ma = { muster: a.from } as AiMemory;
    const mb = { muster: b.from } as AiMemory;
    gateAnswer(a.s, a.s.players[1], ma, ua, a.to, issuer(a.s));
    gateAnswer(b.s, b.s.players[1], mb, ub, b.to, issuer(b.s));
    expect(ma.tide?.answer).toEqual(mb.tide?.answer);
  });
});

describe('a computer\'s wave on the march', () => {
  it('turns back short of a rival\'s loaded gate on its way', () => {
    const { s, from, to } = setup(true);
    const units = wave(s, from, 6);
    applyCommand(s, { t: 'move', p: 1, ids: units.map((u) => u.id), x: to.x, y: to.y, amove: true });
    step(s);
    // Their routes go round the flats by themselves; laid before the gate loaded (as here, by hand), they run under it.
    const plain = findPath(s, from.x, from.y, goalForPoint(s, to.x, to.y, s.players[1].team), AI_GATE_ANSWER.search, s.players[1].team);
    for (const u of units) {
      u.path = plain.points.slice();
      u.pathI = 0;
    }
    const mem = s.ai[1] as AiMemory;
    mem.attacking = true;
    let back = false;
    run(s, 3, () => {
      if (mem.tide?.turned !== undefined) back = true;
    });
    expect(back).toBe(true);
    expect(units.some((u) => u.order.k === 'move' && !u.order.amove)).toBe(true);
  });
});
