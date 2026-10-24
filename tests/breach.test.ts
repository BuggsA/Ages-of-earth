import { describe, expect, it } from 'vitest';
import { wallLine } from '../src/sim/commands';
import { AGES, AI_DYKE, BREACH, KEG, POLDER, buildingHp, secs } from '../src/sim/data';
import { buildBarred } from '../src/sim/ages';
import { kegFirst } from '../src/sim/ai';
import { checksum, createGame, step } from '../src/sim/game';
import { NAVAL, placeProblem, walkable } from '../src/sim/grid';
import { basinOf, dykePlan, floodFront, heldBack, isPolder, seaAt, type DykePlan } from '../src/sim/water';
import type { Building, GameState } from '../src/sim/types';
import { T_GRASS, T_WATER } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The Water Road's breach (#701 s3): a fallen dyke lets the sea back into the polder, tile by tile, until a dyke shuts the gap again. */

const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec) && !s.over; i++) step(s);
};

/** A people in the Age of Dykes with a bay shut off by a dyke line and pumped dry behind it. */
function drained(): { s: GameState; o: number; plan: DykePlan; mill: Building } {
  for (let seed = 1; seed < 30; seed++) {
    const s = createGame({ seed, size: 'medium', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }, { name: 'C', ai: null }] });
    for (const p of s.players) {
      const plan = dykePlan(s, p.startX, p.startY, AI_DYKE.reach, AI_DYKE, wallLine);
      if (!plan || !plan.line.length) continue;
      s.peaceUntil = 1e9;
      s.animals = [];
      restat(s, p, () => {
        p.epoch = AGES.dykes.tier;
        p.age = 'dykes';
      });
      p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
      for (const t of plan.line) placeBuilding(s, p.id, 'dyke', t % s.w, Math.floor(t / s.w), true);
      const spot = millSpot(s, p.id, plan.basin);
      if (!spot) continue;
      const mill = placeBuilding(s, p.id, 'windmill', spot.tx, spot.ty, true);
      run(s, POLDER.every * (plan.basin.length + 3));
      if (!plan.basin.every((t) => isPolder(s, t))) continue;
      return { s, o: p.id, plan, mill };
    }
  }
  throw new Error('no such map');
}

function millSpot(s: GameState, o: number, basin: number[]): { tx: number; ty: number } | null {
  const first = basin[0];
  const bx = first % s.w;
  const by = Math.floor(first / s.w);
  for (let r = 1; r < 12; r++)
    for (let ty = by - r; ty <= by + r; ty++)
      for (let tx = bx - r; tx <= bx + r; tx++) {
        if (placeProblem(s, 'windmill', tx, ty, true, o)) continue;
        if (basinOf(s, { tx, ty, size: 2 }).includes(first)) return { tx, ty };
      }
  return null;
}

const dykeAt = (s: GameState, t: number) => s.byId.get(s.bldAt[t]) as Building;
/** The dyke of the line that holds back the most. */
const keyDyke = (s: GameState, plan: DykePlan) => plan.line.map((t) => dykeAt(s, t)).sort((a, b) => heldBack(s, b) - heldBack(s, a) || a.id - b.id)[0];
const polderLeft = (s: GameState, plan: DykePlan) => plan.basin.filter((t) => isPolder(s, t)).length;

