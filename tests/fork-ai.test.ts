import { describe, expect, it } from 'vitest';
import { hemoTarget } from '../src/sim/ai';
import { ageOf } from '../src/sim/ages';
import { AI_FORK, AI_HEMO, AI_LEVELS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import type { AgeId, Building, BuildingType, GameState, Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer at the fork (#355 s5): it picks a branch in Total War, works its deed, turns down it, and plays it. */

const tc = (s: GameState, owner = 0) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const spot = (s: GameState, type: BuildingType, x: number, y: number, lo: number, hi: number, owner = 0) => {
  for (let r = lo; r <= hi; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = Math.round(x) + dx;
        const ty = Math.round(y) + dy;
        if (!placeProblem(s, type, tx, ty, true, owner)) return { tx, ty };
      }
  throw new Error('no room');
};
const raise = (s: GameState, owner: number, type: BuildingType, x: number, y: number, lo = 0, hi = 12) => {
  const at = spot(s, type, x, y, lo, hi, owner);
  return placeBuilding(s, owner, type, at.tx, at.ty, true);
};
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < secs(seconds); i++) step(s);
};
const mine = (s: GameState, type: BuildingType, owner = 0) => s.ents.filter((e): e is Building => e.kind === 'building' && e.type === type && e.owner === owner && e.hp > 0);
const d2 = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
const foes = (s: GameState, n: number, d: number, type: Unit['type'] = 'infantry') => {
  const home = tc(s);
  const out: Unit[] = [];
  for (let i = 0; i < n; i++) out.push(spawnUnit(s, 1, type, home.x + d, home.y - 2 + i * 0.6));
  return out;
};

/** A hard computer (Romans, foot) standing in `age` after the Path of Blood, rich, with a full town and the fork's clues. */
const game = (age: AgeId): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null }] });
  s.rares = [];
  const p = s.players[0];
  p.epoch = 4;
  p.age = age;
  p.walked = ['warband', 'ironblood', 'totalwar', ...(age === 'industrial' || age === 'totalwar' ? [] : [age])];
  p.res = { food: 20000, wood: 20000, stone: 20000, gold: 20000 };
  const home = tc(s);
  for (let i = 0; i < 60; i++) spawnUnit(s, 0, 'citizen', home.x + 3 + (i % 10) * 0.5, home.y + 3 + (i >> 4) * 0.5);
  raise(s, 0, 'workshop', home.x - 8, home.y - 8);
  raise(s, 0, 'temple', home.x - 8, home.y + 6);
  step(s);
  return s;
};
/** The computer's memory, with the fork chosen. */
const choose = (s: GameState, to: 'hemocraft' | 'bloodrite') => {
  const mem = s.ai[0];
  mem.roads = { ...mem.roads, hemocraft: to === 'hemocraft', bloodrite: to === 'bloodrite' };
  return mem;
};

describe('the computer takes the fork', () => {
  it('chooses one branch in Total War, never both', () => {
    const s = game('totalwar');
    run(s, 3);
    const roads = s.ai[0].roads!;
    expect(roads.hemocraft === true || roads.bloodrite === true).toBe(true);
    expect(roads.hemocraft && roads.bloodrite).toBe(false);
  });

  it('takes the Blood-rite against a rival army of machines', () => {
    const s = game('totalwar');
    for (let i = 0; i < 6; i++) spawnUnit(s, 1, 'siege', tc(s, 1).x + i, tc(s, 1).y + 4);
    run(s, 3);
    expect(s.ai[0].roads!.bloodrite).toBe(true);
    expect(s.ai[0].roads!.hemocraft).toBe(false);
  });

  it('stays in Total War until the deed is done', () => {
    const s = game('totalwar');
    choose(s, 'hemocraft');
    s.ai[0].blood = { ...s.ai[0].blood, war: s.tick - secs(AI_FORK.stay + 10) };
    run(s, 40);
    expect(ageOf(s.players[0])).toBe('totalwar');
  });

  it('makes peace and turns down Hemocraft once its grafts are done', () => {
    const s = game('totalwar');
    choose(s, 'hemocraft');
    s.players[0].stats.grafted = 8;
    s.ai[0].blood = { ...s.ai[0].blood, war: s.tick - secs(AI_FORK.stay + 10) };
    run(s, 40);
    expect(ageOf(s.players[0])).toBe('industrial');
    run(s, 70);
    expect(ageOf(s.players[0])).toBe('hemocraft');
  });

  it('saves the price of the branch before it makes peace', () => {
    const s = game('totalwar');
    choose(s, 'hemocraft');
    s.players[0].stats.grafted = 8;
    s.players[0].res = { food: 400, wood: 9000, stone: 9000, gold: 9000 };
    s.ai[0].blood = { ...s.ai[0].blood, war: s.tick - secs(AI_FORK.stay + 10) };
    run(s, 20);
    expect(ageOf(s.players[0])).toBe('totalwar');
  });

  it('takes the other branch when its deed is done first', () => {
    const s = game('totalwar');
    choose(s, 'bloodrite');
    s.players[0].stats.grafted = 8;
    s.ai[0].blood = { ...s.ai[0].blood, war: s.tick - secs(AI_FORK.stay + 10) };
    run(s, 40);
    expect(ageOf(s.players[0])).toBe('industrial');
    expect(s.ai[0].roads!.hemocraft).toBe(true);
    expect(s.ai[0].roads!.bloodrite).toBe(false);
  });

  it('chooses nothing while its town is still small', () => {
    const s = game('totalwar');
    const town = s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen');
    for (const e of town.slice(AI_HEMO.town - 6)) e.hp = 0;
    run(s, 3);
    expect(s.ai[0].roads?.hemocraft).toBeUndefined();
    expect(s.ai[0].blood?.war).toBeUndefined();
  });

  it('turns down the Blood-rite from Industry, not back to Total War', () => {
    const s = game('industrial');
    choose(s, 'bloodrite');
    s.players[0].stats.levied = 6;
    s.players[0].stats.campTrained = 12;
    run(s, 70);
    expect(ageOf(s.players[0])).toBe('bloodrite');
  });

  it('gives the levy for the rite\'s deed in Total War', () => {
    const s = game('totalwar');
    choose(s, 'bloodrite');
    raise(s, 0, 'drainrig', tc(s).x + 4, tc(s).y + 3);
    run(s, 40);
    expect(s.players[0].stats.levied ?? 0).toBeGreaterThan(0);
  });

  it('gives the fork up when the deed stays undone', () => {
    const s = game('totalwar');
    choose(s, 'hemocraft');
    s.ai[0].blood = { ...s.ai[0].blood, war: s.tick - secs(AI_FORK.patience + 1) };
    run(s, 2);
    expect(s.ai[0].roads!.hemocraft).toBe(false);
    expect(s.ai[0].roads!.bloodrite).toBe(false);
  });

  it('never takes it with the fork turned off', () => {
    AI_LEVELS.hard.fork = false;
    try {
      const s = game('totalwar');
      run(s, 3);
      expect(s.ai[0].roads!.hemocraft).toBe(false);
      expect(s.ai[0].roads!.bloodrite).toBe(false);
    } finally {
      delete AI_LEVELS.hard.fork;
    }
  });
});

