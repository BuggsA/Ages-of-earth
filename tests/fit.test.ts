import { describe, expect, it } from 'vitest';
import { AGES, FIT, FITS, ROUTES, TRUNK } from '../src/sim/data';
import { fitsFor, fitsOf, landNear, pressOn } from '../src/sim/fit';
import { createGame } from '../src/sim/game';
import { spawnUnit } from '../src/sim/world';
import { T_WATER, type AgeId, type GameState } from '../src/sim/types';

/** Here, because (the owner, 2026-10-30): an age says why it helps or hurts here, from the map, the rival and the pressure on the town. */

const ids = Object.keys(AGES) as AgeId[];
const game = (): GameState => createGame({ seed: 3, size: 'small', mapType: 'continental', homeland: 'glade', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
/** Floods (and shows) a block of tiles by player 0's start, `n` tiles of it. */
const water = (s: GameState, n: number) => {
  const p = s.players[0];
  let k = 0;
  for (let dy = 6; dy < 20 && k < n; dy++)
    for (let dx = -10; dx <= 10 && k < n; dx++) {
      const i = (Math.floor(p.startY) + dy) * s.w + Math.floor(p.startX) + dx;
      s.terrain[i] = T_WATER;
      p.seen[i] = 1;
      k++;
    }
};

describe('the fits in the data', () => {
  it('name real ages and routes, read in words and never a number', () => {
    for (const [id, fits] of Object.entries(FITS)) {
      expect(AGES[id as AgeId], id).toBeDefined();
      for (const f of fits!) {
        if (f.k === 'pace') continue;
        expect(f.why.trim(), id).toBeTruthy();
        expect(f.why, `${id}: a number in "${f.why}"`).not.toMatch(/[0-9%]/);
        expect(f.why, `${id}: one clause, no full stop`).not.toMatch(/[.\n]/);
        if (f.k === 'rival') {
          expect((f.ages?.length ?? 0) + (f.routes?.length ?? 0), id).toBeGreaterThan(0);
          for (const a of f.ages ?? []) expect(AGES[a], `${id}: unknown age ${a}`).toBeDefined();
          for (const r of f.routes ?? []) expect(ROUTES[r], `${id}: unknown route ${r}`).toBeDefined();
        }
      }
    }
  });

  it('every side age but the Golden Age has a reason tied to its situation, and every gateway reads as an investment', () => {
    for (const id of ids) {
      if (TRUNK.includes(id) || id === 'golden') continue;
      expect(fitsFor(id).length, `${id} has no fits`).toBeGreaterThan(0);
      if (AGES[id].gateway) expect(fitsFor(id).some((f) => f.k === 'pace' && f.on === 'slow'), id).toBe(true);
    }
  });

  it('most ages that read the rival can also be read against: no fit list is all for and no against across the web', () => {
    // A web where every reason is a ✔ makes every age look good everywhere: some must hurt, by land, rival or pace.
    const cons = ids.filter((id) => fitsFor(id).some((f) => (f.k === 'land' && f.need) || (f.k === 'rival' && f.con) || (f.k === 'pace')));
    expect(cons.length).toBeGreaterThan(ids.length / 2);
  });
});

describe('reading the situation', () => {
  it('a sea age reads ✘ by a dry town and ✔ by the water, from tiles the player has seen', () => {
    const s = game();
    const p = s.players[0];
    expect(landNear(s, p).water).toBeLessThan(FIT.land.water.poor);
    expect(fitsOf(s, p, 'sail').find((f) => f.k === 'land')).toMatchObject({ pro: false, on: 'water' });
    water(s, FIT.land.water.rich + 5);
    expect(landNear(s, p).water).toBeGreaterThanOrEqual(FIT.land.water.rich);
    expect(fitsOf(s, p, 'sail').find((f) => f.k === 'land')).toMatchObject({ pro: true, on: 'water' });
    // An age that only likes water says nothing by a dry town.
    const dry = game();
    expect(fitsOf(dry, dry.players[0], 'rivers').filter((f) => f.k === 'land')).toEqual([]);
  });

  it('water the player has never seen does not count', () => {
    const s = game();
    const p = s.players[0];
    water(s, FIT.land.water.rich + 5);
    p.seen.fill(0);
    expect(landNear(s, p).water).toBe(0);
  });

  it('the age a rival stands in is read: the Locks against an army route, and against a delving rival', () => {
    const s = game();
    const p = s.players[0];
    const o = s.players[1];
    expect(fitsOf(s, p, 'locks').filter((f) => f.k === 'rival')).toEqual([]);
    o.age = 'warband';
    o.epoch = AGES.warband.tier;
    expect(fitsOf(s, p, 'locks').filter((f) => f.k === 'rival')).toEqual([expect.objectContaining({ pro: true, rival: 1, age: 'warband' })]);
    o.age = 'delvings';
    o.epoch = AGES.delvings.tier;
    expect(fitsOf(s, p, 'locks').filter((f) => f.k === 'rival')).toEqual([expect.objectContaining({ pro: false, rival: 1, age: 'delvings' })]);
  });

  it('rival soldiers by the town turn a long investment against and a quick payoff for', () => {
    const s = game();
    const p = s.players[0];
    expect(fitsOf(s, p, 'locks').find((f) => f.k === 'pace')).toMatchObject({ pro: true, on: 'slow' });
    expect(fitsOf(s, p, 'warband').find((f) => f.k === 'pace')).toBeUndefined();
    for (let i = 0; i < FIT.press; i++) {
      const u = spawnUnit(s, 1, 'infantry', p.startX + 3 + i, p.startY + 3);
      p.vis[Math.floor(u.y) * s.w + Math.floor(u.x)] = 1;
    }
    expect(pressOn(s, p)).toBe(FIT.press);
    expect(fitsOf(s, p, 'locks').find((f) => f.k === 'pace')).toMatchObject({ pro: false, on: 'slow', near: FIT.press });
    expect(fitsOf(s, p, 'warband').find((f) => f.k === 'pace')).toMatchObject({ pro: true, on: 'quick' });
  });

  it('the same age reads differently for two towns on different land', () => {
    const s = game();
    water(s, FIT.land.water.rich + 5);
    const a = fitsOf(s, s.players[0], 'dykes').map((f) => f.pro);
    const b = fitsOf(s, s.players[1], 'dykes').map((f) => f.pro);
    expect(a).toEqual([true]);
    expect(b).toEqual([false]);
  });
});
