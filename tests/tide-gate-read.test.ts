import { describe, expect, it } from 'vitest';
import { gateRead } from '../src/sim/ai';
import { applyCommand, wallLine } from '../src/sim/commands';
import { AGES, AI_BARRAGE, AI_GATE, AI_GATE_READ, TIDE, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { barragePlan, gateFading, gateLoaded, gateReach, isTidal, tideGateSpotIn, tideLevel } from '../src/sim/tides';
import type { AgeId, AiMemory, Building, GameEvent, GameState, Unit } from '../src/sim/types';
import { T_WATER } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import { tipWhen } from '../src/ui/tips';

/** The computer's gate reads bait (#796): it holds its scour for the army, fires late, and guards the gate against a lone keg. */

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
 * Seed 1, lakes: player 0's barrage laid with a gate in it, loaded at low water (player 0 a computer when `ai`). `flats`: the tiles it
 * would scour; `shore`: dry walkable tiles within 4 of them and off them, in tile order, where a rival army can muster.
 */
function setup(ai = false): { s: GameState; gate: Building; flats: number[]; shore: number[] } {
  const s = createGame({ seed: 1, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: ai ? 'hard' : null }, { name: 'B', ai: null }] });
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
  const flats = gateReach(s, gate);
  const near = new Set<number>();
  for (const t of flats) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) near.add(t + dy * s.w + dx);
  const shore = [...near].sort((a, b) => a - b).filter((i) => i > s.w && i < s.w * (s.h - 1) && !isTidal(s, i) && s.terrain[i] !== T_WATER && walkable(s, i % s.w, Math.floor(i / s.w), -1));
  expect(flats.length).toBeGreaterThanOrEqual(AI_GATE.threat);
  expect(shore.length).toBeGreaterThan(0);
  return { s, gate, flats, shore };
}

/** `n` of player 1's foot soldiers, one to a tile of `tiles` in turn; `hurt` takes that much health off each. */
const put = (s: GameState, tiles: number[], n: number, hurt = 0): Unit[] => {
  const out: Unit[] = [];
  for (let i = 0; i < n; i++) {
    const at = mid(s, tiles[i % tiles.length]);
    const u = spawnUnit(s, 1, 'infantry', at.x, at.y);
    u.hp -= hurt;
    out.push(u);
  }
  return out;
};
const memo = (): NonNullable<AiMemory['tide']> => ({});

describe('the computer\'s gate reads bait', () => {
  it('fires on rivals on its flats with no army behind them, as before', () => {
    const { s, gate, flats } = setup();
    put(s, flats, AI_GATE.threat, 30);
    expect(gateRead(s, 0, gate, memo())).toBe('fire');
  });

  it('holds for the army: a few weak ones on the flats and a bigger force on the shore', () => {
    const { s, gate, flats, shore } = setup();
    put(s, flats, AI_GATE.threat, 30);
    put(s, shore, 7);
    const m = memo();
    expect(gateRead(s, 0, gate, m)).toBe('hold');
    expect(m.hold?.n).toBe(AI_GATE.threat);
    // Held, it stays held while nothing changes.
    expect(gateRead(s, 0, gate, m)).toBe('hold');
  });

  it('fires late: once more step onto the flats than it held for', () => {
    const { s, gate, flats, shore } = setup();
    put(s, flats, AI_GATE.threat, 30);
    put(s, shore, 9);
    const m = memo();
    expect(gateRead(s, 0, gate, m)).toBe('hold');
    put(s, flats.slice(AI_GATE.threat), AI_GATE_READ.rise - 1, 30);
    expect(gateRead(s, 0, gate, m)).toBe('hold');
    put(s, flats.slice(AI_GATE.threat + 1), 1, 30);
    expect(gateRead(s, 0, gate, m)).toBe('fire');
  });

  it('fires late: once the army starts across, or goes away', () => {
    const { s, gate, flats, shore } = setup();
    put(s, flats, AI_GATE.threat, 30);
    const army = put(s, shore, 7);
    const m = memo();
    expect(gateRead(s, 0, gate, m)).toBe('hold');
    // Gone from the shore (here, far off), the bait is all there is: fire on it.
    for (const u of army) {
      u.x = 2.5;
      u.y = 2.5;
    }
    expect(gateRead(s, 0, gate, m)).toBe('fire');
  });

  it('fires late: before the flood takes its head, on the bait it held for', () => {
    const { s, gate } = setup();
    let fading = false;
    for (let i = 0; i < secs(TIDE.period) && gateLoaded(s, gate); i++) {
      step(s);
      if (gateLoaded(s, gate) && gateFading(s, gate, AI_GATE_READ.lose)) {
        fading = true;
        break;
      }
    }
    expect(fading).toBe(true);
    const flats = gateReach(s, gate);
    const shore = setup().shore;
    put(s, flats, AI_GATE.threat, 30);
    put(s, shore, 9);
    expect(gateRead(s, 0, gate, memo())).toBe('fire');
  });

  it('reads the same on the same state', () => {
    const a = setup();
    const b = setup();
    put(a.s, a.flats, AI_GATE.threat, 30);
    put(a.s, a.shore, 7);
    put(b.s, b.flats, AI_GATE.threat, 30);
    put(b.s, b.shore, 7);
    const ma = memo();
    const mb = memo();
    expect(gateRead(a.s, 0, a.gate, ma)).toBe(gateRead(b.s, 0, b.gate, mb));
    expect(ma).toEqual(mb);
  });
});

