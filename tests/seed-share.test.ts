import { describe, expect, it } from 'vitest';
import { parseArgs, shareQuery } from '../scripts/seed-atlas';

describe('seed atlas --share', () => {
  it('prints the title-screen address of a world', () => {
    expect(shareQuery(42, { size: 'small', type: 'continental', players: 3 })).toBe('?seed=42&size=small&map=continental&foes=2');
  });
  it('accepts the flag', () => {
    expect(parseArgs(['--share']).share).toBe(true);
  });
});
