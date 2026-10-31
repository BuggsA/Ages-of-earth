import { describe, expect, it } from 'vitest';
import { AGES, CRYSTAL, LODES, MARKET, SHAFT, STRATA, VENT, secs } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { createGame, step } from '../src/sim/game';
import { clearResource, placeProblem } from '../src/sim/grid';
import { findSpot } from '../src/sim/ai';
import { forgeAt, forgeHot } from '../src/sim/forge';
import { deserialize, serialize } from '../src/sim/save';
import {
  airAt, atFace, bearsAt, boundLayer, deepenProblem, depthOf, digShare, fanProblem, fanning, hotLayer, placeFor, seamOf, seamProblem, seamsAt, shaftShare, veinFull, ventilated, wetLayer,
} from '../src/sim/shafts';
import { coreTip } from '../src/ui/cutaway';
import { maxHp, placeBuilding, restat, spawnUnit } from '../src/sim/world';
import { R_GOLD, R_STONE, T_ROCK } from '../src/sim/types';
import type { Building, GameEvent, GameState, Unit } from '../src/sim/types';

/** The deep mine m5 (#924, #939): the hot deep, its crystal and glowcaps, its air on the match's dice, and the fan. */

const HOT = hotLayer();
const WET = wetLayer();

const game = (seed = 3, ai: 'hard' | null = null): GameState => {
  const s = createGame({ seed, size: 'small', players: [{ name: 'A', ai, civ: 'greeks' }, { name: 'B', ai: null }] });
  s.peaceUntil = 1e9;
  const p = s.players[0];
  p.age = 'industrial';
  p.epoch = 4;
  p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
  return s;
};

/** A free 2×2 site by player 0's start on plain earth, with room for a Storehouse beside it. */
function site(s: GameState, x = s.players[0].startX, y = s.players[0].startY): { tx: number; ty: number } {
  const clear = (tx: number, ty: number) => {
    for (let yy = ty - SHAFT.near; yy < ty + 2 + SHAFT.near; yy++)
      for (let xx = tx - SHAFT.near; xx < tx + 2 + SHAFT.near; xx++) {
        const i = yy * s.w + xx;
        if (xx < 0 || yy < 0 || xx >= s.w || yy >= s.h || s.terrain[i] === T_ROCK || s.res[i] === R_STONE || s.res[i] === R_GOLD) return false;
      }
    return true;
  };
  const spot = findSpot(s, 'shaft', x, y, 6, 30, 1, (tx, ty) => clear(tx, ty) && !placeProblem(s, 'storehouse', tx + 3, ty, true, 0));
  if (!spot) throw new Error('no site');
  return spot;
}

/** A finished shaft sunk to `depth`, pumped, a Storehouse beside it, its seam set, worked by `n` citizens. */
function mine(s: GameState, n: number, depth = HOT, seam: 'stone' | 'gold' | 'crystal' | 'glowcap' = 'gold', at = site(s)): { b: Building; us: Unit[] } {
  const b = placeBuilding(s, 0, 'shaft', at.tx, at.ty, true);
  placeBuilding(s, 0, 'storehouse', at.tx + 3, at.ty, true);
  b.depth = depth;
  b.seam = seam;
  b.pump = 'steam';
  const us: Unit[] = [];
  for (let i = 0; i < n; i++) us.push(spawnUnit(s, 0, 'citizen', at.tx - 0.6, at.ty + 0.5 + i * 0.3));
  if (us.length) applyCommand(s, { t: 'work', p: 0, ids: us.map((u) => u.id), target: b.id });
  return { b, us };
}

function run(s: GameState, sec: number, seen: GameEvent[] = []): GameEvent[] {
  for (let i = 0; i < secs(sec); i++) {
    step(s);
    seen.push(...s.events);
  }
  return seen;
}

/** Run with some of `SHAFT`'s numbers set for the test, putting them back after. */
function withShaft<T>(set: Partial<typeof SHAFT>, f: () => T): T {
  const was = Object.fromEntries(Object.keys(set).map((k) => [k, SHAFT[k as keyof typeof SHAFT]]));
  Object.assign(SHAFT, set);
  try {
    return f();
  } finally {
    Object.assign(SHAFT, was);
  }
}

