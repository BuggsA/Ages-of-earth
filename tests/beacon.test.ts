import { describe, expect, it } from 'vitest';
import { BEACON, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { beaconProblem, lit } from '../src/sim/beacon';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import { sees } from '../src/sim/vision';
import type { Building, GameState } from '../src/sim/types';

function setup(): { s: GameState; tower: Building } {
  const s = createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'greeks' }] });
  const home = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
  const tower = placeBuilding(s, 0, 'tower', Math.floor(home.x) + 6, Math.floor(home.y), true) as Building;
  s.players[0].res.wood = 500;
  return { s, tower };
}

describe('signal beacons', () => {
  it('lights, burns for its duration, costs wood, then cools down', () => {
    const { s, tower } = setup();
    expect(beaconProblem(s, s.players[0], tower)).toBeNull();
    step(s, [{ t: 'beacon', p: 0, building: tower.id }]);
    expect(lit(s, tower)).toBe(true);
    expect(s.players[0].res.wood).toBe(500 - (BEACON.cost.wood ?? 0));
    expect(beaconProblem(s, s.players[0], tower)).toMatch(/already/);
    for (let i = 0; i < secs(BEACON.duration) + 2; i++) step(s);
    expect(lit(s, tower)).toBe(false);
    expect(beaconProblem(s, s.players[0], tower)).toMatch(/not yet/);
    for (let i = 0; i < secs(BEACON.cooldown); i++) step(s);
    expect(beaconProblem(s, s.players[0], tower)).toBeNull();
  });

  it('only the owner lights it, and only a finished tower', () => {
    const { s, tower } = setup();
    step(s, [{ t: 'beacon', p: 1, building: tower.id }]);
    expect(lit(s, tower)).toBe(false);
    tower.built = false;
    expect(beaconProblem(s, s.players[0], tower)).toMatch(/finished/);
  });

  it('lengthens the tower\'s sight and shows its ground to rivals', () => {
    const { s, tower } = setup();
    step(s, [{ t: 'beacon', p: 0, building: tower.id }]);
    for (let i = 0; i < 8; i++) step(s);
    expect(sees(s, 1, tower.x, tower.y)).toBe(true);
    expect(sees(s, 0, tower.x + 14, tower.y)).toBe(true);
    for (let i = 0; i < secs(BEACON.duration) + 8; i++) step(s);
    expect(sees(s, 1, tower.x, tower.y)).toBe(false);
  });

  it('lets a clever computer light one when rivals close in', () => {
    const { s, tower } = setup();
    s.players[0].ai = 'hard';
    s.ai[0] = { next: s.tick, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: {} } as never;
    for (let i = 0; i < 4; i++) spawnUnit(s, 1, 'infantry', tower.x + 3 + i * 0.3, tower.y);
    for (let i = 0; i < 60 && !lit(s, tower); i++) step(s);
    expect(lit(s, tower)).toBe(true);
  });

  it('relays down a chain of the owner\'s towers, free and shorter, but not to rivals or far towers', () => {
    const { s, tower } = setup();
    const x = Math.floor(tower.x), y = Math.floor(tower.y);
    const near = placeBuilding(s, 0, 'tower', x, y + 10, true) as Building;
    const chain = placeBuilding(s, 0, 'tower', x, y + 20, true) as Building;
    const far = placeBuilding(s, 0, 'tower', x, y + 40, true) as Building;
    const rival = placeBuilding(s, 1, 'tower', x + 5, y + 5, true) as Building;
    step(s, [{ t: 'beacon', p: 0, building: tower.id }]);
    expect(lit(s, near)).toBe(true);
    expect(lit(s, chain)).toBe(true);
    expect(lit(s, far)).toBe(false);
    expect(lit(s, rival)).toBe(false);
    expect(s.players[0].res.wood).toBe(500 - (BEACON.cost.wood ?? 0));
    for (let i = 0; i < secs(BEACON.relayDuration) + 2; i++) step(s);
    expect(lit(s, near)).toBe(false);
    expect(lit(s, tower)).toBe(true);
  });
});
