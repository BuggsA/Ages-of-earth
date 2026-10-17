import { describe, expect, it } from 'vitest';
import { FLOOD, SEASON, secs } from '../src/sim/data';
import { flooded } from '../src/sim/flood';
import { createGame } from '../src/sim/game';
import { buildTimeFor } from '../src/sim/stats';
import type { Unit } from '../src/sim/types';
import { gatherRate } from '../src/sim/units';

// The Nile flood (#501 s1): each summer Egyptian fields yield nothing, and the corvée builds twice as fast.
const game = () => createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'egyptians' }, { name: 'B', ai: null, civ: 'greeks' }] });
const citizenOf = (s: ReturnType<typeof game>, owner: number) => s.ents.find((e): e is Unit => e.kind === 'unit' && e.owner === owner && e.type === 'citizen')!;
const inSeason = (i: number) => secs(SEASON.len) * i + 1;

describe('the Nile flood', () => {
  it('lies over the Egyptian fields in summer only, and never over another people', () => {
    const s = game();
    for (let year = 0; year < 2; year++) {
      for (let i = 0; i < 4; i++) {
        s.tick = inSeason(year * 4 + i);
        expect(flooded(s, 0)).toBe(i === FLOOD.season);
        expect(flooded(s, 1)).toBe(false);
      }
    }
  });

  it('stops Egyptian farms in the flood, and leaves berries and other peoples alone', () => {
    const s = game();
    const egy = citizenOf(s, 0);
    const grk = citizenOf(s, 1);
    s.tick = inSeason(0);
    expect(gatherRate(s, egy, 'farm')).toBeGreaterThan(0);
    s.tick = inSeason(FLOOD.season);
    expect(gatherRate(s, egy, 'farm')).toBe(0);
    expect(gatherRate(s, grk, 'farm')).toBeGreaterThan(0);
    s.tick = inSeason(FLOOD.season + 1);
    expect(gatherRate(s, egy, 'farm')).toBeGreaterThan(0);
  });

  it('makes the corvée build twice as fast while the river is up', () => {
    const s = game();
    s.tick = inSeason(0);
    const dry = buildTimeFor(s, 0, 'house');
    const greek = buildTimeFor(s, 1, 'house');
    s.tick = inSeason(FLOOD.season);
    expect(buildTimeFor(s, 0, 'house')).toBeCloseTo(dry / FLOOD.build, 6);
    expect(buildTimeFor(s, 1, 'house')).toBeCloseTo(greek, 6);
  });
});
