import { describe, expect, it } from 'vitest';
import { AGES, BUILDINGS, SEA_RAID, STRAND, secs } from '../src/sim/data';
import { buildBarred } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';
import type { AgeId, Building, GameState } from '../src/sim/types';
import { placeProblem } from '../src/sim/grid';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The Sea-Raiders' Raiders' Strand (#727): a forward bank for a laden ship, at a cut. */

const game = (age: AgeId = 'searaider'): GameState => {
  const s = createGame({ seed: 2, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 1e9;
  s.animals = [];
  const p = s.players[0];
  p.epoch = AGES[age].tier;
  p.age = age;
  p.walked = age === 'searaider' ? ['warband', 'sail', 'searaider'] : [];
  p.res = { food: 9000, wood: 9000, stone: 9000, gold: 0 };
  return s;
};
/** The nth-nearest shore tile to the start where `type` may stand (`skip` shores along). */
const built = (s: GameState, type: 'strand' | 'dock', skip: number): Building => {
  const p = s.players[0];
  const spots: { tx: number; ty: number; d: number }[] = [];
  for (let ty = 1; ty < s.h; ty++) for (let tx = 1; tx < s.w; tx++) if (!placeProblem(s, type, tx, ty)) spots.push({ tx, ty, d: (tx - p.startX) ** 2 + (ty - p.startY) ** 2 });
  spots.sort((a, b) => a.d - b.d);
  const at = spots[skip * 40];
  if (!at) throw new Error('no shore');
  const b = placeBuilding(s, 0, type, at.tx, at.ty, true);
  b.built = true;
  b.hp = BUILDINGS[type].hp;
  return b;
};
const ship = (s: GameState, x: number, y: number, hold: number) => {
  const u = spawnUnit(s, 0, 'transport', x, y);
  u.spoils = hold;
  return u;
};
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };

describe('the Raiders\' Strand is the Sea-Raiders\' own building (#727)', () => {
  it('is raised only in the Sea-Raiders, on a shore, and trains foot soldiers', () => {
    expect(BUILDINGS.strand.ages).toEqual(['searaider']);
    expect(BUILDINGS.strand.shore).toBe(true);
    expect(BUILDINGS.strand.trains).toEqual(['infantry']);
    expect(buildBarred(game().players[0], 'strand')).toBeNull();
    expect(buildBarred(game('middle').players[0], 'strand')).not.toBeNull();
  });

  it('banks a ship\'s hold at the cut, far from any Dock', () => {
    const s = game();
    const b = built(s, 'strand', 1);
    const u = ship(s, b.x, b.y + 3, 200);
    run(s, 3);
    expect(u.spoils).toBeUndefined();
    expect(s.players[0].res.gold).toBe(Math.round(200 * STRAND.cut));
  });

  it('a Dock banks the whole hold, and a ship out of reach of every bank keeps it', () => {
    const s = game();
    const d = built(s, 'dock', 1);
    const near = ship(s, d.x, d.y + 2, 120);
    const far = ship(s, d.x + SEA_RAID.dock + 20, d.y + 2, 80);
    run(s, 3);
    expect(near.spoils).toBeUndefined();
    expect(far.spoils).toBe(80);
    expect(s.players[0].res.gold).toBe(120);
  });

  it('a Dock beside the Strand wins: the whole hold, not the cut', () => {
    const s = game();
    const d = built(s, 'dock', 0);
    built(s, 'strand', 0);
    const u = ship(s, d.x, d.y + 2, 100);
    run(s, 3);
    expect(u.spoils).toBeUndefined();
    expect(s.players[0].res.gold).toBe(100);
  });
});
