import { describe, expect, it } from 'vitest';
import { generateMap } from '../src/sim/mapgen';
import { inspect, matches, parseArgs, scan, survey, surveyTable, table } from '../scripts/seed-atlas';

describe('seed atlas deep veins', () => {
  it('reads ore lists and cave minimums, rejecting invalid or contradictory filters', () => {
    const q = parseArgs(['--ore', 'salt,bloodiron', '--ore', 'salt', '--no-ore', 'saltpetre', '--caves', '2', '--dens', '1']);
    expect(q.ores).toEqual(['salt', 'bloodiron']);
    expect(q.noOres).toEqual(['saltpetre']);
    expect(q.caves).toBe(2);
    expect(q.dens).toBe(1);
    for (const args of [['--ore', 'gold'], ['--no-ore', ''], ['--ore'], ['--caves', '-1'], ['--dens', '1.5'], ['--ore', 'salt', '--no-ore', 'salt']]) {
      expect(() => parseArgs(args)).toThrow();
    }
  });

  it('reports the rare layer used by ordinary matches, including guarded caves', () => {
    const q = parseArgs(['--size', 'medium']);
    const h = inspect(3, q);
    const m = generateMap(3, q.size, q.players, q.type, true, true);
    expect(h.ores).toEqual(m.rares);
    expect(h.ores).toContain('bloodiron');
    expect(h.caves).toBeGreaterThan(0);
    expect(h.dens).toBeGreaterThan(0);
    expect(h.caves).toBe(m.caves.length);
    expect(h.dens).toBe(m.caves.filter((c) => c.den).length);
    expect(table([h])).toContain(h.ores.join(',') || 'none');
  });

  it('requires every ore and minimum and rejects every excluded ore', () => {
    const q = parseArgs([]);
    const h = { ...inspect(7, { ...q, size: 'small' }), ores: ['salt', 'bloodiron'] as const, caves: 2, dens: 1 };
    const hit = { ...h, ores: [...h.ores] };
    expect(matches(hit, { ...q, ores: ['salt', 'bloodiron'], noOres: ['saltpetre'], caves: 2, dens: 1 })).toBe(true);
    expect(matches(hit, { ...q, ores: ['saltpetre'] })).toBe(false);
    expect(matches(hit, { ...q, noOres: ['bloodiron'] })).toBe(false);
    expect(matches(hit, { ...q, caves: 3 })).toBe(false);
    expect(matches(hit, { ...q, dens: 2 })).toBe(false);
  });

  it('partitions a seed range by ore presence without changing scan order', () => {
    const q = parseArgs(['--size', 'small', '--count', '4', '--limit', '4']);
    const all = scan(q).hits;
    const yes = scan({ ...q, ores: ['salt'] }).hits;
    const no = scan({ ...q, noOres: ['salt'] }).hits;
    expect(yes).toEqual(all.filter((h) => h.ores.includes('salt')));
    expect(no).toEqual(all.filter((h) => !h.ores.includes('salt')));
    expect(yes.length + no.length).toBe(4);
  });

  it('surveys ore frequency and cave means from inspected maps', () => {
    const q = parseArgs(['--size', 'small', '--count', '1', '--from', '7']);
    const s = survey(q);
    const h = inspect(7, q);
    expect(s.continental.salt).toBe(h.ores.includes('salt') ? 100 : 0);
    expect(s.continental.caves).toBe(h.caves);
    expect(s.continental.dens).toBe(h.dens);
    expect(surveyTable(s)).toContain('bloodiron%');
  });
});
