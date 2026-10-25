import { describe, expect, it } from 'vitest';
import { AGES, BUILDINGS, CONVOY, PHAROS } from '../src/sim/data';
import { buildBarred } from '../src/sim/ages';
import { convoyShare } from '../src/sim/convoy';
import { createGame } from '../src/sim/game';
import type { AgeId, Building, GameState } from '../src/sim/types';
import { placeProblem } from '../src/sim/grid';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The Age of Sail's Pharos (#727): a standing escort for the cogs that load beside it. */

const game = (age: AgeId = 'sail'): GameState => {
  const s = createGame({ seed: 2, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 1e9;
  const p = s.players[0];
  p.epoch = AGES[age].tier;
  p.age = age;
  p.walked = age === 'sail' ? ['sail'] : [];
  p.res = { food: 9000, wood: 9000, stone: 9000, gold: 0 };
  return s;
};
const shore = (s: GameState): Building => {
  const p = s.players[0];
  const spots: { tx: number; ty: number; d: number }[] = [];
  for (let ty = 1; ty < s.h; ty++) for (let tx = 1; tx < s.w; tx++) if (!placeProblem(s, 'pharos', tx, ty)) spots.push({ tx, ty, d: (tx - p.startX) ** 2 + (ty - p.startY) ** 2 });
  spots.sort((a, b) => a.d - b.d);
  const at = spots[0];
  if (!at) throw new Error('no shore');
  const b = placeBuilding(s, 0, 'pharos', at.tx, at.ty, true);
  b.built = true;
  b.hp = BUILDINGS.pharos.hp;
  return b;
};

describe('the Pharos (#727)', () => {
  it('stands on a shore, in the Age of Sail only', () => {
    expect(BUILDINGS.pharos.shore).toBe(true);
    expect(BUILDINGS.pharos.ages).toEqual(['sail']);
    expect(buildBarred(game('sail').players[0], 'pharos')).toBeNull();
    expect(buildBarred(game('iron').players[0], 'pharos')).not.toBeNull();
  });

  it('escorts a cog that loads within its reach, with no warship beside it', () => {
    const s = game();
    const l = shore(s);
    const near = spawnUnit(s, 0, 'cog', l.x + PHAROS.reach - 1, l.y);
    const far = spawnUnit(s, 0, 'cog', l.x + PHAROS.reach + 2, l.y);
    expect(convoyShare(s, near)).toBe(PHAROS.pay);
    expect(convoyShare(s, far)).toBe(1);
  });

  it('pays less than a warship, and the better of the two applies', () => {
    const s = game();
    const l = shore(s);
    const cog = spawnUnit(s, 0, 'cog', l.x + 3, l.y);
    expect(PHAROS.pay).toBeLessThan(CONVOY.pay);
    spawnUnit(s, 0, 'warship', cog.x + 1, cog.y);
    expect(convoyShare(s, cog)).toBe(CONVOY.pay);
  });

  it('goes dark when razed, or unfinished, or when the people leaves the age', () => {
    const s = game();
    const l = shore(s);
    const cog = spawnUnit(s, 0, 'cog', l.x + 2, l.y);
    l.built = false;
    expect(convoyShare(s, cog)).toBe(1);
    l.built = true;
    l.hp = 0;
    expect(convoyShare(s, cog)).toBe(1);
    l.hp = BUILDINGS.pharos.hp;
    expect(convoyShare(s, cog)).toBe(PHAROS.pay);
    // Out of the age (a Sail Dock's keepsake keeps the convoy rule alive on any road), the lamp sleeps.
    const t = game('iron');
    const d = shore(t);
    t.players[0].walked = ['sail'];
    expect(convoyShare(t, spawnUnit(t, 0, 'cog', d.x + 2, d.y), { keep: 'sail' })).toBe(1);
  });
});
