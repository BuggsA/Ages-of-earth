import { describe, expect, it } from 'vitest';
import { AGES, ROADS, SPOILS, TICK_HZ, secs } from '../src/sim/data';
import { ageOf } from '../src/sim/ages';
import { hurt } from '../src/sim/combat';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import { statsFor } from '../src/sim/stats';
import type { Building, GameState, Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** Spoils (#502): the Warband's plunder is carried by the killer and banked at home. */

const road = ROADS.find((r) => r.to === 'warband')!;
const game = (): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.players[0].epoch = 2;
  s.players[0].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
  return s;
};
const tc = (s: GameState) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
const enter = (s: GameState) => {
  const p = s.players[0];
  outer: for (let r = 4; r < 20; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const tx = Math.round(p.startX) + dx;
        const ty = Math.round(p.startY) + dy;
        if (!placeProblem(s, 'barracks', tx, ty)) {
          placeBuilding(s, 0, 'barracks', tx, ty, true);
          break outer;
        }
      }
  p.stats.slain = road.deed!.n;
  step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'warband' }]);
  for (let i = 0; i < secs(road.time) + 2; i++) step(s);
  expect(ageOf(p)).toBe('warband');
};
/** A soldier of player 0 far from home fells a rival spearman. */
const killAbroad = (s: GameState): Unit => {
  const home = tc(s);
  const me = spawnUnit(s, 0, 'infantry', home.x + 30, home.y + 30);
  const foe = spawnUnit(s, 1, 'infantry', me.x + 1, me.y);
  hurt(s, foe, foe.hp + 100, 0, me);
  return me;
};
const cost = (s: GameState) => {
  const c = statsFor(s, 1, 'infantry').cost;
  return Math.floor(((c.food ?? 0) + (c.wood ?? 0) + (c.gold ?? 0) + (c.stone ?? 0)) * AGES.warband.add!.plunder!);
};

describe('spoils', () => {
  it('only the Warband hauls its plunder', () => {
    expect(Object.entries(AGES).filter(([, a]) => a.haul).map(([id]) => id)).toEqual(['warband']);
  });

  it('a kill fills the killer\'s pack and pays nothing yet', () => {
    const s = game();
    enter(s);
    const gold = s.players[0].res.gold;
    const me = killAbroad(s);
    expect(me.spoils).toBe(cost(s));
    expect(s.players[0].res.gold).toBe(gold);
    expect(s.players[0].stats.plunder ?? 0).toBe(0);
  });

  it('a pack holds only so much', () => {
    const s = game();
    enter(s);
    const me = killAbroad(s);
    me.spoils = SPOILS.cap - 1;
    const foe = spawnUnit(s, 1, 'infantry', me.x + 1, me.y);
    hurt(s, foe, foe.hp + 100, 0, me);
    expect(me.spoils).toBe(SPOILS.cap);
  });

  it('walking home banks the pack at a Town Center', () => {
    const s = game();
    enter(s);
    const me = killAbroad(s);
    const want = me.spoils!;
    const gold = s.players[0].res.gold;
    me.x = tc(s).x + 3;
    me.y = tc(s).y + 3;
    for (let i = 0; i < TICK_HZ + 1; i++) step(s);
    expect(me.spoils).toBeUndefined();
    expect(s.players[0].res.gold).toBe(gold + want);
    expect(s.players[0].stats.plunder).toBe(want);
  });

  it('a rival who fells a laden soldier takes the pack, and an own death loses it', () => {
    const s = game();
    enter(s);
    const me = killAbroad(s);
    const pack = me.spoils!;
    const rival = s.players[1];
    const gold = rival.res.gold;
    const killer = spawnUnit(s, 1, 'infantry', me.x + 1, me.y);
    hurt(s, me, me.hp + 100, 1, killer);
    expect(rival.res.gold).toBe(gold + pack);
    expect(rival.stats.plunder).toBe(pack);
  });

  it('leaving the age banks every pack where it stands', () => {
    const s = game();
    enter(s);
    const me = killAbroad(s);
    const want = me.spoils!;
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'gunpowder' }]);
    for (let i = 0; i < secs(65) + TICK_HZ + 2; i++) step(s);
    expect(ageOf(s.players[0])).toBe('gunpowder');
    expect(me.spoils).toBeUndefined();
    expect(s.players[0].stats.plunder).toBe(want);
  });
});