describe('a computer\'s gate in play', () => {
  it('lets the bait walk while the army waits, and scours the army when it crosses', () => {
    const { s, gate, flats, shore } = setup(true);
    const heard: GameEvent[] = [];
    put(s, flats, AI_GATE.threat, 30);
    const army = put(s, shore, 8);
    run(s, 5, () => heard.push(...s.events));
    expect(heard.some((e) => e.k === 'tideGate' && e.owner === 0 && e.open)).toBe(false);
    expect(gate.open).toBeFalsy();
    // The army walks onto the flats.
    for (const [i, u] of army.entries()) {
      const at = mid(s, flats[(AI_GATE.threat + i) % flats.length]);
      u.x = at.x;
      u.y = at.y;
    }
    run(s, 2, () => heard.push(...s.events));
    expect(heard.some((e) => e.k === 'tideGate' && e.owner === 0 && e.open && e.scour > 0 && e.swept > AI_GATE.threat)).toBe(true);
  });

  it('sends a guard to the gate when a lone keg-carrier comes near, and the keg does not wreck it', () => {
    const { s, gate, shore } = setup(true);
    enter(s, 1, 'sapper');
    s.players[1].kegs = 3;
    // Its guards-to-be, on dry ground a walk off from the gate (the first such tile, in tile order, 12 to 20 tiles off).
    let post = -1;
    for (let i = s.w; i < s.w * (s.h - 1) && post < 0; i++) {
      const g = Math.hypot(mid(s, i).x - gate.x, mid(s, i).y - gate.y);
      if (g >= 12 && g <= 20 && !isTidal(s, i) && s.terrain[i] !== T_WATER && walkable(s, i % s.w, Math.floor(i / s.w), -1)) post = i;
    }
    expect(post).toBeGreaterThan(0);
    const guards: Unit[] = [];
    for (let k = 0; k < 3; k++) guards.push(spawnUnit(s, 0, 'infantry', mid(s, post).x + k * 0.3, mid(s, post).y));
    // The carrier, from the shore tile farthest from the gate still within watch.
    const d = (t: number) => Math.hypot(mid(s, t).x - gate.x, mid(s, t).y - gate.y);
    const from = shore.filter((t) => d(t) <= AI_GATE_READ.watch - 1).sort((a, b) => d(b) - d(a) || a - b)[0];
    expect(from).toBeDefined();
    const carrier = spawnUnit(s, 1, 'infantry', mid(s, from).x, mid(s, from).y);
    run(s, 2);
    const mem = s.ai[0] as AiMemory;
    expect(mem.tide?.guard).toBeDefined();
    expect(guards.map((u) => u.id)).toContain(mem.tide!.guard!.id);
    applyCommand(s, { t: 'kegTile', p: 1, ids: [carrier.id], tile: gate.ty * s.w + gate.tx });
    run(s, 30);
    expect(s.byId.has(gate.id)).toBe(true);
  });
});

describe('the tip', () => {
  it('comes when your soldiers stand below a computer\'s loaded gate, not before, and not for a human\'s gate', () => {
    const when = tipWhen('gateHolds')!;
    expect(when).toBeDefined();
    const ai = setup(true);
    expect(when(ai.s, 1)).toBe(false);
    put(ai.s, ai.flats, 1);
    expect(when(ai.s, 1)).toBe(true);
    // The gate's owner gets no such tip.
    expect(when(ai.s, 0)).toBe(false);
    const human = setup(false);
    put(human.s, human.flats, 1);
    expect(when(human.s, 1)).toBe(false);
  });
});
