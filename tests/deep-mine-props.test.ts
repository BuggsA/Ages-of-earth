import { describe, expect, it } from 'vitest';
import { SHAFT, STRATA, secs } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { createGame, step } from '../src/sim/game';
import { clearResource, placeProblem } from '../src/sim/grid';
import { findSpot, rivalPithead } from '../src/sim/ai';
import { deserialize, serialize } from '../src/sim/save';
import { crewOf, depthOf, digAt, digShare, safeAt, shaftShare, shutAt } from '../src/sim/shafts';
import { maxHp, placeBuilding, spawnUnit } from '../src/sim/world';
import { R_GOLD, R_STONE, T_ROCK } from '../src/sim/types';
import type { Building, GameEvent, GameState, Unit } from '../src/sim/types';

/** The deep mine m2 (#924, #929): props, cave-ins on the match's dice, blasting, and the pithead as a target. */

const game = (seed = 3): GameState => {
  const s = createGame({ seed, size: 'small', players: [{ name: 'A', ai: null, civ: 'greeks' }, { name: 'B', ai: null }] });
  const p = s.players[0];
  p.age = 'bronze';
  p.epoch = 1;
  p.res.wood = 5000;
  p.res.gold = 5000;
  return s;
};

/** A free 2×2 site by player 0's start on plain earth, with room for a Storehouse beside it. */
function site(s: GameState): { tx: number; ty: number } {
  const p = s.players[0];
  const clear = (tx: number, ty: number) => {
    for (let y = ty - SHAFT.near; y < ty + 2 + SHAFT.near; y++)
      for (let x = tx - SHAFT.near; x < tx + 2 + SHAFT.near; x++) {
        const i = y * s.w + x;
        if (x < 0 || y < 0 || x >= s.w || y >= s.h || s.terrain[i] === T_ROCK || s.res[i] === R_STONE || s.res[i] === R_GOLD) return false;
      }
    return true;
  };
  const spot = findSpot(s, 'shaft', p.startX, p.startY, 6, 30, 1, (tx, ty) => clear(tx, ty) && !placeProblem(s, 'storehouse', tx + 3, ty, true, 0));
  if (!spot) throw new Error('no site');
  return spot;
}

/** A finished shaft sunk to `depth`, a Storehouse beside it, digging gold with `n` citizens. */
function mine(s: GameState, n: number, depth = 1): { b: Building; us: Unit[] } {
  const at = site(s);
  const b = placeBuilding(s, 0, 'shaft', at.tx, at.ty, true);
  placeBuilding(s, 0, 'storehouse', at.tx + 3, at.ty, true);
  b.seam = 'gold';
  b.depth = depth;
  const us: Unit[] = [];
  for (let i = 0; i < n; i++) us.push(spawnUnit(s, 0, 'citizen', at.tx - 0.6, at.ty + 0.5 + i * 0.3));
  for (const u of us) applyCommand(s, { t: 'work', p: 0, ids: [u.id], target: b.id });
  return { b, us };
}

/** Run `sec` seconds, keeping every event. */
function run(s: GameState, sec: number, seen: GameEvent[] = []): GameEvent[] {
  for (let i = 0; i < secs(sec); i++) {
    step(s);
    seen.push(...s.events);
  }
  return seen;
}

/** Run with a layer's (or the blast's) odds set for the test, putting them back after. */
function withOdds<T>(set: () => () => void, f: () => T): T {
  const undo = set();
  try {
    return f();
  } finally {
    undo();
  }
}
const fallOf = (l: number, v: number) => () => {
  const was = STRATA[l].fall;
  STRATA[l].fall = v;
  return () => (STRATA[l].fall = was);
};

const alive = (u: Unit) => u.hp > 0;
const layerOf = (u: Unit) => (u.order.k === 'shaft' ? u.order.layer : undefined);

