import { describe, expect, it } from 'vitest';
import { DOUBLE_ORDER, NO_TAP, doubleOrder } from '../src/ui/doubleOrder';

const tap = { at: 1000, x: 200, y: 150, before: [4, 9] };

describe('double-click as a right-click', () => {
  it('orders the units selected before the first click', () => {
    expect(doubleOrder(tap, 1200, 203, 152, false)).toEqual([4, 9]);
  });

  it('is a plain click when too slow, too far, with nothing selected, or on your own unit', () => {
    expect(doubleOrder(tap, 1000 + DOUBLE_ORDER.ms, 200, 150, false)).toBeNull();
    expect(doubleOrder(tap, 1100, 200 + DOUBLE_ORDER.px + 1, 150, false)).toBeNull();
    expect(doubleOrder({ ...tap, before: [] }, 1100, 200, 150, false)).toBeNull();
    expect(doubleOrder(tap, 1100, 200, 150, true)).toBeNull();
    expect(doubleOrder(NO_TAP, 0, 0, 0, false)).toBeNull();
  });
});
