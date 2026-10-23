import { describe, expect, it } from 'vitest';
import { ageOf, barred, buildBarred, hasWalked, roadProblem, roadTo } from '../src/sim/ages';
import { CHARIOT_FORGE, ROADS } from '../src/sim/data';
import { createGame, enterAge } from '../src/sim/game';
import { statsFor } from '../src/sim/stats';
import type { AgeId, GameState } from '../src/sim/types';
import { placeBuilding } from '../src/sim/world';

/** The Age of Chariots (#555 s12): the Iron Age and the Steppe, walked both, make one road off the Stone Age. */

const ROAD = ROADS.find((r) => r.to === 'chariots')!;

const game = (walked: AgeId[]): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: null, civ: 'britons' }, { name: 'B', ai: null, civ: 'britons' }] });
  const p = s.players[0];
  p.epoch = 0;
  p.walked = walked;
  p.res = { food: 3000, wood: 3000, stone: 400, gold: 1500 };
  placeBuilding(s, 0, 'forge', p.startX + 6, p.startY + 6, true);
  return s;
};

describe('the door', () => {
  it('is a crossing off the Stone Age, seen with one sibling walked and open only with both', () => {
    expect(ROAD.from).toBe('stone');
    expect(ROAD.crossing).toEqual(['iron', 'steppe']);
    const none = game([]);
    expect(roadProblem(none, none.players[0], ROAD)).toMatch(/Only a people that walked/);
    const one = game(['iron']);
    expect(roadProblem(one, one.players[0], ROAD)).toMatch(/Needs both/);
    expect(roadTo(one.players[0], 'chariots')).toBeDefined();
    const both = game(['iron', 'steppe']);
    expect(roadProblem(both, both.players[0], ROAD)).toBeNull();
  });
});

describe('the age', () => {
  const chariot = () => {
    const s = game(['iron', 'steppe']);
    enterAge(s, s.players[0], 'chariots');
    return s;
  };

  it('puts the riders on iron-tyred chariots, and bars bows, walls and gates', () => {
    const s = chariot();
    const p = s.players[0];
    expect(ageOf(p)).toBe('chariots');
    expect(p.epoch).toBe(1);
    expect(hasWalked(p, 'chariots')).toBe(true);
    expect(barred(p, 'cavalry')).toBeNull();
    expect(barred(p, 'ranged')).not.toBeNull();
    expect(buildBarred(p, 'wall')).not.toBeNull();
    expect(statsFor(s, 0, 'cavalry').name).toBe('Chariot');
  });

  it('edges every chariot with the bog iron dug, and not the foot soldiers', () => {
    const s = chariot();
    const p = s.players[0];
    const foot = statsFor(s, 0, 'infantry').attack;
    const base = statsFor(s, 0, 'cavalry').attack;
    p.stats.iron = CHARIOT_FORGE.base + CHARIOT_FORGE.per * 2;
    p.statsVersion++;
    expect(statsFor(s, 0, 'cavalry').attack).toBe(base + 2 * CHARIOT_FORGE.attack);
    expect(statsFor(s, 0, 'infantry').attack).toBe(foot);
    p.stats.iron = 1e6;
    p.statsVersion++;
    expect(statsFor(s, 0, 'cavalry').attack).toBe(base + CHARIOT_FORGE.most * CHARIOT_FORGE.attack);
  });

  it('settles back to the Bronze Age with its archers', () => {
    const s = chariot();
    enterAge(s, s.players[0], 'bronze');
    expect(barred(s.players[0], 'ranged')).toBeNull();
    expect(statsFor(s, 0, 'cavalry').name).not.toBe('Chariot');
  });
});
