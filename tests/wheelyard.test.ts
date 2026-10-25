import { describe, expect, it } from 'vitest';
import { WHEELYARD, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { maxHp, placeBuilding, restat, spawnUnit } from '../src/sim/world';
import type { Building, GameState } from '../src/sim/types';

/** The Chariots' Wheelwright's Yard (#727): riders within reach of it are mended, and only while it stands in the age (or kept). */

const game = () => createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const chariots = (s: GameState) => restat(s, s.players[0], () => { s.players[0].age = 'chariots'; s.players[0].epoch = 1; s.players[0].walked = ['iron', 'steppe', 'chariots']; });

function setup(dist = 2) {
  const s = game();
  s.peaceUntil = 1e9;
  chariots(s);
  const home = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
  const yard = placeBuilding(s, 0, 'wheelyard', Math.floor(home.x) + 8, Math.floor(home.y), true);
  yard.built = true;
  const rider = spawnUnit(s, 0, 'cavalry', yard.x + dist, yard.y);
  const foot = spawnUnit(s, 0, 'infantry', yard.x + 1, yard.y + 1);
  rider.hp = 10;
  foot.hp = 10;
  return { s, yard, rider, foot };
}

describe('the Wheelwright\'s Yard (#727)', () => {
  it('mends a rider standing by it, and no foot soldier', () => {
    const { s, rider, foot } = setup();
    run(s, 5);
    expect(rider.hp).toBeGreaterThanOrEqual(10 + WHEELYARD.heal * 4);
    expect(foot.hp).toBe(10);
  });
  it('mends nothing out of reach', () => {
    const { s, rider } = setup(WHEELYARD.rest + 2);
    run(s, 5);
    expect(rider.hp).toBe(10);
  });
  it('mends no further than a rider\'s full health', () => {
    const { s, rider } = setup();
    run(s, 120);
    expect(rider.hp).toBe(maxHp(s, rider));
  });
  it('sleeps when the people leaves the age, unless it is the keepsake', () => {
    const { s, yard, rider } = setup();
    restat(s, s.players[0], () => { s.players[0].age = 'bronze'; s.players[0].epoch = 1; });
    run(s, 5);
    expect(rider.hp).toBe(10);
    yard.keep = 'chariots';
    restat(s, s.players[0], () => undefined);
    run(s, 5);
    expect(rider.hp).toBeGreaterThan(10);
  });
  it('is gone when it is destroyed', () => {
    const { s, yard, rider } = setup();
    yard.hp = 0;
    run(s, 3);
    expect(rider.hp).toBe(10);
  });
});
