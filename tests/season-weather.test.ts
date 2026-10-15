import { describe, expect, it } from 'vitest';
import { seasonalDay } from '../src/render/weather';

describe('seasonalDay', () => {
  const snow = { kind: 'snow' as const, strength: 0.8 };
  const rain = { kind: 'rain' as const, strength: 0.9 };
  it('lets snow fall only in winter', () => {
    expect(seasonalDay(snow, 3)).toEqual(snow);
    expect(seasonalDay(snow, 0).kind).toBe('rain');
    expect(seasonalDay(snow, 2).kind).toBe('rain');
    expect(seasonalDay(snow, 1).kind).toBe('mist');
  });
  it('turns winter rain to snow and leaves other days alone', () => {
    expect(seasonalDay(rain, 3)).toEqual({ kind: 'snow', strength: 0.9 });
    expect(seasonalDay(rain, 1)).toEqual(rain);
    const clear = { kind: 'clear' as const, strength: 0 };
    for (let k = 0; k < 4; k++) expect(seasonalDay(clear, k)).toEqual(clear);
  });
});