describe('props and cave-ins (#924 m2)', () => {
  it('every layer below the first can fall in, digs faster unshored, and is shored for wood', () => {
    expect(STRATA[0].fall).toBe(0);
    for (let l = 1; l < STRATA.length; l++) {
      expect(STRATA[l].fall).toBeGreaterThan(0);
      expect(STRATA[l].fall).toBeLessThan(0.2);
      expect(STRATA[l].rush).toBeGreaterThan(0);
      expect(STRATA[l].prop.wood ?? 0).toBeGreaterThan(0);
      expect(Object.values(STRATA[l].blast).reduce((a, n) => a + (n ?? 0), 0)).toBeGreaterThan(0);
    }
  });

  it('shoring pays its wood, makes the layer safe at the plain vein pace, and is refused where it means nothing', () => {
    const s = game();
    const { b } = mine(s, 1);
    const p = s.players[0];
    const rushed = digShare(s, b, 'gold', 1);
    expect(safeAt(b, 1)).toBe(false);
    expect(safeAt(b, 0)).toBe(true);
    const wood0 = p.res.wood;
    // The first layer needs none; a layer not reached can't be shored.
    applyCommand(s, { t: 'prop', p: 0, building: b.id, layer: 0 });
    applyCommand(s, { t: 'prop', p: 0, building: b.id, layer: 2 });
    expect(p.res.wood).toBe(wood0);
    applyCommand(s, { t: 'prop', p: 0, building: b.id, layer: 1 });
    expect(p.res.wood).toBe(wood0 - STRATA[1].prop.wood!);
    expect(safeAt(b, 1)).toBe(true);
    expect(digShare(s, b, 'gold', 1)).toBeCloseTo(rushed - STRATA[1].rush);
    // Twice costs nothing more.
    applyCommand(s, { t: 'prop', p: 0, building: b.id, layer: 1 });
    expect(p.res.wood).toBe(wood0 - STRATA[1].prop.wood!);
  });

  it('never worse than the plain shaft (rule 1): a shored, spent layer digs at the plain grade, an unshored one never below it', () => {
    const s = game();
    const { b } = mine(s, 0, 2);
    const floor = shaftShare(s, b, 'gold');
    b.worked = STRATA.map((L) => ({ ...L.veins }));
    for (let l = 0; l <= 2; l++) expect(digShare(s, b, 'gold', l)).toBeGreaterThanOrEqual(floor);
    b.propped = [false, true, true];
    for (let l = 0; l <= 2; l++) expect(digShare(s, b, 'gold', l)).toBe(floor);
  });

  it('a cave-in kills the miners at the face, shuts the layer, and shoring clears it at once', () => {
    withOdds(fallOf(1, 1), () => {
      const s = game();
      const { b, us } = mine(s, 3);
      const seen = run(s, 90);
      const cave = seen.find((e) => e.k === 'caveIn');
      expect(cave && cave.k === 'caveIn' && cave.why).toBe('fall');
      expect(cave && cave.k === 'caveIn' && cave.dead).toBeGreaterThan(0);
      expect(us.some((u) => !alive(u))).toBe(true);
      // Whoever lives works elsewhere while the layer is shut; nobody is sent into the rubble.
      const at = crewOf(s, b).at;
      if (shutAt(s, b, 1)) expect(at[1]).toBe(0);
      // Shored, it opens at once, and with props it never falls again.
      b.shut = [0, s.tick + secs(SHAFT.shut)];
      applyCommand(s, { t: 'prop', p: 0, building: b.id, layer: 1 });
      expect(shutAt(s, b, 1)).toBe(false);
      const later = run(s, 120);
      expect(later.some((e) => e.k === 'caveIn')).toBe(false);
    });
  });

  it('a seeded cave-in: the same seed gives the same fall, the same tick and the same dead', () => {
    const play = () => {
      const s = game(5);
      const { us } = mine(s, 3, 2);
      s.players[0].age = 'middle';
      s.players[0].epoch = 2;
      const seen = run(s, 900);
      return { caves: seen.filter((e) => e.k === 'caveIn').map((e) => JSON.stringify(e)), dead: us.filter((u) => !alive(u)).map((u) => u.id), rng: s.rng };
    };
    const a = play();
    const b = play();
    expect(a).toEqual(b);
    // In fifteen minutes unshored, the dice do bring a layer down.
    expect(a.caves.length).toBeGreaterThan(0);
  });

  it('a save keeps its props and its shut layers; an old one has none and loads', () => {
    const s = game();
    const { b } = mine(s, 1);
    b.propped = [false, true];
    b.shut = [0, 0];
    run(s, 2);
    const t = deserialize(serialize(s));
    const b2 = t.byId.get(b.id) as Building;
    expect(safeAt(b2, 1)).toBe(true);
    delete b.propped;
    delete b.shut;
    const u = deserialize(serialize(s));
    expect(safeAt(u.byId.get(b.id) as Building, 1)).toBe(false);
    expect(shutAt(u, u.byId.get(b.id) as Building, 1)).toBe(false);
  });
});

