import { describe, expect, it } from 'vitest';
import { prospected } from '../src/sim/ages';
import { findSpot } from '../src/sim/ai';
import { createGame, step } from '../src/sim/game';
import { techProblem } from '../src/sim/stats';
import { placeBuilding } from '../src/sim/world';

// Survey the Land is granted by a Prospector's Lodge, never researched (#563, the owner's ruling of 2026-10-22).
describe('Survey the Land is retired from the Storehouse (#563)', () => {
  it('refuses research anywhere, and only a lodge grants it', () => {
    const s = createGame({ seed: 1, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    const p = s.players[0];
    p.res = { food: 500, wood: 500, stone: 500, gold: 500 };
    expect(techProblem(s, 0, 'survey')).toBe("Learned when a Prospector's Lodge is raised");
    const at = findSpot(s, 'storehouse', p.startX, p.startY, 4, 14)!;
    const store = placeBuilding(s, 0, 'storehouse', at.tx, at.ty, true);
    step(s, [{ t: 'research', p: 0, building: store.id, tech: 'survey' }]);
    const spot = findSpot(s, 'prospector', p.startX, p.startY, 4, 14)!;
    const lodge = placeBuilding(s, 0, 'prospector', spot.tx, spot.ty, true);
    step(s, [{ t: 'research', p: 0, building: lodge.id, tech: 'survey' }]);
    expect(store.queue).toEqual([]);
    expect(lodge.queue).toEqual([]);
    expect(p.res).toEqual({ food: 500, wood: 500, stone: 500, gold: 500 });
    expect(prospected(p)).toBe(false);
  });
});
