import { describe, expect, it } from 'vitest';
import { AGES, EPOCHS, FALLOUT, LAST_EPOCH, ROADS, SILO, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { inFallout, launchProblem, loaded } from '../src/sim/silo';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import { buildingGeometry } from '../src/render/buildingModels';
import type { Building, GameState } from '../src/sim/types';

const game = (startEpoch = 5) => createGame({ seed: 5, size: 'small', startEpoch, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
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
    step(s, [{ t: 'launch', p: 0, silo: silo.id, x: far.x + far.size / 2 + SILO.reach + 2, y: far.y }]);
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
});
