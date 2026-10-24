import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { createGame, step } from '../src/sim/game';
import type { Stance } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** Attack and destroy (the aggressive stance): once its fight is won, a soldier goes on to the enemy buildings in sight. */

const setup = (stance: Stance) => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  s.peaceUntil = 0;
  s.ents = [];
  s.byId.clear();
  const house = placeBuilding(s, 1, 'house', 20, 20, true);
  const u = spawnUnit(s, 0, 'infantry', 24, 21);
  u.stance = stance;
  // A lone, nearly dead foe beside the house: the soldier takes it on, and wins.
  const foe = spawnUnit(s, 1, 'citizen', 24.6, 21.4);
  foe.hp = 1;
  foe.stance = 'stand';
  applyCommand(s, { t: 'attack', p: 0, ids: [u.id], target: foe.id });
  for (let i = 0; i < 60 && foe.hp > 0; i++) step(s);
  expect(foe.hp).toBeLessThanOrEqual(0);
  step(s);
  return { s, u, house };
};

describe('attack and destroy', () => {
  it('goes on to an enemy building in sight once the fight is won', () => {
    const { u, house } = setup('aggressive');
    expect(u.order.k === 'attack' && u.order.target).toBe(house.id);
  });

  it('leaves buildings alone after a fight on the defensive stances', () => {
    for (const stance of ['defensive', 'stand'] as const) {
      const { u, house } = setup(stance);
      expect(u.order.k === 'attack' && u.order.target === house.id).toBe(false);
    }
  });

  it('does not set an idle soldier on a building by itself (a Horde rider standing for tribute, a sapper by its keg)', () => {
    const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    s.peaceUntil = 0;
    s.ents = [];
    s.byId.clear();
    placeBuilding(s, 1, 'house', 20, 20, true);
    const u = spawnUnit(s, 0, 'infantry', 24, 21);
    for (let i = 0; i < 20; i++) step(s);
    expect(u.order.k).toBe('idle');
  });
});
