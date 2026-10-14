import { describe, expect, it } from 'vitest';
import { arrivalText, epochArrivals } from '../src/ui/endReport';
import type { HistoryPoint } from '../src/sim/types';

const pt = (tick: number, epoch: number): HistoryPoint => ({ tick, pop: 0, military: 0, gathered: 0, score: 0, epoch });

describe('end report', () => {
  it('finds when each epoch was reached, including skipped ones', () => {
    const h = [pt(0, 0), pt(100, 0), pt(200, 1), pt(300, 1), pt(400, 3)];
    expect(epochArrivals(h)).toEqual([[1, 200], [2, 400], [3, 400]]);
    expect(epochArrivals([])).toEqual([]);
  });
  it('writes minutes', () => {
    expect(arrivalText([[1, 600], [2, 1250]], ['Stone', 'Bronze', 'Iron'], 10)).toBe('Bronze 1m · Iron 2m');
  });
});
