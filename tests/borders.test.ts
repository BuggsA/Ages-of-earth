import { describe, expect, it } from 'vitest';
import { BORDERS } from '../src/sim/data';
import { borderMap } from '../src/sim/borders';
import { createGame } from '../src/sim/game';
import { serialize } from '../src/sim/save';
import { placeBuilding } from '../src/sim/world';

const game = () => createGame({ seed: 5, size: 'small', startEpoch: 1, players: [
  { name: 'A', ai: null, civ: 'britons' }, { name: 'B', ai: null, civ: 'romans' },
] });

describe('borders', () => {
  it('give each town its land and leave the far ground to no one', () => {
    const s = game();
    const own = borderMap(s);
    const a = s.players[0];
    expect(own[Math.floor(a.startY) * s.w + Math.floor(a.startX)]).toBe(0);
    expect(own[Math.floor(s.players[1].startY) * s.w + Math.floor(s.players[1].startX)]).toBe(1);
    expect(own.some((o) => o === -1)).toBe(true);
    expect(BORDERS.towncenter).toBeGreaterThan(BORDERS.tower!);
  });

  it('count only finished, living claimants and never change the state', () => {
    const s = game();
    const before = serialize(s);
    const x = 3, y = 3;
    placeBuilding(s, 0, 'tower', x, y, false);
    expect(borderMap(s)[y * s.w + x]).toBe(-1);
    placeBuilding(s, 0, 'tower', x, y + 20, true);
    expect(borderMap(s)[(y + 20) * s.w + x]).toBe(0);
    expect(serialize(s)).not.toBe(before);
    const t = serialize(s);
    borderMap(s);
    expect(serialize(s)).toBe(t);
  });
});
