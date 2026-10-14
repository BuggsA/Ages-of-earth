import { describe, expect, it } from 'vitest';
import { generateMap } from '../src/sim/mapgen';
import { formatAtlasTable, matchesAtlas, parseAtlasArgs, scanAtlas, scoutSeed, type AtlasRow } from '../scripts/seed-atlas-core';

const a = () => parseAtlasArgs([]);
const row: AtlasRow = { seed: 7, bogIron: true, ruins: ['lore', 'relic'], posts: 2, relics: 3, nearestRuin: 22 };

describe('Seed Atlas', () => {
  it('accepts both flag forms and keeps the entire reproducible recipe', () => {
    expect(a()).toMatchObject({ from: 1, count: 12, size: 'small', map: 'continental', players: 2, iron: 'any', find: 'any', minPosts: 0, json: false });
    expect(parseAtlasArgs(['--from=40', '--count', '3', '--size', 'medium', '--map=sea', '--players', '4', '--iron', 'yes', '--find=relic', '--min-posts', '2', '--json'])).toEqual({ from: 40, count: 3, size: 'medium', map: 'sea', players: 4, iron: 'yes', find: 'relic', minPosts: 2, json: true });
  });

  it('rejects bad filters, accidental unbounded scans, and wrapping seed ranges', () => {
    for (const args of [
      ['--nonesuch'], ['--size', 'gigantic'], ['--map', 'moon'], ['--find', 'treasure'],
      ['--iron', 'sometimes'], ['--players', '1'], ['--players', '5'], ['--min-posts', '-1'],
      ['--from', '1.5'], ['--count', '0'], ['--count', '501'], ['--count'],
      ['--from', '4294967295', '--count', '2'],
    ]) expect(() => parseAtlasArgs(args)).toThrow();
  });

  it('filters for real opportunities, including a missing iron road', () => {
    expect(matchesAtlas(row, { iron: 'yes', find: 'relic', minPosts: 2 })).toBe(true);
    expect(matchesAtlas(row, { iron: 'no', find: 'any', minPosts: 0 })).toBe(false);
    expect(matchesAtlas(row, { iron: 'any', find: 'hoard', minPosts: 0 })).toBe(false);
    expect(matchesAtlas(row, { iron: 'any', find: 'any', minPosts: 3 })).toBe(false);
  });

  it('scouts the actual map generator and repeats a seed exactly', () => {
    const opts = { size: 'small', map: 'continental', players: 2 } as const;
    const report = scoutSeed(9, opts);
    const world = generateMap(9, opts.size, opts.players, opts.map);
    expect(scoutSeed(9, opts)).toEqual(report);
    expect(report).toMatchObject({ seed: 9, bogIron: world.bogIron, posts: world.posts.length, relics: world.relics.length, ruins: world.ruins.map((r) => r.find) });
    expect(report.nearestRuin === null || report.nearestRuin >= 0).toBe(true);
  });

  it('scans an inclusive range, then prints the shareable settings and the matching worlds', () => {
    const opts = { ...a(), from: 9, count: 2 };
    const reports = scanAtlas(opts);
    expect(reports.map((r) => r.seed)).toEqual([9, 10]);
    expect(formatAtlasTable(reports, opts)).toContain('small continental | 2 players');
    expect(formatAtlasTable([], opts)).toContain('No matching seeds');
  });
});