describe('blasting (#924 m2)', () => {
  it('is refused before the Gunpowder Age, then opens the next layer at once for its charge', () => {
    const s = game();
    const { b } = mine(s, 0, 0);
    const p = s.players[0];
    const gold0 = p.res.gold;
    applyCommand(s, { t: 'deepen', p: 0, building: b.id, blast: true });
    expect(depthOf(b)).toBe(0);
    expect(p.res.gold).toBe(gold0);
    p.age = 'gunpowder';
    p.epoch = SHAFT.blastAge;
    applyCommand(s, { t: 'deepen', p: 0, building: b.id, blast: true });
    expect(depthOf(b)).toBe(1);
    expect(b.deepening).toBeUndefined();
    expect(p.res.gold).toBe(gold0 - (STRATA[1].blast.gold ?? 0));
  });

  it('firedamp brings down the layer above on its miners; props there make it rarer', () => {
    const fire = (v: number, shored: number) => () => {
      const was = [SHAFT.firedamp, SHAFT.firedampShored];
      SHAFT.firedamp = v;
      SHAFT.firedampShored = shored;
      return () => ([SHAFT.firedamp, SHAFT.firedampShored] = was);
    };
    withOdds(fire(1, 0), () => {
      const s = game();
      const { b, us } = mine(s, 2, 1);
      s.players[0].age = 'gunpowder';
      s.players[0].epoch = SHAFT.blastAge;
      b.seam = 'stone';
      run(s, 8);
      for (const u of us) if (u.order.k === 'shaft') Object.assign(u.order, { layer: 1, phase: 'work' });
      const seen: GameEvent[] = [];
      applyCommand(s, { t: 'deepen', p: 0, building: b.id, blast: true });
      seen.push(...s.events);
      expect(depthOf(b)).toBe(2);
      const cave = seen.find((e) => e.k === 'caveIn');
      expect(cave && cave.k === 'caveIn' && cave.why).toBe('firedamp');
      expect(cave && cave.k === 'caveIn' && cave.layer).toBe(1);
      expect(us.every((u) => !alive(u))).toBe(true);
      expect(shutAt(s, b, 1)).toBe(true);
    });
    withOdds(fire(1, 0), () => {
      const s = game();
      const { b } = mine(s, 0, 1);
      s.players[0].age = 'gunpowder';
      s.players[0].epoch = SHAFT.blastAge;
      b.propped = [false, true];
      s.events = [];
      applyCommand(s, { t: 'deepen', p: 0, building: b.id, blast: true });
      expect(depthOf(b)).toBe(2);
      expect(s.events.some((e) => e.k === 'caveIn')).toBe(false);
    });
  });
});

