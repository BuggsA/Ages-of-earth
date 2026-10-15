import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { ELMO, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { modsOf, techProblem } from '../src/sim/stats';
import type { Building, BuildingType, GameState, Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** St. Elmo's Fire (#240): the Pilgrims + Lightning heirloom. */
const game = (): GameState => createGame({ seed: 11, size: 'small', startEpoch: 4, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
const raise = (s: GameState, type: BuildingType, near?: Building): Building => {
  const p = s.players[0];
  const spot = findSpot(s, type, near ? near.tx : p.startX, near ? near.ty : p.startY, 4, 24)!;
  return placeBuilding(s, 0, type, spot.tx, spot.ty, true);
};
const run = (s: GameState, sec: number) => { for (let i = 0; i < secs(sec); i++) step(s); };

describe("St. Elmo's Fire (#240)", () => {
  it('is shut until both ages are walked, then adds the mod', () => {
    const s = game();
    const p = s.players[0];
    expect(techProblem(s, 0, 'stElmo')).toBe('An heirloom: walk the Age of Pilgrims and the Age of Lightning first');
    p.walked = ['pilgrim', 'lightning'];
    expect(techProblem(s, 0, 'stElmo')).toBeNull();
    p.techs.push('stElmo');
    p.statsVersion++;
    expect(modsOf(s, 0).elmo).toBe(1);
  });

  it('mends soldiers by a Temple in a Tower field, only with the heirloom, and not outside the field', () => {
    const s = game();
    const p = s.players[0];
    const tower = raise(s, 'tower');
    const temple = raise(s, 'temple', tower);
    const hurt = (): Unit => {
      const u = spawnUnit(s, 0, 'infantry', temple.x + 1, temple.y + 4);
      u.hp = 10;
      return u;
    };
    const u = hurt();
    run(s, 10);
    expect(u.hp).toBe(10);
    p.techs.push('stElmo');
    p.statsVersion++;
    run(s, ELMO.every + 1);
    expect(u.hp).toBeGreaterThan(10);
    // Remove the tower: no field, no mending.
    tower.hp = 0;
    const before = u.hp;
    run(s, 6);
    expect(u.hp).toBe(before);
  });
});
