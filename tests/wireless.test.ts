import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { createGame } from '../src/sim/game';
import { modsOf, techProblem } from '../src/sim/stats';
import { updateVision } from '../src/sim/vision';
import type { GameState } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** Wireless Telegraphy (#240): the Sail + Lightning heirloom. */
const game = (): GameState => createGame({ seed: 11, size: 'small', startEpoch: 4, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });

describe('Wireless Telegraphy (#240)', () => {
  it('is shut until both ages are walked, then adds the mod', () => {
    const s = game();
    const p = s.players[0];
    expect(techProblem(s, 0, 'wireless')).toBe('An heirloom: walk the Age of Sail and the Age of Lightning first');
    p.walked = ['sail', 'lightning'];
    expect(techProblem(s, 0, 'wireless')).toBeNull();
    p.techs.push('wireless');
    p.statsVersion++;
    expect(modsOf(s, 0).wireless).toBe(6);
  });

  it('lets a ship in a coil field see farther, only with the heirloom', () => {
    const s = game();
    const p = s.players[0];
    const spot = findSpot(s, 'tower', p.startX, p.startY, 4, 24)!;
    const tower = placeBuilding(s, 0, 'tower', spot.tx, spot.ty, true);
    const ship = spawnUnit(s, 0, 'fisher', tower.x + 6, tower.y);
    const tile = (dx: number) => Math.floor(ship.y) * s.w + Math.floor(ship.x) + dx;
    updateVision(s);
    const far = 10;
    const before = p.vis[tile(far)];
    p.techs.push('wireless');
    p.statsVersion++;
    updateVision(s);
    expect(p.vis[tile(far)]).toBe(1);
    expect(before).toBe(0);
  });
});
