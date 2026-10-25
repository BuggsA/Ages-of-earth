import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { warheadFor } from '../src/sim/ai';
import { restat, placeBuilding } from '../src/sim/world';
import type { Building } from '../src/sim/types';

/** A warhead hurts anyone, so the computer weighs what a strike would take from its own side (owner ruling, 2026-10-25). */

describe('the computer aims with its own losses in mind', () => {
  it('a strike that would also take its own buildings is worth less, and dropped when the loss outweighs the gain', () => {
    const s = createGame({ seed: 5, size: 'small', startEpoch: 5, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    restat(s, s.players[0], () => { s.players[0].age = 'fission'; });
    const spare = placeBuilding(s, 1, 'towncenter', s.players[1].startX < s.w / 2 ? s.w - 8 : 8, s.players[1].startY < s.h / 2 ? s.h - 8 : 8, true) as Building;
    for (const [dx, dy] of [[4, 0], [0, 4], [-4, 0], [0, -4]]) placeBuilding(s, 1, 'house', spare.tx + dx + 1, spare.ty + dy + 1, true);
    const clean = warheadFor(s, s.players[0], spare.x, spare.y)!;
    expect(clean).not.toBeNull();
    // The same strike with the computer's own houses in the blast: worth less.
    for (const [dx, dy] of [[2, 3], [3, -2], [-3, 2], [-2, -3]]) placeBuilding(s, 0, 'house', spare.tx + dx, spare.ty + dy, true);
    const mixed = warheadFor(s, s.players[0], spare.x, spare.y);
    expect(mixed === null || mixed.worth < clean.worth).toBe(true);
  });
});
