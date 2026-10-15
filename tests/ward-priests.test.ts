import { describe, expect, it } from 'vitest';
import { CONSECRATE, secs } from '../src/sim/data';
import { aiStep } from '../src/sim/ai';
import { step } from '../src/sim/game';
import { createGame } from '../src/sim/game';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import type { Building, GameState, Unit } from '../src/sim/types';

/** The computer (player 1, Greeks) keeps a tower; player 0 walks the pilgrims' road. */
function setup(): { s: GameState; tower: Building; priest: Unit } {
  const s = createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: null, civ: 'greeks' }, { name: 'B', ai: 'hard', civ: 'romans' }] });
  for (const p of s.players) restat(s, p, () => { p.epoch = 2; });
  restat(s, s.players[0], () => { s.players[0].age = 'pilgrim'; });
  const home = s.ents.find((e) => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter')!;
  const tower = placeBuilding(s, 1, 'tower', Math.floor(home.x) + 8, Math.floor(home.y), true) as Building;
  const priest = spawnUnit(s, 1, 'priest', home.x - 4, home.y + 2);
  return { s, tower, priest };
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

describe('the computer wards its buildings against a chant (#216)', () => {
  it('parks a spare priest by its tower when a pilgrim rival is in the match', () => {
    const { s, tower, priest } = setup();
    for (let i = 0; i < secs(90); i++) {
      step(s);
      aiStep(s);
    }
    expect(dist(priest, tower)).toBeLessThanOrEqual(CONSECRATE.counter.range);
  });

  it('sends a priest to a building a rival is chanting over', () => {
    const { s, tower, priest } = setup();
    tower.faith = 0.3;
    tower.faithBy = 0;
    tower.chant = s.tick;
    const start = dist(priest, tower);
    for (let i = 0; i < secs(5); i++) {
      tower.chant = s.tick;
      step(s);
      aiStep(s);
    }
    expect(dist(priest, tower)).toBeLessThan(start);
  });
});