const layerOf = (u: Unit) => (u.order.k === 'shaft' ? u.order.layer : undefined);

/** Send every miner of the shaft not yet in the hot deep down there by hand, as the cut-away's click does. */
function crowd(s: GameState, b: Building, us: Unit[]): void {
  for (let i = 0; i < us.length; i++) applyCommand(s, { t: 'toLayer', p: 0, building: b.id, layer: HOT });
}

describe('the hot deep (#924 m5)', () => {
  it('is the layer below the wet deep, reached from the Industrial Age: crystal and glowcaps lie there, crystal nowhere else', () => {
    expect(HOT).toBe(WET + 1);
    expect(HOT).toBe(STRATA.length - 1);
    const L = STRATA[HOT];
    expect(L.foul).toBeGreaterThan(0);
    expect(L.fill).toBe(0);
    expect(L.epoch).toBe(4);
    expect(L.veins.crystal ?? 0).toBeGreaterThan(0);
    expect(L.veins.glowcap ?? 0).toBeGreaterThan(0);
    for (let l = 0; l < HOT; l++) {
      expect(STRATA[l].foul).toBe(0);
      expect(STRATA[l].veins.crystal ?? 0).toBe(0);
      expect(STRATA[l].veins.glowcap ?? 0).toBe(0);
    }
    // Every kind of ground holds both, some more than others.
    for (const k of LODES) {
      expect(k.crystal).toBeGreaterThan(0);
      expect(k.caps).toBeGreaterThan(0);
    }
    expect(new Set(LODES.map((k) => k.crystal)).size).toBeGreaterThan(1);
    expect(new Set(LODES.map((k) => k.caps)).size).toBeGreaterThan(1);
    // A core shows what lies there and how the air stands.
    expect(coreTip(0)).toMatch(/crystal/i);
    expect(coreTip(0)).toMatch(/air/i);
  });

  it('crystal and glowcaps are refused until the shaft reaches the hot deep, never a shaft\'s default, and dug only there', () => {
    const s = game();
    const { b } = mine(s, 0, WET);
    expect(seamProblem(s, b, 'crystal')).toMatch(/hot deep/i);
    expect(seamProblem(s, b, 'glowcap')).toMatch(/hot deep/i);
    expect(seamsAt(s, b)).not.toContain('crystal');
    b.depth = HOT;
    expect(seamProblem(s, b, 'crystal')).toBeNull();
    expect(seamProblem(s, b, 'glowcap')).toBeNull();
    expect(seamsAt(s, b)).toEqual(expect.arrayContaining(['crystal', 'glowcap']));
    expect(boundLayer(s, b, 'crystal')).toBe(HOT);
    expect(boundLayer(s, b, 'glowcap')).toBe(HOT);
    delete b.seam;
    expect(seamOf(s, b)).not.toBe('crystal');
    expect(seamOf(s, b)).not.toBe('glowcap');
    // Never below the plain grade where its vein lies, and nothing above it.
    expect(digShare(s, b, 'crystal', HOT)).toBeGreaterThan(0);
    expect(digShare(s, b, 'crystal', WET)).toBe(0);
    // Spent, a crystal shaft goes back to its ground's best seam.
    b.seam = 'crystal';
    b.worked = STRATA.map(() => ({}));
    b.worked[HOT] = { crystal: veinFull(b, HOT, 'crystal') };
    expect(seamProblem(s, b, 'crystal')).toMatch(/dug out/);
    expect(seamOf(s, b)).not.toBe('crystal');
  });

  it('never worse than the plain shaft (rule 1): a spent hot layer digs at the plain grade, and its air always bears one miner', () => {
    const s = game();
    const { b } = mine(s, 0);
    const floor = shaftShare(s, b, 'gold');
    b.worked = STRATA.map((_, l) => ({ gold: veinFull(b, l, 'gold'), stone: veinFull(b, l, 'stone') }));
    b.propped = STRATA.map(() => true);
    expect(digShare(s, b, 'gold', HOT)).toBe(floor);
    expect(SHAFT.bears).toBeGreaterThanOrEqual(1);
    expect(bearsAt(s, b, HOT)).toBe(SHAFT.bears);
  });

  it('by default takes only as many miners as its air bears; one alone keeps it clear for good', () => {
    const s = game();
    const { b, us } = mine(s, 4, HOT, 'gold');
    b.propped = STRATA.map(() => true);
    const seen = run(s, 150);
    expect(us.filter((u) => layerOf(u) === HOT).length).toBe(SHAFT.bears);
    expect(airAt(b, HOT)).toBe(0);
    expect(seen.some((e) => e.k === 'choke')).toBe(false);
    expect(us.every((u) => u.hp > 0)).toBe(true);
    // The rest dig the ground's best seam above, as when a seam's layer is full.
    expect(us.filter((u) => layerOf(u) !== undefined && layerOf(u)! < HOT).length).toBeGreaterThan(0);
  });

  it('crowded by hand, the air fouls with every miner past what it bears, and overcomes those at the face on the match\'s dice', () => {
    withShaft({ choke: 0.5 }, () => {
      const s = game();
      const { b, us } = mine(s, 4, HOT, 'gold');
      b.propped = STRATA.map(() => true);
      run(s, 4);
      crowd(s, b, us);
      let peak = 0;
      const seen: GameEvent[] = [];
      for (let i = 0; i < secs(240) && !seen.some((e) => e.k === 'choke'); i++) {
        step(s);
        seen.push(...s.events);
        peak = Math.max(peak, atFace(s, b, HOT));
      }
      expect(peak).toBeGreaterThan(SHAFT.bears);
      const ch = seen.find((e) => e.k === 'choke');
      expect(ch && ch.k === 'choke' && ch.layer).toBe(HOT);
      if (!ch || ch.k !== 'choke') return;
      expect(ch.dead + ch.up).toBeGreaterThan(0);
      expect(us.filter((u) => u.hp <= 0).length).toBe(ch.dead);
      // The survivors were carried up hurt; the layer is foul and takes no one until it clears.
      for (const u of us) if (u.hp > 0 && u.order.k === 'shaft' && u.hp < maxHp(s, u)) expect(layerOf(u)).not.toBe(HOT);
      expect(airAt(b, HOT)).toBe(1);
      const u = us.find((x) => x.hp > 0)!;
      expect(placeFor(s, b, u, 'gold', HOT, true)).not.toBe(HOT);
      // With nobody breathing it, the air clears, and the layer opens again once under `SHAFT.airOpen`.
      run(s, STRATA[HOT].foul / SHAFT.bears);
      expect(airAt(b, HOT)).toBeLessThan(SHAFT.airOpen);
    });
  });

  it('the air plays out the same on the same seed', () => {
    const play = () => {
      const s = game(5);
      const { b, us } = mine(s, 4, HOT, 'gold');
      b.propped = STRATA.map(() => true);
      run(s, 4);
      crowd(s, b, us);
      const seen = run(s, 200);
      return JSON.stringify([seen.filter((e) => e.k === 'choke'), us.map((u) => u.hp), b.air]);
    };
    expect(play()).toBe(play());
  });

  it('a fan comes with the Industrial Age, near the hot deep; it lets the layer bear its whole room, and a hurt pithead stalls it', () => {
    const s = game();
    const { b, us } = mine(s, 4, WET - 1, 'gold');
    b.propped = STRATA.map(() => true);
    expect(fanProblem(s, b)).toMatch(/nears the hot deep/);
    b.depth = WET;
    const p = s.players[0];
    p.epoch = 3;
    expect(fanProblem(s, b)).toMatch(/Industrial/);
    p.epoch = 4;
    expect(fanProblem(s, b)).toBeNull();
    const wood = p.res.wood;
    applyCommand(s, { t: 'fan', p: 0, building: b.id });
    expect(b.fan).toBe(true);
    expect(p.res.wood).toBe(wood - SHAFT.fan.wood!);
    applyCommand(s, { t: 'fan', p: 0, building: b.id });
    expect(p.res.wood).toBe(wood - SHAFT.fan.wood!);
    b.depth = HOT;
    expect(bearsAt(s, b, HOT)).toBe(STRATA[HOT].room);
    // Ventilated, the default sends a full face down, and the air stays clear.
    const seen = run(s, 150);
    expect(us.filter((u) => layerOf(u) === HOT).length).toBe(STRATA[HOT].room);
    expect(airAt(b, HOT)).toBe(0);
    expect(seen.some((e) => e.k === 'choke')).toBe(false);
    // A hurt pithead's fan stalls: the full face now fouls its air.
    b.hp = maxHp(s, b) * SHAFT.winchHurt - 1;
    expect(fanning(s, b)).toBe(false);
    expect(bearsAt(s, b, HOT)).toBe(SHAFT.bears);
    run(s, 10);
    expect(airAt(b, HOT)).toBeGreaterThan(0);
  });

  it('on the Deep Road, a hot Vent Forge in reach draws the air instead, and goes cold when a rival holds its vent', () => {
    const s = game(2);
    const p = s.players[0];
    restat(s, p, () => {
      p.epoch = AGES.forges.tier;
      p.age = 'forges';
    });
    p.walked = ['megaliths', 'delvings', 'undercity'];
    const at = forgeAt(s, s.vents![0]);
    expect(placeProblem(s, 'ventforge', at.tx, at.ty, true, 0)).toBeNull();
    const f = placeBuilding(s, 0, 'ventforge', at.tx, at.ty, true);
    expect(forgeHot(s, f)).toBe(true);
    const near = site(s, f.x, f.y);
    const { b } = mine(s, 0, HOT, 'gold', near);
    const dx = b.x - f.x;
    const dy = b.y - f.y;
    expect(dx * dx + dy * dy).toBeLessThanOrEqual(VENT.reach * VENT.reach);
    expect(b.fan).toBeUndefined();
    expect(ventilated(s, b)).toBe(true);
    expect(bearsAt(s, b, HOT)).toBe(STRATA[HOT].room);
    f.held = true;
    expect(ventilated(s, b)).toBe(false);
    expect(bearsAt(s, b, HOT)).toBe(SHAFT.bears);
  });

  it('a flooded wet deep bars the way down: nothing is sunk below it, nobody goes below it, and those below are driven up', () => {
    const s = game();
    const { b, us } = mine(s, 4, HOT, 'crystal');
    b.fan = true;
    run(s, 60);
    expect(us.some((u) => layerOf(u) === HOT && u.order.k === 'shaft' && u.order.phase === 'work')).toBe(true);
    // The pump goes: the wet deep fills, and the hot deep below is cut off.
    delete b.pump;
    const seen = run(s, STRATA[WET].fill + 5);
    const fl = seen.find((e) => e.k === 'flood');
    expect(fl && fl.k === 'flood' && fl.up).toBeGreaterThan(0);
    expect(us.filter((u) => u.hp > 0).every((u) => layerOf(u) !== HOT)).toBe(true);
    b.worked![HOT] = {};
    expect(seamProblem(s, b, 'crystal')).toMatch(/flooded/);
    expect(seamOf(s, b)).not.toBe('crystal');
    b.depth = WET;
    expect(deepenProblem(s, b)).toMatch(/flooded/);
    b.depth = HOT;
    const u = us.find((x) => x.hp > 0)!;
    expect(placeFor(s, b, u, 'gold', HOT, true)).not.toBe(HOT);
  });
});

