import { describe, expect, it } from 'vitest';
import { GEMS, LODES, MARKET, SHAFT, STRATA, secs } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { createGame, step } from '../src/sim/game';
import { clearResource, placeProblem } from '../src/sim/grid';
import { findSpot } from '../src/sim/ai';
import { deserialize, serialize } from '../src/sim/save';
import { crewOf, depthOf, digShare, fillOf, floodedAt, placeFor, pumping, seamOf, seamProblem, shaftShare, veinFull, waterAt, wetLayer } from '../src/sim/shafts';
import { coreTip } from '../src/ui/cutaway';
import { maxHp, placeBuilding, spawnUnit } from '../src/sim/world';
import { R_GOLD, R_STONE, T_ROCK } from '../src/sim/types';
import type { Building, GameEvent, GameState, Unit } from '../src/sim/types';

/** The deep mine m4 (#924, #937): the wet deep, its gems, floods on the match's dice, and the pump. */

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

/** A finished shaft sunk to `depth`, a Storehouse beside it, its seam set, worked by `n` citizens. */
function mine(s: GameState, n: number, depth = WET, seam: 'stone' | 'gold' | 'gems' = 'gold'): { b: Building; us: Unit[] } {
  const at = site(s);
  const b = placeBuilding(s, 0, 'shaft', at.tx, at.ty, true);
  placeBuilding(s, 0, 'storehouse', at.tx + 3, at.ty, true);
  b.depth = depth;
  b.seam = seam;
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

/** Run with some of `SHAFT`'s odds set for the test, putting them back after. */
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

describe('the wet deep (#924 m4)', () => {
  it('is the layer below the vein: gems lie there and nowhere else, reached from the Gunpowder Age', () => {
    expect(WET).toBe(3);
    const L = STRATA[WET];
    expect(L.fill).toBeGreaterThan(0);
    expect(L.epoch).toBe(3);
    expect(L.veins.gems ?? 0).toBeGreaterThan(0);
    for (let l = 0; l < WET; l++) {
      expect(STRATA[l].fill).toBe(0);
      expect(STRATA[l].veins.gems ?? 0).toBe(0);
    }
    // Every kind of ground floods and holds gems, some more than others.
    for (const k of LODES) {
      expect(k.wet).toBeGreaterThan(0);
      expect(k.gems).toBeGreaterThan(0);
    }
  });

  it('gems are refused until the shaft reaches the wet deep, never a shaft\'s default, and never below the plain grade elsewhere', () => {
    const s = game();
    const { b } = mine(s, 0, WET - 1);
    expect(seamProblem(s, b, 'gems')).toMatch(/wet deep/);
    b.depth = WET;
    expect(seamProblem(s, b, 'gems')).toBeNull();
    delete b.seam;
    expect(seamOf(s, b)).not.toBe('gems');
    // Gold in the wet deep: never under the plain grade, even when its vein is spent.
    b.worked = [];
    b.worked[WET] = { gold: veinFull(b, WET, 'gold') };
    expect(digShare(s, b, 'gold', WET)).toBeGreaterThanOrEqual(shaftShare(s, b, 'gold'));
  });

  it('the water rises unpumped, to the roof in the layer\'s fill time, sooner on wet ground; flooded, it drives its miners up and takes no one', () => {
    const s = game();
    const { b, us } = mine(s, 2, WET, 'gold');
    expect(fillOf(b, WET)).toBeCloseTo(STRATA[WET].fill);
    expect(fillOf({ lode: LODES.findIndex((k) => k.name === 'Shattered ground') }, WET)).toBeLessThan(fillOf({ lode: LODES.findIndex((k) => k.name === 'Sound rock') }, WET));
    // No inrush for this test: the water only rises.
    withShaft({ inrush: 0 }, () => {
      run(s, 20);
      expect(waterAt(b, WET)).toBeGreaterThan(0);
      expect(waterAt(b, WET)).toBeLessThan(1);
      for (const u of us) if (u.order.k === 'shaft') Object.assign(u.order, { layer: WET, phase: 'work' });
      const seen = run(s, STRATA[WET].fill);
      expect(floodedAt(b, WET)).toBe(true);
      const ev = seen.find((e) => e.k === 'flood');
      expect(ev && ev.k === 'flood' && ev.why).toBe('rose');
      expect(ev && ev.k === 'flood' && ev.dead).toBe(0);
      // Driven up whole, and none goes back down while it is flooded.
      expect(us.every((u) => u.hp === maxHp(s, u))).toBe(true);
      expect(us.every((u) => layerOf(u) !== WET)).toBe(true);
      expect(crewOf(s, b).at[WET]).toBe(0);
      expect(placeFor(s, b, us[0], 'gold', WET)).not.toBe(WET);
    });
  });

  it('an inrush comes on a full basket on the match\'s dice: miners at the face drown, or climb out hurt', () => {
    withShaft({ inrush: 1, drown: 1 }, () => {
      const s = game();
      const { b, us } = mine(s, 2, WET, 'gold');
      b.water = [0, 0, 0, 0.6];
      run(s, 4);
      for (const u of us) if (u.order.k === 'shaft') Object.assign(u.order, { layer: WET, phase: 'work' });
      const seen = run(s, 40);
      const ev = seen.find((e) => e.k === 'flood');
      expect(ev && ev.k === 'flood' && ev.why).toBe('inrush');
      expect(us.every((u) => u.hp <= 0)).toBe(true);
      expect(floodedAt(b, WET)).toBe(true);
    });
    withShaft({ inrush: 1, drown: 0 }, () => {
      const s = game();
      const { b, us } = mine(s, 2, WET, 'gold');
      b.water = [0, 0, 0, 0.6];
      run(s, 4);
      for (const u of us) if (u.order.k === 'shaft') Object.assign(u.order, { layer: WET, phase: 'work' });
      const seen = run(s, 40);
      const ev = seen.find((e) => e.k === 'flood');
      expect(ev && ev.k === 'flood' && ev.up).toBe(2);
      expect(us.every((u) => u.hp > 0 && u.hp < maxHp(s, u))).toBe(true);
    });
    // Dry, no basket risks anything.
    withShaft({ inrush: 1, drown: 1 }, () => {
      const s = game();
      const { b, us } = mine(s, 2, WET - 1, 'gold');
      const seen = run(s, 60);
      expect(seen.some((e) => e.k === 'flood')).toBe(false);
      expect(us.every((u) => u.hp > 0)).toBe(true);
      expect(waterAt(b, WET)).toBe(0);
    });
  });

  it('floods play out the same on the same seed', () => {
    const once = () =>
      withShaft({ inrush: 0.6, drown: 0.5 }, () => {
        const s = game(5);
        const { b, us } = mine(s, 3, WET, 'gold');
        b.water = [0, 0, 0, 0.5];
        run(s, 4);
        for (const u of us) if (u.order.k === 'shaft') Object.assign(u.order, { layer: WET, phase: 'work' });
        const seen = run(s, 60);
        return JSON.stringify([seen.filter((e) => e.k === 'flood'), us.map((u) => u.hp), b.water]);
      });
    expect(once()).toBe(once());
  });
});

describe('the pump (#924 m4)', () => {
  it('a steam pump waits on the Industrial Age; a people that walked the Age of Dykes raises a windmill pump sooner, for less', () => {
    const s = game();
    const p = s.players[0];
    p.age = 'gunpowder';
    p.epoch = 3;
    const { b } = mine(s, 0, WET, 'gold');
    const wood0 = p.res.wood;
    applyCommand(s, { t: 'pump', p: 0, building: b.id });
    expect(b.pump).toBeUndefined();
    expect(p.res.wood).toBe(wood0);
    p.walked = ['dykes'];
    applyCommand(s, { t: 'pump', p: 0, building: b.id });
    expect(b.pump).toBe('mill');
    expect(p.res.wood).toBe(wood0 - (SHAFT.mill.wood ?? 0));
    expect(Object.values(SHAFT.mill).reduce((a, n) => a + (n ?? 0), 0)).toBeLessThan(Object.values(SHAFT.pump).reduce((a, n) => a + (n ?? 0), 0));
    // A second is refused; another people may not raise one on this shaft.
    applyCommand(s, { t: 'pump', p: 0, building: b.id });
    expect(p.res.wood).toBe(wood0 - (SHAFT.mill.wood ?? 0));
    const s2 = game();
    const { b: b2 } = mine(s2, 0, WET, 'gold');
    applyCommand(s2, { t: 'pump', p: 1, building: b2.id });
    expect(b2.pump).toBeUndefined();
    applyCommand(s2, { t: 'pump', p: 0, building: b2.id });
    expect(b2.pump).toBe('steam');
    expect(s2.players[0].res.gold).toBe(5000 - (SHAFT.pump.gold ?? 0));
  });

  it('drains a flooded layer in its drain time and keeps it dry; a hurt pithead stalls it and the water rises again', () => {
    const s = game();
    const { b } = mine(s, 0, WET, 'gold');
    b.water = [0, 0, 0, 1];
    applyCommand(s, { t: 'pump', p: 0, building: b.id });
    expect(pumping(s, b)).toBe(true);
    run(s, SHAFT.drain / 2);
    expect(waterAt(b, WET)).toBeGreaterThan(0.3);
    expect(waterAt(b, WET)).toBeLessThan(0.7);
    expect(floodedAt(b, WET)).toBe(false);
    run(s, SHAFT.drain / 2 + 2);
    expect(waterAt(b, WET)).toBe(0);
    run(s, 60);
    expect(waterAt(b, WET)).toBe(0);
    b.hp = maxHp(s, b) * SHAFT.winchHurt - 1;
    expect(pumping(s, b)).toBe(false);
    run(s, 20);
    expect(waterAt(b, WET)).toBeGreaterThan(0);
  });

  it('is shown and refused only where it means something', () => {
    const s = game();
    const { b } = mine(s, 0, 0, 'stone');
    applyCommand(s, { t: 'pump', p: 0, building: b.id });
    expect(b.pump).toBeUndefined();
    // From the layer above the wet one, ahead of breaking in.
    b.depth = WET - 1;
    applyCommand(s, { t: 'pump', p: 0, building: b.id });
    expect(b.pump).toBe('steam');
  });
});

describe('gems (#924 m4)', () => {
  it('are cut in the wet deep, scaled by the ground, and kept apart from the four stocks', () => {
    const s = game();
    const p = s.players[0];
    const { b } = mine(s, 3, WET, 'gems');
    b.pump = 'steam';
    const gold0 = p.res.gold;
    run(s, 150);
    expect(p.gems ?? 0).toBeGreaterThan(0);
    expect(p.res.gold).toBe(gold0);
    expect(b.worked?.[WET]?.gems ?? 0).toBeGreaterThan(0);
    const reef = LODES.findIndex((k) => k.name === 'A gold reef');
    expect(veinFull({ lode: reef }, WET, 'gems')).toBeGreaterThan(veinFull({}, WET, 'gems'));
    // A core reads the wet deep: how fast it floods, and its gems.
    expect(coreTip(reef)).toMatch(/floods in \d+s/);
    expect(coreTip(reef)).toMatch(/gems/);
  });

  it('a flooded wet deep sends a gem shaft back to its ground\'s best seam, and to the gems again once pumped dry', () => {
    const s = game();
    const { b } = mine(s, 0, WET, 'gems');
    expect(seamOf(s, b)).toBe('gems');
    b.water = [0, 0, 0, 1];
    expect(seamOf(s, b)).not.toBe('gems');
    expect(seamProblem(s, b, 'gems')).toMatch(/flooded/);
    applyCommand(s, { t: 'pump', p: 0, building: b.id });
    run(s, SHAFT.drain + 2);
    expect(seamOf(s, b)).toBe('gems');
  });

  it('sell at the Market by the lot, at a price every seller shares, falling with each lot and climbing back', () => {
    const s = game();
    const [a, z] = s.players;
    a.gems = 2 * GEMS.lot + 5;
    z.gems = GEMS.lot;
    const gold0 = a.res.gold;
    applyCommand(s, { t: 'trade', p: 0, res: 'gems', buy: false });
    expect(a.gems).toBe(2 * GEMS.lot + 5);
    placeBuilding(s, 0, 'market', a.startX + 6, a.startY + 6, true);
    placeBuilding(s, 1, 'market', z.startX + 6, z.startY + 6, true);
    applyCommand(s, { t: 'trade', p: 0, res: 'gems', buy: false });
    expect(a.gems).toBe(GEMS.lot + 5);
    expect(a.res.gold).toBe(gold0 + GEMS.price);
    expect(s.market.gems).toBe(GEMS.price - GEMS.step);
    // A rival's lot cheapens the next one for everyone.
    const zg = z.res.gold;
    applyCommand(s, { t: 'trade', p: 1, res: 'gems', buy: false });
    expect(z.res.gold).toBe(zg + GEMS.price - GEMS.step);
    expect(s.market.gems).toBe(GEMS.price - 2 * GEMS.step);
    // Gems are never bought, and a short lot is refused.
    applyCommand(s, { t: 'trade', p: 0, res: 'gems', buy: true });
    expect(a.gems).toBe(GEMS.lot + 5);
    a.gems = GEMS.lot - 1;
    applyCommand(s, { t: 'trade', p: 0, res: 'gems', buy: false });
    expect(a.gems).toBe(GEMS.lot - 1);
    // The price climbs back to where it started.
    run(s, MARKET.every * (Math.ceil((2 * GEMS.step) / GEMS.recover) + 1));
    expect(s.market.gems ?? GEMS.price).toBe(GEMS.price);
  });

  it('the price never falls below its floor', () => {
    const s = game();
    const a = s.players[0];
    placeBuilding(s, 0, 'market', a.startX + 6, a.startY + 6, true);
    a.gems = 60 * GEMS.lot;
    for (let i = 0; i < 60; i++) applyCommand(s, { t: 'trade', p: 0, res: 'gems', buy: false });
    expect(s.market.gems).toBe(GEMS.min);
  });
});

describe('saves (#924 m4)', () => {
  it('keep the water, the pump, the gems and the gem price; an older save\'s shaft is dry and unpumped', () => {
    const s = game();
    const { b } = mine(s, 0, WET, 'gems');
    b.water = [0, 0, 0, 0.4];
    b.pump = 'mill';
    s.players[0].gems = 33;
    s.market.gems = 90;
    const t = deserialize(serialize(s));
    const c = t.byId.get(b.id) as Building;
    expect(waterAt(c, WET)).toBeCloseTo(0.4);
    expect(c.pump).toBe('mill');
    expect(t.players[0].gems).toBe(33);
    expect(t.market.gems).toBe(90);
    delete c.water;
    delete c.pump;
    expect(waterAt(c, WET)).toBe(0);
    expect(pumping(t, c)).toBe(false);
    expect(depthOf(c)).toBe(WET);
  });
});

describe('the computer in the wet deep (#924 m4)', () => {
  it('pumps its shaft, cuts gems while they pay, and sells them at its Market', () => {
    const s = game(2, 'hard');
    const p = s.players[0];
    p.seen.fill(1);
    for (let i = 0; i < 16; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
    for (let i = 0; i < s.res.length; i++) if (s.res[i] === R_STONE || s.res[i] === R_GOLD) clearResource(s, i);
    const { b } = mine(s, 3, WET, 'gold');
    const at = findSpot(s, 'market', p.startX, p.startY, 4, 20, 1)!;
    placeBuilding(s, 0, 'market', at.tx, at.ty, true);
    s.tick = secs(600);
    s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: {} };
    for (let i = 0; i < secs(300) && !b.pump; i++) step(s);
    expect(b.pump).toBe('steam');
    for (let i = 0; i < secs(120) && b.seam !== 'gems'; i++) step(s);
    expect(b.seam).toBe('gems');
    p.gems = 3 * GEMS.lot;
    for (let i = 0; i < secs(60) && (p.gems ?? 0) >= GEMS.lot; i++) step(s);
    expect(p.gems ?? 0).toBeLessThan(GEMS.lot);
    expect(s.market.gems).toBeLessThan(GEMS.price);
  });

  it('never breaks into the wet deep without a pump', () => {
    const s = game(2, 'hard');
    const p = s.players[0];
    p.age = 'gunpowder';
    p.epoch = 3;
    for (let i = 0; i < s.res.length; i++) if (s.res[i] === R_STONE || s.res[i] === R_GOLD) clearResource(s, i);
    const { b } = mine(s, 2, WET - 1, 'gold');
    b.worked = STRATA.map((_, l) => ({ gold: veinFull(b, l, 'gold'), stone: veinFull(b, l, 'stone') }));
    s.tick = secs(600);
    s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: {} };
    for (let i = 0; i < secs(150); i++) step(s);
    expect(depthOf(b)).toBe(WET - 1);
    expect(b.deepening).toBeUndefined();
    // In the Industrial Age it raises the pump first, then sinks.
    p.age = 'industrial';
    p.epoch = 4;
    p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
    for (let i = 0; i < secs(300) && b.deepening === undefined && depthOf(b) < WET; i++) step(s);
    expect(b.pump).toBe('steam');
    expect(b.deepening !== undefined || depthOf(b) === WET).toBe(true);
  });
});