describe('the computer plays its branch', () => {
  it('in Hemocraft raises a second rig out where the living come, ringed by Blood Towers', () => {
    const s = game('hemocraft');
    const home = tc(s);
    raise(s, 0, 'drainrig', home.x + 4, home.y + 3);
    s.players[0].blood = 400;
    foes(s, 4, 18);
    run(s, 50);
    const rigs = mine(s, 'drainrig');
    expect(rigs.length).toBe(AI_FORK.rigs);
    const out = rigs.reduce((a, b) => (d2(a, home) > d2(b, home) ? a : b));
    expect(d2(out, home)).toBeGreaterThan(8 * 8);
    const towers = mine(s, 'bloodtower');
    expect(towers.length).toBeGreaterThan(0);
    expect(towers.some((t) => d2(t, out) <= 8 * 8)).toBe(true);
  });

  it('in Hemocraft raises a Transfusion Station', () => {
    const s = game('hemocraft');
    for (let i = 0; i < AI_HEMO.army + 2; i++) spawnUnit(s, 0, 'infantry', tc(s).x - 4, tc(s).y + i * 0.6);
    run(s, 30);
    expect(mine(s, 'transfusion').length).toBe(1);
  });

  it('in the Blood-rite raises a forward altar and musters by it', () => {
    const s = game('bloodrite');
    const home = tc(s);
    s.players[0].blood = 400;
    foes(s, 4, 18);
    run(s, 50);
    const temples = mine(s, 'temple');
    expect(temples.length).toBe(AI_FORK.altars);
    const altar = temples.reduce((a, b) => (a.x > b.x ? a : b));
    expect(altar.x).toBeGreaterThan(home.x + 4);
    for (let i = 0; i < 4; i++) spawnUnit(s, 0, 'infantry', home.x - 4, home.y + i * 0.6);
    run(s, 2);
    const muster = s.ai[0].muster!;
    expect(d2(muster, altar)).toBeLessThan(d2(muster, home));
  });

  it('in the Blood-rite keeps blood in store with the levy', () => {
    const s = game('bloodrite');
    raise(s, 0, 'drainrig', tc(s).x + 4, tc(s).y + 3);
    s.players[0].blood = 0;
    run(s, 40);
    expect(s.players[0].stats.levied ?? 0).toBeGreaterThan(0);
  });
});

describe('rivals answer the fork with machines', () => {
  it('a Hemocraft rig and a rite altar are machines\' targets; an ordinary Temple and rig are not', () => {
    const s = game('totalwar');
    const p = s.players[0];
    const rival = s.players[1];
    const home = tc(s, 1);
    const rig = raise(s, 1, 'drainrig', home.x + 6, home.y, 0, 12);
    const temple = raise(s, 1, 'temple', home.x - 6, home.y, 0, 12);
    p.seen.fill(1);
    rival.epoch = 4;
    rival.age = 'industrial';
    expect(hemoTarget(s, p, rig.x, rig.y, 4)).toBeNull();
    expect(hemoTarget(s, p, temple.x, temple.y, 4)).toBeNull();
    rival.age = 'hemocraft';
    expect(hemoTarget(s, p, rig.x, rig.y, 4)).toBe(rig);
    rival.age = 'bloodrite';
    expect(hemoTarget(s, p, temple.x, temple.y, 4)).toBe(temple);
    expect(hemoTarget(s, p, rig.x, rig.y, 4)).toBeNull();
  });
});
