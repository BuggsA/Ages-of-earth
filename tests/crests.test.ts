import { describe, expect, test } from 'vitest';
import { crestSvg } from '../src/ui/crests';
import { CIV_IDS, PLAYER_COLORS } from '../src/sim/data';

describe('people crests (#267)', () => {
  test('every people and the random choice have their own crest in the chosen colour', () => {
    const seen = new Set<string>();
    for (const id of [...CIV_IDS, 'random' as const]) {
      const svg = crestSvg(id, PLAYER_COLORS[2]);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain(PLAYER_COLORS[2]);
      expect(svg).not.toContain('undefined');
      seen.add(svg);
    }
    expect(seen.size).toBe(CIV_IDS.length + 1);
  });
});
