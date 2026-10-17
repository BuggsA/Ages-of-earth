import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { applyCommand } from '../src/sim/commands';
import { BUILDINGS, KILL_CAMP, KIN, RAID, SEASON, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { raiseCost } from '../src/sim/reclaim';
import { buildBarred } from '../src/sim/ages';
import { killCamp } from '../src/sim/ways';
import type { Animal, Building, GameState, Unit, WayId } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

const game = (a: WayId | null = null, b: WayId | null = null): GameState => {
  const s = createGame({ seed: 4, size: 'small', mapType: 'plains', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  if (a) applyCommand(s, { t: 'way', p: 0, way: a });
  if (b) applyCommand(s, { t: 'way', p: 1, way: b });
  return s;
};
const tcOf = (s: GameState, o: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === o && e.type === 'towncenter')!;
const run = (s: GameState, sec: number) => { for (let i = 0; i < secs(sec) && !s.over; i++) step(s); };
const citizens = (s: GameState, o: number) => s.ents.filter((e) => e.kind === 'unit' && e.owner === o && e.type === 'citizen' && e.hp > 0).length;

describe('the Ways have verbs (#463 s1)', () => {
  describe("the Hunters' kill camp", () => {
    /** A spot for a camp with a deer standing by it, and one far from any game or meat. */
    function spots(s: GameState) {
      const tc = tcOf(s, 0);
      const near = findSpot(s, 'huntcamp', tc.x + 12, tc.y, 0, 8)!;
      const deer = s.animals.find((a) => a.kind === 'deer')!;
      Object.assign(deer, { x: near.tx + 1, y: near.ty + 4, px: near.tx + 1, py: near.ty + 4 } as Partial<Animal>);
      for (const a of s.animals) if (a !== deer && (a.x - near.tx) ** 2 + (a.y - near.ty) ** 2 < 400) a.hp = 0;
      return { near, deer };
    }

    it('costs nothing by game, and the usual price away from it', () => {
      const s = game('hunt');
      const { near } = spots(s);
      expect(raiseCost(s, 0, 'huntcamp', near.tx, near.ty)).toEqual({});
      const deer = s.animals.find((a) => a.kind === 'deer' && a.hp > 0)!;
      deer.hp = 0;
      expect(killCamp(s, 0, 'huntcamp', near.tx, near.ty)).toBe(false);
      expect(raiseCost(s, 0, 'huntcamp', near.tx, near.ty)).toEqual(BUILDINGS.huntcamp.cost);
      // Only the Hunters, and only a Hunting Camp.
      const t = game('hearth');
      const n2 = spots(t).near;
      expect(killCamp(t, 0, 'huntcamp', n2.tx, n2.ty)).toBe(false);
      expect(killCamp(s, 0, 'storehouse', near.tx, near.ty)).toBe(false);
    });

    it('a carcass counts as the kill', () => {
      const s = game('hunt');
      const { near, deer } = spots(s);
      deer.hp = 0;
      const tile = (near.ty + 3) * s.w + near.tx + 1;
      s.res[tile] = 5; // R_MEAT
      s.amount[tile] = 80;
      expect(killCamp(s, 0, 'huntcamp', near.tx, near.ty)).toBe(true);
    });

    it('is placed free, goes up in a fraction of the time, and refunds nothing when cancelled', () => {
      const s = game('hunt');
      const { near } = spots(s);
      const wood = s.players[0].res.wood;
      const builder = s.ents.find((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen')!;
      Object.assign(builder, { x: near.tx - 0.5, y: near.ty + 1 });
      applyCommand(s, { t: 'build', p: 0, ids: [builder.id], type: 'huntcamp', tx: near.tx, ty: near.ty });
      const camp = s.ents.find((e): e is Building => e.kind === 'building' && e.type === 'huntcamp' && e.owner === 0)!;
      expect(camp.kill).toBe(true);
      expect(s.players[0].res.wood).toBe(wood);
      run(s, BUILDINGS.huntcamp.time * KILL_CAMP.time + 4);
      expect(camp.built).toBe(true);
      // A cancelled kill camp gives back nothing.
      const t = game('hunt');
      const n2 = spots(t).near;
      const w2 = t.players[0].res.wood;
      applyCommand(t, { t: 'build', p: 0, ids: [], type: 'huntcamp', tx: n2.tx, ty: n2.ty });
      const site = t.ents.find((e): e is Building => e.kind === 'building' && e.type === 'huntcamp' && e.owner === 0)!;
      applyCommand(t, { t: 'delete', p: 0, ids: [site.id] });
      expect(t.players[0].res.wood).toBe(w2);
    });

    it('sows no farms in the Stone Age, and farms again from the Bronze Age', () => {
      const s = game('hunt');
      const p = s.players[0];
      expect(buildBarred(p, 'farm')).toMatch(/Stone Age/);
      expect(buildBarred(s.players[1], 'farm')).toBeNull();
      p.epoch = 1;
      p.statsVersion++;
      expect(buildBarred(p, 'farm')).toBeNull();
    });
  });

  describe("the Hearth's kin", () => {
    it('come two together after their time, for their price', () => {
      const s = game('hearth');
      const p = s.players[0];
      const tc = tcOf(s, 0);
      p.res.food = 500;
      const before = citizens(s, 0);
      applyCommand(s, { t: 'kin', p: 0, building: tc.id });
      expect(p.res.food).toBe(500 - KIN.cost.food!);
      run(s, KIN.time - 2);
      expect(citizens(s, 0)).toBe(before);
      run(s, 3);
      expect(citizens(s, 0)).toBe(before + KIN.n);
    });

    it('come three in winter', () => {
      const s = game('hearth');
      s.tick = secs(SEASON.len) * 3 + 20;
      const p = s.players[0];
      p.res.food = 500;
      p.cap = 50;
      const before = citizens(s, 0);
      applyCommand(s, { t: 'kin', p: 0, building: tcOf(s, 0).id });
      run(s, KIN.time + 1);
      expect(citizens(s, 0)).toBe(before + KIN.winter);
    });

    it('answer only the Hearth, and the Hearth keeps no Hunting Camps', () => {
      const s = game('hunt');
      s.players[0].res.food = 500;
      applyCommand(s, { t: 'kin', p: 0, building: tcOf(s, 0).id });
      expect(s.players[0].res.food).toBe(500);
      expect(s.events.some((e) => e.k === 'refused')).toBe(true);
      const t = game('hearth');
      expect(buildBarred(t.players[0], 'huntcamp')).toMatch(/Hunting Camp/);
      t.players[0].epoch = 2;
      expect(buildBarred(t.players[0], 'huntcamp')).toMatch(/Hunting Camp/);
    });
  });

  describe("the Warband's raid", () => {
    function raid(way: WayId) {
      const s = game(way);
      const home = tcOf(s, 1);
      const spot = findSpot(s, 'storehouse', home.x + 14, home.y, 0, 10)!;
      const store = placeBuilding(s, 1, 'storehouse', spot.tx, spot.ty, true);
      s.players[1].res.food = 300;
      const band = [0, 1, 2].map((i) => spawnUnit(s, 0, 'infantry', store.x - 2, store.y - 1 + i));
      applyCommand(s, { t: 'attack', p: 0, ids: band.map((u) => u.id), target: store.id });
      return { s, store };
    }

    it('blows on a rival food building carry its food off', () => {
      const { s } = raid('warband');
      const mine = s.players[0].res.food;
      run(s, 10);
      const taken = s.players[0].stats.raided ?? 0;
      expect(taken).toBeGreaterThan(0);
      expect(s.players[1].res.food).toBeCloseTo(300 - taken, 5);
      expect(s.players[0].res.food).toBeGreaterThan(mine);
    });

    it('takes nothing for another Way, and never more than the rival holds', () => {
      const { s } = raid('hunt');
      run(s, 10);
      expect(s.players[0].stats.raided ?? 0).toBe(0);
      expect(s.players[1].res.food).toBe(300);
      const t = raid('warband').s;
      t.players[1].res.food = 3;
      run(t, 10);
      expect(t.players[1].res.food).toBeGreaterThanOrEqual(0);
      expect(t.players[0].stats.raided).toBeLessThanOrEqual(3 + 1e-9);
      expect(RAID.at).toContain('storehouse');
    });

    it('a warband does not hide: its bell does not ring', () => {
      const s = game('warband');
      applyCommand(s, { t: 'bell', p: 0, ring: true });
      expect(s.events.some((e) => e.k === 'refused')).toBe(true);
      run(s, 1);
      expect(s.ents.some((e) => e.kind === 'unit' && e.owner === 0 && (e.inside || e.order.k === 'garrison'))).toBe(false);
      const t = game('hearth');
      applyCommand(t, { t: 'bell', p: 0, ring: true });
      expect(t.ents.some((e) => e.kind === 'unit' && e.owner === 0 && e.order.k === 'garrison')).toBe(true);
    });
  });

  it('the computer plays each verb: kill camps, the kin, a raid', () => {
    const s = createGame({ seed: 7, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: 'hard', civ: 'egyptians' }] });
    const t = createGame({ seed: 5, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: 'hard', civ: 'britons' }, { name: 'B', ai: 'hard', civ: 'chinese' }] });
    applyCommand(s, { t: 'way', p: 0, way: 'warband' });
    applyCommand(s, { t: 'way', p: 1, way: 'hearth' });
    applyCommand(t, { t: 'way', p: 0, way: 'hunt' });
    let kin = 0;
    for (let i = 0; i < secs(200); i++) {
      step(s);
      step(t);
      for (const e of s.events) if (e.k === 'kin') kin += e.n;
    }
    expect(s.players[0].stats.raided ?? 0).toBeGreaterThan(0);
    expect(kin).toBeGreaterThanOrEqual(KIN.n);
    expect(t.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === 'huntcamp' && e.kill)).toBe(true);
    expect(t.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === 'farm')).toBe(false);
  });
});
