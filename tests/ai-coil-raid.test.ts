import { describe, expect, it } from 'vitest';
import { AI_LIGHTNING } from '../src/sim/data';
import { enemyTarget } from '../src/sim/ai';
import { createGame } from '../src/sim/game';
import { placeBuilding, restat } from '../src/sim/world';
import type { Building, GameState } from '../src/sim/types';

const game = () => createGame({ seed: 11, size: 'small', startEpoch: 4, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const see = (s: GameState) => s.players[0].seen.fill(1);

describe('the computer raids a coil (#231)', () => {
  it('goes for the coil that alone keeps buildings lit, not an equally near plain building', () => {
    const s = game(); const q = s.players[1]; see(s);
    restat(s, q, () => { q.age = 'lightning'; });
    // Clear the rival's town so only what we place is a candidate.
    for (const e of s.ents) if (e.kind === 'building' && e.owner === 1) e.hp = 0;
    const px = s.players[0].startX, py = s.players[0].startY;
    const decoy = placeBuilding(s, 1, 'barracks', px + 10, py - 1, true) as Building;
    expect(enemyTarget(s, s.players[0])).toBe(decoy);
    // A coil a little farther out, with three houses in its field and in no other's.
    const coil = placeBuilding(s, 1, 'tower', px + 20, py + 2, true) as Building;
    for (const dy of [3, 4, 5, 6]) placeBuilding(s, 1, 'house', coil.x + 2, coil.y + dy, true);
    expect(AI_LIGHTNING.raid * 4).toBeGreaterThan(20 * 20 - 10 * 10);
    expect(enemyTarget(s, s.players[0])).toBe(coil);
  });

  it('ignores a coil another coil also covers, and any tower outside the age', () => {
    const s = game(); const q = s.players[1]; see(s);
    for (const e of s.ents) if (e.kind === 'building' && e.owner === 1) e.hp = 0;
    const px = s.players[0].startX, py = s.players[0].startY;
    const decoy = placeBuilding(s, 1, 'barracks', px + 10, py - 1, true) as Building;
    const coil = placeBuilding(s, 1, 'tower', px + 10, py + 12, true) as Building;
    for (const dy of [3, 4, 5]) placeBuilding(s, 1, 'house', coil.x + 2, coil.y + dy, true);
    expect(enemyTarget(s, s.players[0])).toBe(decoy); // Industrial: a tower is just a tower
    restat(s, q, () => { q.age = 'lightning'; });
    placeBuilding(s, 1, 'tower', coil.x + 4, coil.y + 4, true); // covers the same houses
    expect(enemyTarget(s, s.players[0])).toBe(decoy);
  });
});
