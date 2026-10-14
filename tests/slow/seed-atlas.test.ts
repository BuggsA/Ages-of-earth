import { describe, expect, it } from 'vitest';
import { generateMap } from '../../src/sim/mapgen';
import { inspect, matches, parseArgs, scan, survey } from '../../scripts/seed-atlas';

describe('seed atlas', () => {
  it('reads filters and rejects bad ones', () => {
    const q = parseArgs(['--size', 'small', '--bog', '--ruin', 'lore,map', '--posts', '2']);
    expect(q.size).toBe('small');
    expect(q.bog).toBe(true);
    expect(q.finds).toEqual(['lore', 'map']);
    expect(q.posts).toBe(2);
    expect(parseArgs([]).bog).toBeUndefined();
    expect(() => parseArgs(['--size', 'huge'])).toThrow(/--size/);
    expect(() => parseArgs(['--ruin', 'gold'])).toThrow(/--ruin/);
    expect(() => parseArgs(['--count', '0'])).toThrow(/--count/);
    expect(() => parseArgs(['--count'])).toThrow(/needs a value/);
    expect(() => parseArgs(['--nope'])).toThrow(/unknown/);
  });

  it('describes a seed the way the map generator made it', () => {
    const q = { size: 'small', type: 'continental', players: 2 } as const;
    const h = inspect(7, q);
    const m = generateMap(7, 'small', 2, 'continental');
    expect(h.bog).toBe(m.bogIron);
    expect(h.posts).toBe(m.posts.length);
    expect(h.ruins).toBe(m.ruins.length);
    expect(h.finds.hoard + h.finds.lore + h.finds.map + h.finds.relic).toBe(h.ruins);
  });

  it('returns only seeds that meet every filter, in seed order, and is repeatable', () => {
    const q = parseArgs(['--size', 'small', '--count', '40', '--ruins', '1', '--limit', '5']);
    const a = scan(q);
    expect(a.hits.length).toBeGreaterThan(0);
    expect(a.hits.length).toBeLessThanOrEqual(5);
    expect(a.hits.every((h) => matches(h, q))).toBe(true);
    expect(a.hits.map((h) => h.seed)).toEqual([...a.hits.map((h) => h.seed)].sort((x, y) => x - y));
    expect(scan(q)).toEqual(a);
    const none = scan({ ...q, ruins: 999 });
    expect(none.hits).toEqual([]);
    expect(none.looked).toBe(40);
  });

  it('splits bog from no bog', () => {
    const q = parseArgs(['--size', 'small', '--count', '60', '--limit', '60']);
    const yes = scan({ ...q, bog: true }).hits;
    const no = scan({ ...q, bog: false }).hits;
    expect(yes.every((h) => h.bog)).toBe(true);
    expect(no.every((h) => !h.bog)).toBe(true);
    expect(yes.length + no.length).toBe(60);
  });

  it('surveys every map type, repeatably', () => {
    const q = { from: 1, count: 20, size: 'small', players: 2 } as const;
    const a = survey(q);
    expect(Object.keys(a).length).toBeGreaterThan(1);
    for (const r of Object.values(a)) {
      expect(r.bog).toBeGreaterThanOrEqual(0);
      expect(r.bog).toBeLessThanOrEqual(100);
    }
    expect(survey(q)).toEqual(a);
  });
});
