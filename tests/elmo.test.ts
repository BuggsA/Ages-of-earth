import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { ELMO, GALVANIC, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { modsOf, techProblem } from '../src/sim/stats';
import type { Building, BuildingType, GameState, Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import { updateVision } from '../src/sim/vision';

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

describe('Wireless Telegraphy (#240)', () => {
  it('lets ships in a Tower field see farther, only with the heirloom', () => {
    const s = game();
    const p = s.players[0];
    const tower = raise(s, 'tower');
    const ship = spawnUnit(s, 0, 'warship', tower.x + 3, tower.y + 3);
    const far = Math.floor(ship.x) + 12;
    const idx = Math.floor(ship.y) * s.w + far;
    updateVision(s);
    const before = p.vis[idx];
    p.techs.push('telegraphy');
    p.statsVersion++;
    expect(techProblem(s, 0, 'telegraphy')).not.toBeNull();
    updateVision(s);
    expect(p.vis[idx]).toBe(1);
    expect(before).toBe(0);
    ship.x += 30;
    ship.y = Math.min(s.h - 2, ship.y);
    updateVision(s);
    expect(p.vis[idx]).toBe(0);
  });
});

describe('Galvanic Revival (#240)', () => {
  const learn = (s: GameState) => { s.players[0].techs.push('galvanic'); s.players[0].statsVersion++; };
  it('is shut until Reclaimers and Lightning are walked', () => {
    const s = game();
    expect(techProblem(s, 0, 'galvanic')).toContain('heirloom');
    s.players[0].walked = ['reclaimer', 'lightning'];
    expect(techProblem(s, 0, 'galvanic')).toBeNull();
  });
  it('pays gold from a dug ruin in a Tower field, only with the heirloom', () => {
    const s = game();
    const tower = raise(s, 'tower');
    s.ruins = [{ id: 9999, x: tower.x + 3, y: tower.y + 3, find: 'hoard', dug: 1, by: 0 }];
    const g0 = s.players[0].res.gold;
    run(s, GALVANIC.every);
    expect(s.players[0].res.gold).toBe(g0);
    learn(s);
    run(s, GALVANIC.every);
    expect(s.players[0].res.gold).toBe(g0 + GALVANIC.gold);
    s.ruins[0].x = tower.x + 40;
    const g1 = s.players[0].res.gold;
    run(s, GALVANIC.every);
    expect(s.players[0].res.gold).toBe(g1);
  });
  it('repairs in a field cost nothing', () => {
    const s = game();
    const tower = raise(s, 'tower');
    const house = raise(s, 'house', tower);
    house.hp = 1;
    const c = spawnUnit(s, 0, 'citizen', house.x, house.y + 2);
    c.order = { k: 'build', target: house.id } as never;
    learn(s);
    const g0 = s.players[0].res.gold, w0 = s.players[0].res.wood;
    run(s, 5);
    expect(house.hp).toBeGreaterThan(1);
    expect(s.players[0].res.gold).toBe(g0);
    expect(s.players[0].res.wood).toBe(w0);
  });
});