describe('the breach (#701 s3)', () => {
  it('holds while the dykes stand: no polder lies beside the open sea', () => {
    const { s, plan } = drained();
    expect(floodFront(s)).toEqual([]);
    run(s, 5);
    expect(polderLeft(s, plan)).toBe(plan.basin.length);
    // What the line holds back is the polder behind it.
    expect(heldBack(s, keyDyke(s, plan))).toBeGreaterThan(0);
  });

  it('a fallen dyke lets the sea in a ring at a time, nearest the gap first, until the polder is sea again', () => {
    const { s, plan, mill } = drained();
    const gap = keyDyke(s, plan);
    const t = gap.ty * s.w + gap.tx;
    gap.hp = 0;
    run(s, 0.1);
    expect(s.terrain[t]).toBe(T_WATER);
    expect(seaAt(s, t)).toBe(true);
    const front = floodFront(s);
    expect(front.length).toBeGreaterThan(0);
    // The first ring lies right beside the gap or its water.
    run(s, BREACH.every);
    const after1 = polderLeft(s, plan);
    expect(after1).toBeLessThan(plan.basin.length);
    expect(after1).toBeGreaterThan(0);
    for (const f of front) {
      expect(s.terrain[f]).toBe(T_WATER);
      expect(isPolder(s, f)).toBe(false);
      expect(walkable(s, f % s.w, Math.floor(f / s.w), NAVAL)).toBe(true);
    }
    run(s, BREACH.every * (plan.basin.length + 2));
    expect(polderLeft(s, plan)).toBe(0);
    expect(s.flooded).toBe(plan.basin.length);
    // The open sea is too big to pump: the mill stands still.
    expect(basinOf(s, mill)).toEqual([]);
  });

  it('a dyke raised again in the gap stops the flood where it is, and the windmill pumps it out once more', () => {
    const { s, o, plan, mill } = drained();
    const gap = keyDyke(s, plan);
    const tx = gap.tx;
    const ty = gap.ty;
    gap.hp = 0;
    run(s, 0.1 + BREACH.every * 2);
    const left = polderLeft(s, plan);
    expect(left).toBeLessThan(plan.basin.length);
    // A site does not hold the water: only a finished dyke does.
    const site = placeBuilding(s, o, 'dyke', tx, ty, false);
    run(s, BREACH.every * 2);
    expect(polderLeft(s, plan)).toBeLessThan(left);
    site.hp = 0;
    run(s, 0.1);
    placeBuilding(s, o, 'dyke', tx, ty, true);
    // From here the polder only grows again: the flood has stopped, and the mill is at work.
    let held = polderLeft(s, plan);
    for (let k = 0; k < 8; k++) {
      run(s, BREACH.every);
      expect(polderLeft(s, plan)).toBeGreaterThanOrEqual(held);
      held = polderLeft(s, plan);
    }
    expect(mill.hp).toBeGreaterThan(0);
    expect(basinOf(s, mill).length).toBeGreaterThan(0);
    run(s, POLDER.every * (plan.basin.length + 3));
    expect(polderLeft(s, plan)).toBe(plan.basin.length);
  });

  it('drowns what stands on the polder, and sweeps those on it to dry ground', () => {
    const { s, o, plan } = drained();
    // A farm on the polder, and a citizen standing out on it.
    let field: Building | null = null;
    for (const t of plan.basin) {
      const tx = t % s.w;
      const ty = Math.floor(t / s.w);
      if (!placeProblem(s, 'farm', tx, ty, true, o)) {
        field = placeBuilding(s, o, 'farm', tx, ty, true);
        break;
      }
    }
    expect(field).not.toBeNull();
    const far = plan.basin[plan.basin.length - 1];
    const walker = spawnUnit(s, o, 'citizen', (far % s.w) + 0.5, Math.floor(far / s.w) + 0.5);
    walker.order = { k: 'idle' };
    const hp = walker.hp;
    keyDyke(s, plan).hp = 0;
    run(s, 0.1 + BREACH.every * (plan.basin.length + 2));
    expect(field!.hp).toBe(0);
    expect(s.ents.includes(field!)).toBe(false);
    if (walker.hp > 0) {
      expect(s.terrain[Math.floor(walker.y) * s.w + Math.floor(walker.x)]).not.toBe(T_WATER);
      expect(walker.hp).toBeLessThanOrEqual(hp - BREACH.unit);
    }
    expect(s.terrain[far]).toBe(T_WATER);
  });

  it('a Sapper\'s keg tears a dyke open in one blast', () => {
    const { s, o, plan } = drained();
    const gap = keyDyke(s, plan);
    expect(KEG.building * BREACH.keg).toBeGreaterThanOrEqual(buildingHp('dyke', AGES.dykes.tier));
    const rival = s.players.find((p) => p.team !== s.players[o].team)!;
    s.kegs = [{ id: s.nextId++, x: gap.x, y: gap.y, owner: rival.id, at: s.tick + 1 }];
    s.peaceUntil = 0;
    run(s, 0.2);
    expect(gap.hp).toBeLessThanOrEqual(0);
    run(s, BREACH.every * 2);
    expect(polderLeft(s, plan)).toBeLessThan(plan.basin.length);
  });

  it('the Sappers carry their kegs to a dyke holding back polder before anything else', () => {
    const { s, plan } = drained();
    const gap = keyDyke(s, plan);
    expect(kegFirst(s, gap)).toBeLessThan(kegFirst(s, { ...gap, type: 'tower' } as Building));
    expect(kegFirst(s, { ...gap, type: 'towncenter' } as Building)).toBe(0);
  });

  it('a people that walked the Dykes mends its banks in any age after; one that never did, never', () => {
    const { s, o } = drained();
    const p = s.players[o];
    p.walked = ['dykes'];
    restat(s, p, () => {
      p.epoch = AGES.gunpowder.tier;
      p.age = 'gunpowder';
    });
    expect(buildBarred(p, 'dyke')).toBeNull();
    expect(buildBarred(p, 'windmill')).toBeTruthy();
    const q = s.players.find((x) => x.id !== o)!;
    restat(s, q, () => {
      q.epoch = AGES.gunpowder.tier;
      q.age = 'gunpowder';
    });
    expect(buildBarred(q, 'dyke')).toMatch(/Age of Dykes/);
  });

  it('is deterministic: the same breach on the same seed gives the same match', () => {
    const go = () => {
      const { s, plan } = drained();
      keyDyke(s, plan).hp = 0;
      run(s, 8);
      return checksum(s);
    };
    expect(go()).toBe(go());
  });

  it('a dyke on dry land holds nothing back', () => {
    const { s, o } = drained();
    for (let i = s.w * 2; i < s.w * (s.h - 2); i++) {
      if (s.terrain[i] !== T_GRASS || placeProblem(s, 'dyke', i % s.w, Math.floor(i / s.w), true, o)) continue;
      const b = placeBuilding(s, o, 'dyke', i % s.w, Math.floor(i / s.w), true);
      expect(heldBack(s, b)).toBe(0);
      return;
    }
  });
});
