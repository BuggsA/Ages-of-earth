import { describe, expect, it } from 'vitest';
import { wallLine } from '../src/sim/commands';
import { AGES, AI_BARRAGE, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { barragePlan, causewayOwner, ebbTiming, isCauseway } from '../src/sim/tides';
import type { AgeId, AiMemory, BarragePlan, GameState, Unit } from '../src/sim/types';
import { T_ROCK, T_WATER } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The computer and the tide, on the attack (#748): it lays barrages by its mills, carries kegs to a rival's, and strikes at low water. */

const heard: GameState['events'] = [];
const run = (s: GameState, sec: number, each?: () => void) => {
  for (let i = 0; i < secs(sec) && !s.over; i++) {
    step(s);
    heard.push(...s.events);
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
const game = (seed: number, ai: [boolean, boolean]): GameState => {
  const s = createGame({ seed, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: ai[0] ? 'hard' : null }, { name: 'B', ai: ai[1] ? 'hard' : null }] });
  s.animals = [];
  return s;
};

/** The first spot (scanning the map) where a mill would have a barrage worth laying. */
function bay(s: GameState): { mill: { tx: number; ty: number; size: number }; plan: BarragePlan } {
  for (let y = 4; y < s.h - 4; y += 12)
    for (let x = 4; x < s.w - 4; x += 12) {
      const mill = { tx: x, ty: y, size: 2 };
      const plan = barragePlan(s, mill, AI_BARRAGE, wallLine);
      if (plan) return { mill, plan };
    }
  throw new Error('no bay on this map');
}

describe('the computer and barrages', () => {
  it('lays a barrage by its Tide Mill where a bay can be shut off', () => {
    const s = game(1, [true, false]);
    s.peaceUntil = 1e9;
    enter(s, 0, 'tides');
    s.players[0].res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
    step(s);
    const { mill, plan } = bay(s);
    placeBuilding(s, 0, 'tidemill', mill.tx, mill.ty, true);
    run(s, 150);
    const laid = plan.line.filter((t) => isCauseway(s, t) && causewayOwner(s, t) === 0).length;
    const sites = s.ents.filter((e) => e.kind === 'building' && e.type === 'causeway' && e.owner === 0).length;
    expect(laid + sites).toBeGreaterThan(0);
  });

  it('its Sappers carry a keg to a rival\'s barrage first', () => {
    const s = game(1, [false, true]);
    s.peaceUntil = 0;
    enter(s, 0, 'tides');
    enter(s, 1, 'sapper');
    step(s);
    const { plan } = bay(s);
    for (const t of plan.line) placeBuilding(s, 0, 'causeway', t % s.w, Math.floor(t / s.w), true);
    run(s, 1);
    expect(s.pond).toBeDefined();
    s.players[1].kegs = 4;
    // A sapper of its own out on campaign, by the barrage and far from home.
    const t = plan.line[0];
    let sapper: Unit | null = null;
    for (let r = 2; r < 8 && !sapper; r++)
      for (const [dx, dy] of [
        [r, 0],
        [-r, 0],
        [0, r],
        [0, -r],
      ]) {
        const x = (t % s.w) + dx;
        const y = Math.floor(t / s.w) + dy;
        if (x < 1 || y < 1 || x >= s.w - 1 || y >= s.h - 1 || s.terrain[y * s.w + x] === T_WATER || s.terrain[y * s.w + x] === T_ROCK || s.bldAt[y * s.w + x]) continue;
        sapper = spawnUnit(s, 1, 'infantry', x + 0.5, y + 0.5);
        break;
      }
    expect(sapper).toBeTruthy();
    let ordered = false;
    run(s, 8, () => {
      if (sapper!.order.k === 'kegTile') ordered = true;
    });
    expect(ordered || s.players[1].kegs! < 4).toBe(true);
  });
});

describe('the low-water strike', () => {
  it('waits for the flats to bare before marching over them, and loses nobody to the flood', () => {
    // Seed 4: the straight march from A's muster to B's town crosses tidal ground.
    const s = game(4, [true, false]);
    s.peaceUntil = 0;
    enter(s, 0, 'tides');
    s.players[0].res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
    s.tick = secs(400);
    step(s);
    const p = s.players[0];
    for (let i = 0; i < 14; i++) spawnUnit(s, 0, 'infantry', p.startX + 3 + (i % 4) * 0.6, p.startY + 3 + Math.floor(i / 4) * 0.6);
    const mem = () => s.ai[0] as AiMemory;
    let waited = false;
    let launched = -1;
    let goAtLaunch: boolean | null = null;
    run(s, 240, () => {
      const m = mem();
      if (m.tide?.wait !== undefined) waited = true;
      if (launched < 0 && m.attacking) {
        launched = s.tick;
        goAtLaunch = m.tide?.cross !== undefined;
      }
    });
    expect(waited).toBe(true);
    expect(launched).toBeGreaterThan(0);
    expect(goAtLaunch).toBe(true);
    expect(heard.some((e) => e.k === 'tideSwept' && e.owner === 0)).toBe(false);
    // The march it timed is one the tide matters to.
    const m = mem();
    expect(m.muster).toBeTruthy();
    expect(ebbTiming(s, m.muster!, { x: s.players[1].startX, y: s.players[1].startY }, 1)).not.toBeNull();
  });
});
