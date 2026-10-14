import { describe, expect, it } from 'vitest';
import { describeWeather, moodOf, stormGap, weatherFor } from '../src/render/weather';
import type { MapType } from '../src/sim/types';

const LANDS: MapType[] = ['continental', 'highlands', 'lakes', 'forest', 'plains', 'sea'];

describe('weather', () => {
  it('is the same day for the same seed and land', () => {
    for (const land of LANDS) for (let seed = 1; seed < 40; seed++) expect(weatherFor(seed, land)).toEqual(weatherFor(seed, land));
  });

  it('gives every kind of day somewhere, and a mostly fair one on the plains', () => {
    const seen = new Set<string>();
    for (const land of LANDS) for (let seed = 1; seed < 400; seed++) seen.add(weatherFor(seed, land).kind);
    expect([...seen].sort()).toEqual(['clear', 'mist', 'rain', 'snow']);
    let clear = 0;
    for (let seed = 1; seed <= 500; seed++) if (weatherFor(seed, 'plains').kind === 'clear') clear++;
    expect(clear).toBeGreaterThan(300);
  });

  it('snows more on the highlands than the lakes, and rains more in the forest than on the plains', () => {
    const count = (land: MapType, kind: string) => {
      let n = 0;
      for (let seed = 1; seed <= 600; seed++) if (weatherFor(seed, land).kind === kind) n++;
      return n;
    };
    expect(count('highlands', 'snow')).toBeGreaterThan(count('lakes', 'snow') * 2);
    expect(count('forest', 'rain')).toBeGreaterThan(count('plains', 'rain') * 1.5);
  });

  it('keeps strength between half and full, and none for a clear day', () => {
    for (let seed = 1; seed < 300; seed++) {
      const d = weatherFor(seed, 'forest');
      if (d.kind === 'clear') expect(d.strength).toBe(0);
      else {
        expect(d.strength).toBeGreaterThanOrEqual(0.5);
        expect(d.strength).toBeLessThanOrEqual(1);
      }
    }
  });

  it('greys, dims and closes in only when it is not clear', () => {
    expect(moodOf({ kind: 'clear', strength: 0 })).toMatchObject({ grey: 0, sun: 1, sky: 1, reach: 1 });
    for (const kind of ['rain', 'snow', 'mist'] as const) {
      const m = moodOf({ kind, strength: 1 });
      expect(m.grey).toBeGreaterThan(0.5);
      expect(m.sun).toBeLessThan(0.6);
      expect(m.reach).toBeLessThan(0.7);
      expect(m.reach).toBeGreaterThan(0.2);
    }
  });

  it('says something about every day but a clear one', () => {
    expect(describeWeather({ kind: 'clear', strength: 0 })).toBe('');
    for (const kind of ['rain', 'snow', 'mist'] as const) expect(describeWeather({ kind, strength: 0.6 }).length).toBeGreaterThan(5);
  });

  it('spaces lightning between 12 and 40 seconds apart', () => {
    for (let n = 0; n < 50; n++) {
      expect(stormGap(n)).toBeGreaterThanOrEqual(12);
      expect(stormGap(n)).toBeLessThan(40);
    }
  });
});
