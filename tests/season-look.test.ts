import { describe, expect, it } from 'vitest';
import { SEASON, secs } from '../src/sim/data';
import { BLEND, MELT, SETTLE, seasonLook } from '../src/render/seasonLook';
import { seasonAt } from '../src/sim/seasons';
import type { GameState } from '../src/sim/types';

const len = secs(SEASON.len);
const at = (season: number, seconds: number, year = 0) => (year * 4 + season) * len + secs(seconds);

describe('the turning year on the land', () => {
  it('shows the season the rules are in, mid-season', () => {
    for (let tick = 0; tick < len * 8; tick += 97) {
      const into = (tick % len) / secs(1);
      if (SEASON.len - into < BLEND) continue;
      const { w } = seasonLook(tick);
      const i = seasonAt({ tick } as GameState, tick);
      expect(w[i]).toBe(1);
    }
  });

  it('fades into the next season over the last seconds, weights summing to one', () => {
    for (let tick = 0; tick < len * 8; tick += 13) {
      const { w } = seasonLook(tick);
      expect(w[0] + w[1] + w[2] + w[3]).toBeCloseTo(1, 9);
    }
    const mid = seasonLook(at(2, SEASON.len - BLEND / 2));
    expect(mid.w[2]).toBeCloseTo(0.5, 6);
    expect(mid.w[3]).toBeCloseTo(0.5, 6);
    // Winter fades back into spring.
    expect(seasonLook(at(3, SEASON.len - 1)).w[0]).toBeGreaterThan(0.9);
  });

  it('no snow lies at the start of a match, and none in summer or autumn', () => {
    expect(seasonLook(0).snow).toBe(0);
    expect(seasonLook(at(1, 60)).snow).toBe(0);
    expect(seasonLook(at(2, SEASON.len - 1)).snow).toBe(0);
  });

  it('snow settles through early winter and melts in the next spring', () => {
    expect(seasonLook(at(3, 0)).snow).toBe(0);
    expect(seasonLook(at(3, SETTLE / 2)).snow).toBeCloseTo(0.5, 6);
    expect(seasonLook(at(3, SETTLE)).snow).toBe(1);
    expect(seasonLook(at(3, SEASON.len - 1)).snow).toBe(1);
    expect(seasonLook(at(0, 0, 1)).snow).toBe(1);
    expect(seasonLook(at(0, MELT / 2, 1)).snow).toBeCloseTo(0.5, 6);
    expect(seasonLook(at(0, MELT, 1)).snow).toBe(0);
  });
});
