import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import { landOwnerAt, borderMap } from '../src/sim/borders';

const game = () => createGame({ seed: 5, size: 'small', startEpoch: 1, players: [
  { name: 'A', ai: null, civ: 'britons' }, { name: 'B', ai: null, civ: 'romans' },
] });

describe('building only in your own land (#132 s3)', () => {
  it('landOwnerAt agrees with borderMap', () => {
    const s = game();
    const own = borderMap(s);
    for (let i = 0; i < own.length; i += 37) expect(landOwnerAt(s, i % s.w, Math.floor(i / s.w))).toBe(own[i]);
  });

  it('refuses a house in enemy land but allows a tower, and own land', () => {
    const s = game();
    const own = borderMap(s);
    let spot: { x: number; y: number } | null = null;
    for (let y = 2; y < s.h - 4 && !spot; y++) for (let x = 2; x < s.w - 4; x++) {
      if (own[y * s.w + x] === 1 && !placeProblem(s, 'house', x, y) && !placeProblem(s, 'tower', x, y)) { spot = { x, y }; break; }
    }
    expect(spot).not.toBeNull();
    expect(placeProblem(s, 'house', spot!.x, spot!.y, true, 0)).toBe('foreign');
    expect(placeProblem(s, 'tower', spot!.x, spot!.y, true, 0)).toBeNull();
    expect(placeProblem(s, 'house', spot!.x, spot!.y, true, 1)).toBeNull();
  });
});
