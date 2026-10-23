import { describe, expect, it } from 'vitest';
import { CIV_IDS, CIVS, WAYS, WAY_LEAN } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { openingFor } from '../src/ui/opening';

describe('the first-minute card (#555 s8)', () => {
  it('tells every people by its own loop, land and leaning Way', () => {
    const seen = new Set<string>();
    for (const civ of CIV_IDS) {
      const s = createGame({ seed: 7, size: 'small', mapType: 'continental', players: [{ name: 'A', civ, ai: null }, { name: 'B', ai: null }] });
      const o = openingFor(s, 0)!;
      expect(o.people).toBe(CIVS[civ].name);
      expect(o.lines.join(' ')).toContain(WAYS[WAY_LEAN[civ]].name);
      expect(o.later.length).toBeGreaterThan(20);
      seen.add(o.lines[1] + o.later);
    }
    expect(seen.size).toBe(CIV_IDS.length);
  });
});
