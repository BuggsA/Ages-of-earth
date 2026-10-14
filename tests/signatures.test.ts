import { describe, expect, it } from 'vitest';
import { CIV_IDS, SIGNATURES, unitStats } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { statsFor } from '../src/sim/stats';

describe('signature units', () => {
  // Four seats at most per match: two matches cover the six peoples.
  const make = (civs: typeof CIV_IDS) =>
    createGame({ seed: 3, size: 'medium', startEpoch: 3, players: civs.map((civ, i) => ({ name: `P${i}`, ai: null, civ })) });
  const games = [make(CIV_IDS.slice(0, 3)), make(CIV_IDS.slice(3))];

  it('every people renames and changes its signature line, and no other people sees it', () => {
    CIV_IDS.forEach((civ, n) => {
      const s = games[Math.floor(n / 3)];
      const i = n % 3;
      const sig = SIGNATURES[civ];
      const mine = statsFor(s, i, sig.type);
      const base = unitStats(sig.type, s.players[i].epoch);
      expect(mine.name).toBe(sig.names[3]);
      expect(mine.blurb).toContain(sig.blurb);
      expect(JSON.stringify(mine)).not.toBe(JSON.stringify({ ...base }));
      expect(mine.cost).toEqual(base.cost);
      const other = (i + 1) % 3;
      if (SIGNATURES[s.players[other].civ].type !== sig.type) expect(statsFor(s, other, sig.type).name).toBe(base.name);
    });
  });

  it('names cover every epoch', () => {
    for (const civ of CIV_IDS) expect(SIGNATURES[civ].names.length).toBe(5);
  });
});
