import { describe, expect, it } from 'vitest';
import { createGame, step } from '../src/sim/game';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** A builder whose new farm is already worked takes another free field nearby (#344). */
describe('builder after a taken farm', () => {
  it('goes to a free farm rather than idle', () => {
    const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    const p = s.players[0];
    const taken = placeBuilding(s, 0, 'farm', p.startX + 6, p.startY + 6, false);
    const free = placeBuilding(s, 0, 'farm', p.startX + 6, p.startY + 9, true);
    // The builder steps first (lower id), so the farmer's order still stands when the farm completes.
    const u = spawnUnit(s, 0, 'citizen', taken.x + 1, taken.y + 1);
    const w = spawnUnit(s, 0, 'citizen', taken.x + 1, taken.y + 1);
    taken.farmer = w.id;
    taken.progress = 0.999;
    w.order = { k: 'farm', target: taken.id, phase: 'go' };
    u.order = { k: 'build', target: taken.id };
    for (let i = 0; i < 600 && !taken.built; i++) step(s);
    expect(taken.built).toBe(true);
    for (let i = 0; i < 900 && u.order.k === 'build'; i++) step(s);
    expect(u.order.k).toBe('farm');
    expect((u.order as { target: number }).target).toBe(free.id);
  });
});
