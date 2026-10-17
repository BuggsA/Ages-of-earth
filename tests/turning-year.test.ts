import { describe, expect, it } from 'vitest';
import { HOMELANDS, SEASON, YEAR, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { gatherRate } from '../src/sim/units';
import { catchOf } from '../src/sim/year';
import { R_FISH, R_TREE } from '../src/sim/types';
import type { Animal, GameState, HomelandId, Unit } from '../src/sim/types';

/** The turning year (#479): each homeland's staple has a lean season and a fat one. */

const game = (homeland: HomelandId, seed = 1): GameState =>
  createGame({ seed, size: 'small', homeland, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });

const LEN = secs(SEASON.len);
/** Jump to just before a season's turn (`n` seasons in; nothing else moves with nobody playing), then play on `seconds`. */
const at = (s: GameState, n: number, seconds: number) => {
  if (s.tick < n * LEN - 1) s.tick = n * LEN - 1;
  const end = n * LEN + secs(seconds);
  while (s.tick < end) step(s);
};
const kept = (s: GameState, town: number) => s.animals.filter((a) => a.kind === 'deer' && a.town === town && a.hp > 0);
const from = (s: GameState, town: number, a: Animal) => Math.hypot(a.x - s.players[town].startX, a.y - s.players[town].startY);
const mean = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;

describe('the turning year (#479)', () => {
  it('the Glade keeps the old year: no herd keeps a town, and boats catch the same all year', () => {
    const s = game('glade');
    expect(s.animals.some((a) => a.town !== undefined)).toBe(false);
    for (let n = 0; n < 4; n++) {
      s.tick = n * LEN;
      expect(catchOf(s)).toBe(1);
    }
    expect(HOMELANDS.glade.year.every((l) => l === '')).toBe(true);
  });

  it('the Herd Plains: home herds trek out toward the middle in autumn and come home in spring, each deer with a calf', () => {
    const s = game('herds');
    for (const p of s.players) expect(kept(s, p.id).length).toBeGreaterThan(0);
    const mid = (a: Animal) => Math.hypot(a.x - s.w / 2, a.y - s.h / 2);
    const home = s.players.map((p) => mean(kept(s, p.id).map((a) => from(s, p.id, a))));
    const midBefore = s.players.map((p) => mean(kept(s, p.id).map(mid)));
    const herds = (town: number) => {
      const m = new Map<number, number>();
      for (const a of kept(s, town)) m.set(a.herd!, (m.get(a.herd!) ?? 0) + 1);
      return m;
    };
    // Through summer they stay at home: they don't drift like other herds.
    at(s, 2, -1);
    for (const p of s.players) expect(mean(kept(s, p.id).map((a) => from(s, p.id, a)))).toBeLessThan(YEAR.home);
    // Autumn: out to their grazing, well past the Town Center's border, nearer the middle.
    at(s, 2, 90);
    s.players.forEach((p, k) => {
      const out = kept(s, p.id).map((a) => from(s, p.id, a));
      expect(mean(out)).toBeGreaterThan(home[k] + 6);
      expect(Math.min(...out)).toBeGreaterThan(YEAR.home);
      expect(mean(kept(s, p.id).map(mid))).toBeLessThan(midBefore[k]);
    });
    // Hunt one of town 0's herds down to a single deer; leave the rest.
    const before = herds(0);
    const [thin] = [...before.keys()];
    const victims = kept(s, 0).filter((a) => a.herd === thin).slice(1);
    s.animals = s.animals.filter((a) => !victims.includes(a));
    const expected = new Map([...herds(0)].map(([h, n]) => [h, Math.min(n * (1 + YEAR.calves), Math.max(n, YEAR.herdMax))]));
    // Spring: home again, the thinned herd with one calf, the others with theirs up to the most a herd holds.
    at(s, 4, 100);
    for (const [h, n] of expected) expect(herds(0).get(h), `herd ${h}`).toBe(n);
    expect(herds(0).get(thin)).toBe(2);
    for (const p of s.players) expect(mean(kept(s, p.id).map((a) => from(s, p.id, a)))).toBeLessThan(YEAR.home);
  });

  it('the Herd Plains: a herd hunted out never comes back', () => {
    const s = game('herds', 4);
    const herd = kept(s, 1)[0].herd!;
    s.animals = s.animals.filter((a) => a.herd !== herd);
    at(s, 2, 60);
    at(s, 4, 60);
    expect(kept(s, 1).some((a) => a.herd === herd)).toBe(false);
  });

  it('the Shore: the autumn run and the winter ice change how fast a boat fishes', () => {
    const shore = game('shore');
    const glade = game('glade');
    const u = (s: GameState) => s.ents.find((e): e is Unit => e.kind === 'unit' && e.type === 'citizen' && e.owner === 0)!;
    const rate = (s: GameState, n: number) => {
      s.tick = n * LEN + 5;
      return gatherRate(s, u(s), R_FISH);
    };
    const spring = rate(shore, 0);
    expect(rate(shore, 1)).toBeCloseTo(spring);
    expect(rate(shore, 2)).toBeCloseTo(spring * YEAR.run);
    expect(rate(shore, 3)).toBeCloseTo(spring * YEAR.ice);
    expect(rate(shore, 4)).toBeCloseTo(spring);
    for (let n = 0; n < 4; n++) expect(rate(glade, n)).toBeCloseTo(rate(glade, 0));
  });

  it('the Deep Wood: deer come in to yard by every town each winter, go back out in spring, and the same ones return', () => {
    const s = game('wood');
    for (const p of s.players) expect(kept(s, p.id).length).toBe(0);
    at(s, 3, 75);
    const ids = s.players.map((p) => kept(s, p.id).map((a) => a.id));
    for (const p of s.players) {
      const yard = kept(s, p.id);
      expect(yard.length).toBe(YEAR.yard);
      for (const a of yard) {
        expect(from(s, p.id, a)).toBeLessThan(YEAR.yardMax + 3);
        let trees = 0;
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (s.res[(Math.floor(a.y) + dy) * s.w + Math.floor(a.x) + dx] === R_TREE) trees++;
        expect(trees).toBeGreaterThanOrEqual(YEAR.trees);
      }
    }
    at(s, 4, 90);
    for (const p of s.players) expect(mean(kept(s, p.id).map((a) => from(s, p.id, a)))).toBeGreaterThan(YEAR.yardMax + 3);
    at(s, 7, 75);
    s.players.forEach((p, k) => {
      expect(kept(s, p.id).map((a) => a.id)).toEqual(ids[k]);
      expect(mean(kept(s, p.id).map((a) => from(s, p.id, a)))).toBeLessThan(YEAR.yardMax + 3);
    });
  });

  it('turns the same way every time for a seed', () => {
    const run = () => {
      const s = game('herds', 6);
      at(s, 2, 60);
      at(s, 4, 60);
      return s.animals.map((a) => `${a.id}:${a.x.toFixed(4)},${a.y.toFixed(4)}`).join(' ');
    };
    expect(run()).toBe(run());
  });
});

describe('herds breed (#491)', () => {
  it('each spring a wild herd of a pair or more grows, to a cap; a lone deer breeds nothing', () => {
    const s = game('glade');
    const deer = () => s.animals.filter((a) => a.kind === 'deer' && a.hp > 0);
    const herds = () => {
      const m = new Map<number, number>();
      for (const a of deer()) m.set(a.herd ?? a.id, (m.get(a.herd ?? a.id) ?? 0) + 1);
      return m;
    };
    const before = herds();
    const lone = [...before.entries()].find(([, n]) => n >= 2)![0];
    for (const a of deer().filter((d) => (d.herd ?? d.id) === lone).slice(1)) a.hp = 0;
    s.animals = s.animals.filter((a) => a.hp > 0);
    at(s, 4, 1);
    const after = herds();
    expect(after.get(lone)).toBe(1);
    for (const [h, n] of before) if (h !== lone && n >= 2) expect(after.get(h)).toBeGreaterThan(n);
    for (const n of after.values()) expect(n).toBeLessThanOrEqual(6);
  });
});
