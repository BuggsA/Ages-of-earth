import { describe, expect, it } from 'vitest';
import { barred, trainsAt } from '../src/sim/ages';
import { applyCommand } from '../src/sim/commands';
import { secs } from '../src/sim/data';
import { placeBuilding } from '../src/sim/world';
import { createGame, step } from '../src/sim/game';
import type { Building, GameState, Unit } from '../src/sim/types';

/** The Wild Hunt's Falconer's Mews (#727): a forward kennel that breeds War Wolves and flies Hawks with no rider and no tamed kind. */

function game(age: 'hunt' | 'bronze' = 'hunt'): { s: GameState; mews: Building } {
  const s = createGame({ seed: 4, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 0;
  for (const p of s.players) p.epoch = 1;
  s.players[0].age = age;
  s.players[0].walked = ['wild', 'steppe', 'hunt'];
  s.players[0].res = { food: 3000, wood: 3000, stone: 500, gold: 500 };
  const mews = placeBuilding(s, 0, 'mews', Math.floor(s.players[0].startX) + 6, Math.floor(s.players[0].startY) + 6, true) as Building;
  mews.built = true;
  return { s, mews };
}
const wolves = (s: GameState): Unit[] => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'warwolf' && e.hp > 0);

describe('the Falconer\'s Mews (#727)', () => {
  it('breeds War Wolves and flies Hawks in the Wild Hunt, though no wolf was ever tamed', () => {
    const { s, mews } = game();
    expect(s.players[0].tamed ?? []).not.toContain('wolf');
    expect(trainsAt(s.players[0], 'mews')).toEqual(['warwolf', 'hawk']);
    expect(barred(s.players[0], 'warwolf', 'mews')).toBeNull();
    expect(barred(s.players[0], 'warwolf', 'den')).not.toBeNull();
    applyCommand(s, { t: 'train', p: 0, building: mews.id, unit: 'warwolf' });
    expect(mews.queue.length).toBe(1);
    for (let i = 0; i < secs(30) && !wolves(s).length; i++) step(s);
    expect(wolves(s).length).toBe(1);
  });

  it('sleeps when the people leaves the age', () => {
    const { s, mews } = game('bronze');
    applyCommand(s, { t: 'train', p: 0, building: mews.id, unit: 'warwolf' });
    expect(mews.queue.length).toBe(0);
  });
});
