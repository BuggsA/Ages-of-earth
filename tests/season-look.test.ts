import { describe, expect, it } from 'vitest';
import { SEASON, secs } from '../src/sim/data';
import { BLEND, MELT, SETTLE, iceCover, lookFor, mapTint, seasonLook } from '../src/render/seasonLook';
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

describe('the minimap wears the season', () => {
  const tint = (tick: number, woods: boolean) => mapTint(seasonLook(tick), woods);
  it('keeps spring meadow the old green, turns summer gold and autumn woods orange', () => {
    expect(tint(at(0, 60, 0), false)).toEqual([111, 165, 72]);
    expect(tint(at(1, 60), false)[0]).toBeGreaterThan(tint(at(0, 60), false)[0]);
    const autumn = tint(at(2, 60), true);
    expect(autumn[0]).toBeGreaterThan(autumn[1]);
  });
  it('lays white over winter meadow as the snow settles and lifts it in spring', () => {
    const early = tint(at(3, 0), false);
    const late = tint(at(3, SETTLE + 10), false);
    expect(late[2]).toBeGreaterThan(early[2]);
    expect(late[2]).toBeGreaterThan(200);
    expect(tint(at(0, MELT + 5, 1), false)[2]).toBeLessThan(late[2]);
  });
  it('holds a forced season', () => {
    expect(lookFor(0, 3).snow).toBe(1);
    expect(lookFor(12345, null)).toEqual(seasonLook(12345));
  });
});

describe('ice on the lakes', () => {
  it('freezes the shallows first and leaves the deep open until the snow lies full', () => {
    expect(iceCover(0, 0.05)).toBe(0);
    expect(iceCover(0.5, 0.05)).toBe(1);
    expect(iceCover(0.5, 0.9)).toBe(0);
    expect(iceCover(1, 0.3)).toBe(1);
    expect(iceCover(1, 0.9)).toBe(0);
  });
  it('spreads outward as the snow settles', () => {
    let last = 0;
    for (const snow of [0.2, 0.4, 0.6, 0.8, 1]) {
      const c = iceCover(snow, 0.3);
      expect(c).toBeGreaterThanOrEqual(last);
      last = c;
    }
  });
});