describe('the pithead as a target (#924 m2)', () => {
  it('a fallen pithead strands its miners: those below the first layer die, those in it climb out hurt', () => {
    const s = game();
    const { b, us } = mine(s, 3, 1);
    b.seam = 'stone';
    run(s, 8);
    const [top, low1, low2] = us;
    const hp0 = top.hp;
    for (const [u, l] of [[top, 0], [low1, 1], [low2, 1]] as [Unit, number][]) if (u.order.k === 'shaft') Object.assign(u.order, { layer: l, phase: 'work' });
    b.hp = 0;
    const seen = run(s, 1);
    expect(alive(low1) || alive(low2)).toBe(false);
    expect(alive(top)).toBe(true);
    expect(top.hp).toBeLessThan(hp0);
    const cave = seen.find((e) => e.k === 'caveIn');
    expect(cave && cave.k === 'caveIn' && cave.why).toBe('stranded');
    expect(cave && cave.k === 'caveIn' && cave.dead).toBe(2);
    expect(layerOf(top)).toBeUndefined();
  });

  it('a hurt winch slows the haul from below the first layer, not from the first', () => {
    const s = game();
    const { b } = mine(s, 0, 2);
    const u = spawnUnit(s, 0, 'citizen', b.x, b.y + 2);
    const pace = (layer: number) => {
      u.frac = 0;
      u.carry = 0;
      digAt(s, b, 'gold', layer, 1, u);
      return u.carry + u.frac;
    };
    const whole = [pace(0), pace(1), pace(2)];
    b.hp = maxHp(s, b) * SHAFT.winchHurt * 0.5;
    expect(pace(0)).toBeCloseTo(whole[0]);
    expect(pace(1)).toBeCloseTo(whole[1] * SHAFT.winchSlow);
    expect(pace(2)).toBeCloseTo(whole[2] * SHAFT.winchSlow);
    // A shallow shaft has no winch to hurt.
    b.depth = 1;
    expect(pace(1)).toBeCloseTo(digShare(s, b, 'gold', 1));
  });
});

describe('the computer and the deep mine (#924 m2)', () => {
  const setup = (epoch: number, age: string) => {
    const s = createGame({ seed: 2, size: 'small', players: [{ name: 'A', ai: 'hard', civ: 'greeks' }, { name: 'B', ai: null, civ: 'greeks' }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    p.age = age as typeof p.age;
    p.epoch = epoch;
    p.res = { food: 3000, wood: 3000, stone: 0, gold: 3000 };
    for (let i = 0; i < 24; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
    placeBuilding(s, 0, 'storehouse', p.startX + 5, p.startY + 5, true);
    for (let i = 0; i < s.res.length; i++) if (s.res[i] === R_STONE || s.res[i] === R_GOLD) clearResource(s, i);
    s.tick = secs(600);
    s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: {} };
    return s;
  };
  const shafts = (s: GameState) => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'shaft');

  it('shores the layers its shafts reach below the first', () => {
    const s = setup(1, 'bronze');
    const shored = () => shafts(s).some((b) => depthOf(b) > 0 && safeAt(b, 1));
    for (let i = 0; i < secs(700) && !s.over && !shored(); i++) step(s);
    expect(shored()).toBe(true);
  });

  it('marks a rival\'s deep pithead it has seen for a raid, not a shallow one', () => {
    const s = game();
    const { b } = mine(s, 0, 0);
    const q = s.players[1];
    const home = { x: b.x + 6, y: b.y };
    q.seen[Math.floor(b.y) * s.w + Math.floor(b.x)] = 1;
    expect(rivalPithead(s, q, home)).toBeNull();
    b.depth = 1;
    expect(rivalPithead(s, q, home)?.id).toBe(b.id);
  });

  it('blasts its shafts deeper in the Gunpowder Age, with the gold to spare', () => {
    const s = setup(SHAFT.blastAge, 'gunpowder');
    const seen: GameEvent[] = [];
    for (let i = 0; i < secs(700) && !s.over && !seen.some((e) => e.k === 'blast' && e.owner === 0); i++) {
      step(s);
      seen.push(...s.events);
    }
    expect(seen.some((e) => e.k === 'blast' && e.owner === 0)).toBe(true);
  });
});
