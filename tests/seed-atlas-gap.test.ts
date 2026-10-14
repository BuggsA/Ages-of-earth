import { describe, expect, it } from 'vitest';
import { inspect, matches, parseArgs, scan } from '../scripts/seed-atlas';

describe('seed atlas start distance', () => {
  it('reads --apart and --close', () => {
    const q = parseArgs(['--apart', '40', '--close', '90']);
    expect(q.apart).toBe(40);
    expect(q.close).toBe(90);
    expect(parseArgs([]).close).toBe(Infinity);
    expect(() => parseArgs(['--apart', 'far'])).toThrow(/--apart/);
  });

  it('keeps only worlds whose nearest starts lie in the band', () => {
    const q = parseArgs(['--size', 'small', '--count', '30', '--apart', '70', '--close', '80', '--limit', '30']);
    const { hits } = scan(q);
    expect(hits.every((h) => h.gap >= 70 && h.gap <= 80 && matches(h, q))).toBe(true);
    const h = inspect(1, q);
    expect(matches(h, { ...q, apart: h.gap + 1 })).toBe(false);
    expect(matches(h, { ...q, apart: h.gap, close: h.gap })).toBe(true);
  });
});
