import { describe, expect, it } from 'vitest';
import { AGES, EPOCHS, FALLOUT, FISSION, FUSION, LAST_EPOCH, ROADS, SILO, WARHEADS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { inFallout, launchProblem, loaded } from '../src/sim/silo';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import { buildingGeometry } from '../src/render/buildingModels';
import type { Building, GameState } from '../src/sim/types';

const game = (startEpoch = 5) => {
  const s = createGame({ seed: 5, size: 'small', startEpoch, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  // A rival Town Center far from both towns: a warhead now really breaks the first one, and the match must go on.
  placeBuilding(s, 1, 'towncenter', s.players[1].startX < s.w / 2 ? s.w - 8 : 8, s.players[1].startY < s.h / 2 ? s.h - 8 : 8, true);
  return s;
};
const tc = (s: GameState, o: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === o && e.type === 'towncenter')!;
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const rich = (s: GameState) => { s.players[0].res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 }; };
const siloFor = (s: GameState) => placeBuilding(s, 0, 'silo', s.players[0].startX + 8, s.players[0].startY + 8, true);

describe('the Atomic Age', () => {
  it('is a sixth epoch on the trunk, reached from Industrial, and the last', () => {
    expect(EPOCHS).toHaveLength(6);
    expect(LAST_EPOCH).toBe(5);
    expect(AGES.atomic.tier).toBe(5);
    expect(ROADS.some((r) => r.from === 'industrial' && r.to === 'atomic')).toBe(true);
  });

  it('a Silo launches, the clock runs in public, and the warhead flattens a rival town', () => {
    const s = game(); rich(s);
    const silo = siloFor(s);
    const target = tc(s, 1);
    expect(launchProblem(s, 0, silo, target.x, target.y)).toBeNull();
    const gold = s.players[0].res.gold;
    step(s, [{ t: 'launch', p: 0, silo: silo.id, x: target.x, y: target.y }]);
    expect(s.launches).toHaveLength(1);
    expect(s.players[0].res.gold).toBe(gold - SILO.fuel.gold!);
    const hp = target.hp;
    run(s, SILO.fuse - 2);
    expect(target.hp).toBeGreaterThanOrEqual(hp);
    run(s, 4);
    expect(s.launches).toBeUndefined();
    expect(target.hp).toBeLessThan(hp);
  });

  it('spares the launcher’s own people and everything outside the ring', () => {
    const s = game(); rich(s);
    const silo = siloFor(s);
    const own = tc(s, 0), far = tc(s, 1);
    const ownHp = own.hp, farHp = far.hp;
    // Aim just past the ring's edge from the rival Town Center.
    step(s, [{ t: 'launch', p: 0, silo: silo.id, x: far.x + far.size / 2 + WARHEADS.atomic.r + 2, y: far.y }]);
    run(s, SILO.fuse + 2);
    expect(own.hp).toBe(ownHp);
    expect(far.hp).toBeGreaterThanOrEqual(farHp);
  });

  it('is scrubbed when the silo falls during the countdown', () => {
    const s = game(); rich(s);
    const silo = siloFor(s);
    const target = tc(s, 1);
    const hp = target.hp;
    step(s, [{ t: 'launch', p: 0, silo: silo.id, x: target.x, y: target.y }]);
    run(s, 5);
    silo.hp = 0;
    run(s, 2);
    expect(s.launches).toBeUndefined();
    run(s, SILO.fuse);
    expect(target.hp).toBe(hp);
  });

  it('must be refuelled before it fires again, and a launch costs its fuel', () => {
    const s = game(); rich(s);
    const silo = siloFor(s);
    const t = tc(s, 1);
    step(s, [{ t: 'launch', p: 0, silo: silo.id, x: t.x, y: t.y }]);
    run(s, SILO.fuse + 1);
    expect(loaded(s, silo)).toBe(false);
    expect(launchProblem(s, 0, silo, t.x, t.y)).toMatch(/Refuelling/);
    run(s, SILO.refuel);
    expect(launchProblem(s, 0, silo, t.x, t.y)).toBeNull();
    s.players[0].res.gold = 0;
    expect(launchProblem(s, 0, silo, t.x, t.y)).toMatch(/fuel/);
  });

  it('fires only in the Atomic Age, never under the peace, and never from a rival’s silo', () => {
    const s = game(4); rich(s);
    const silo = siloFor(s);
    const t = tc(s, 1);
    expect(launchProblem(s, 0, silo, t.x, t.y)).toMatch(/Atomic/);
    s.players[0].epoch = 5;
    expect(launchProblem(s, 1, silo, t.x, t.y)).toMatch(/your Missile Silos/);
  });

  it('survives a save in flight and draws a model', () => {
    const s = game(); rich(s);
    const silo = siloFor(s);
    const t = tc(s, 1);
    step(s, [{ t: 'launch', p: 0, silo: silo.id, x: t.x, y: t.y }]);
    const back = deserialize(serialize(s));
    expect(back.launches).toEqual(s.launches);
    expect(buildingGeometry('silo', 5, '#c33').getAttribute('position').count).toBeGreaterThan(0);
  });

  it('leaves fallout where it struck: land units in it take damage from anyone, buildings do not, and it clears', () => {
    const s = game(); rich(s);
    const silo = siloFor(s);
    const t = tc(s, 1);
    const outside = spawnUnit(s, 1, 'citizen', t.x + SILO.reach + 6, t.y);
    step(s, [{ t: 'launch', p: 0, silo: silo.id, x: t.x, y: t.y }]);
    run(s, SILO.fuse + 2);
    expect(s.fallout).toHaveLength(1);
    expect(inFallout(s, t.x, t.y)).toBe(true);
    expect(inFallout(s, outside.x, outside.y)).toBe(false);
    // The strike itself may have killed the units; place fresh ones on the poisoned ground.
    const a = spawnUnit(s, 0, 'citizen', t.x + 1, t.y + 1), b = spawnUnit(s, 1, 'citizen', t.x - 1, t.y - 1);
    const ha = a.hp, hb = b.hp, ho = outside.hp, hp = silo.hp;
    run(s, 5);
    expect(a.hp).toBeLessThan(ha);
    expect(b.hp).toBeLessThan(hb);
    expect(outside.hp).toBeGreaterThanOrEqual(ho);
    expect(silo.hp).toBe(hp);
    run(s, FALLOUT.time);
    expect(s.fallout).toBeUndefined();
  });

  describe('the fork past it', () => {
    const turn = (s: GameState, age: 'fission' | 'fusion') => restat(s, s.players[0], () => { s.players[0].age = age; });

    it('is two roads off the Atomic Age, behind a silo, each shutting the other, each with a road back', () => {
      for (const [to, shuns] of [['fission', 'fusion'], ['fusion', 'fission']] as const) {
        const road = ROADS.find((r) => r.from === 'atomic' && r.to === to)!;
        expect(road.clue).toBe('silo');
        expect(road.shuns).toBe(shuns);
        expect(ROADS.some((r) => r.from === to && r.to === 'atomic')).toBe(true);
      }
      const s = game(); rich(s);
      step(s, [{ t: 'advance', p: 0, building: tc(s, 0).id, to: 'fission' }]);
      expect(tc(s, 0).advanceTo).toBeUndefined();
      siloFor(s);
      step(s, [{ t: 'advance', p: 0, building: tc(s, 0).id, to: 'fission' }]);
      expect(tc(s, 0).advanceTo).toBe('fission');
    });

    it('Fission: a short clock and a short refuel, and each launch poisons the ground round your own silo', () => {
      const s = game(); rich(s); turn(s, 'fission');
      const silo = siloFor(s);
      const t = tc(s, 1);
      step(s, [{ t: 'launch', p: 0, silo: silo.id, x: t.x, y: t.y }]);
      expect(s.launches![0].at - s.tick).toBeLessThanOrEqual(secs(FISSION.fuse));
      expect(s.players[0].nukes!.next! - s.tick).toBeLessThanOrEqual(secs(FISSION.refuel));
      const own = s.fallout!.find((f) => f.x === silo.x && f.y === silo.y)!;
      expect(own.r).toBe(FISSION.reach);
      expect(inFallout(s, silo.x + 1, silo.y)).toBe(true);
      expect(inFallout(s, silo.x + FISSION.reach + 2, silo.y)).toBe(false);
      run(s, FISSION.ownFallout + 1);
      expect(inFallout(s, silo.x + 1, silo.y)).toBe(false);
    });

    it('Fusion: up to three warheads aloft from one silo, no refuel, a long clock, and nothing struck is poisoned', () => {
      const s = game(); rich(s); turn(s, 'fusion');
      const silo = siloFor(s);
      const t = tc(s, 1);
      const gold = s.players[0].res.gold;
      for (let i = 0; i < SILO.cap; i++) step(s, [{ t: 'launch', p: 0, silo: silo.id, x: t.x, y: t.y }]);
      expect(s.launches).toHaveLength(SILO.cap);
      expect(s.players[0].res.gold).toBe(gold - SILO.cap * FUSION.fuel.gold!);
      expect(launchProblem(s, 0, silo, t.x, t.y)).toMatch(/already in the air/);
      expect(s.fallout).toBeUndefined();
      run(s, FUSION.fuse + 2);
      expect(s.launches).toBeUndefined();
      expect(s.fallout).toBeUndefined();
      expect(launchProblem(s, 0, silo, t.x, t.y)).toBeNull();
    });
  });
});