describe('crystal (#924 m5)', () => {
  it('is dug in the hot deep, scaled by the ground, and kept apart from the four stocks', () => {
    const s = game();
    const { b } = mine(s, 1, HOT, 'crystal');
    const p = s.players[0];
    const stone = p.res.stone;
    run(s, 150);
    expect(p.crystal ?? 0).toBeGreaterThan(0);
    expect(p.res.stone).toBe(stone);
    expect(b.worked?.[HOT]?.crystal ?? 0).toBeGreaterThan(0);
    // The ground scales the vein.
    const rock = LODES.findIndex((k) => k.name === 'Sound rock');
    expect(veinFull({ lode: rock }, HOT, 'crystal')).toBe(Math.round(STRATA[HOT].veins.crystal! * LODES[rock].crystal));
  });

  it('glowcaps from the hot deep are paid into the rare stock, toward their doors', () => {
    const s = game();
    mine(s, 1, HOT, 'glowcap');
    const p = s.players[0];
    run(s, 150);
    expect(p.rare?.glowcap ?? 0).toBeGreaterThan(0);
    expect(p.stats.mined?.glowcap ?? 0).toBeGreaterThan(0);
  });

  it('a lot barters at the Market for a stock at its opening price, moving no price; never sold for gold', () => {
    const s = game();
    const p = s.players[0];
    p.crystal = CRYSTAL.lot * 2 + 3;
    // No Market: refused.
    applyCommand(s, { t: 'trade', p: 0, res: 'wood', buy: true, crystal: true });
    expect(p.crystal).toBe(CRYSTAL.lot * 2 + 3);
    const at = site(s);
    placeBuilding(s, 0, 'market', at.tx, at.ty, true);
    s.market.wood = 400;
    const wood = p.res.wood;
    const gold = p.res.gold;
    applyCommand(s, { t: 'trade', p: 0, res: 'wood', buy: true, crystal: true });
    expect(p.crystal).toBe(CRYSTAL.lot + 3);
    expect(p.res.wood).toBe(wood + CRYSTAL.buys);
    expect(p.res.gold).toBe(gold);
    expect(s.market.wood).toBe(400);
    // Not for gold, nor sold; nor without a lot in hand.
    applyCommand(s, { t: 'trade', p: 0, res: 'wood', buy: false, crystal: true });
    expect(p.crystal).toBe(CRYSTAL.lot + 3);
    applyCommand(s, { t: 'trade', p: 0, res: 'stone', buy: true, crystal: true });
    applyCommand(s, { t: 'trade', p: 0, res: 'stone', buy: true, crystal: true });
    expect(p.crystal).toBe(3);
    expect(p.res.stone).toBe(5000 + CRYSTAL.buys);
    expect(s.market.stone).toBe(MARKET.start.stone);
  });

  it('keeps the air, the fan and the crystal; an older save\'s shaft breathes clear with no fan', () => {
    const s = game();
    const { b } = mine(s, 0);
    b.fan = true;
    b.air = [0, 0, 0, 0, 0.4];
    s.players[0].crystal = 37;
    const t = deserialize(serialize(s));
    const b2 = t.byId.get(b.id) as Building;
    expect(b2.fan).toBe(true);
    expect(airAt(b2, HOT)).toBeCloseTo(0.4);
    expect(t.players[0].crystal).toBe(37);
    delete b2.air;
    delete b2.fan;
    expect(airAt(b2, HOT)).toBe(0);
    expect(fanning(t, b2)).toBe(false);
    expect(depthOf(b2)).toBe(HOT);
  });
});

describe('the computer in the hot deep (#924 m5)', () => {
  it('raises a fan, digs crystal, and barters it at its Market', () => {
    const s = game(2, 'hard');
    const p = s.players[0];
    for (let i = 0; i < s.res.length; i++) if (s.res[i] === R_STONE || s.res[i] === R_GOLD) clearResource(s, i);
    const { b } = mine(s, 3, HOT, 'gold');
    b.propped = STRATA.map(() => true);
    const at = site(s);
    placeBuilding(s, 0, 'market', at.tx, at.ty, true);
    s.tick = secs(600);
    s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: {} };
    let bartered = false;
    for (let i = 0; i < secs(400) && !bartered; i++) {
      step(s);
      if (s.events.some((e) => e.k === 'trade' && e.owner === 0 && e.crystal)) bartered = true;
    }
    expect(b.fan).toBe(true);
    expect(seamOf(s, b)).toBe('crystal');
    expect(bartered).toBe(true);
    expect(p.crystal ?? 0).toBeLessThan(CRYSTAL.lot);
  });
});
