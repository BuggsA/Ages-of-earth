import { describe, expect, it } from 'vitest';
import { SPREAD } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { findResource } from '../src/sim/units';
import { spawnUnit } from '../src/sim/world';
import { R_NONE, R_TREE } from '../src/sim/types';
import { step } from '../src/sim/game';

/** A worker whose grove is gone walks to the next one a long way off before standing idle (#344). */
describe('gather far', () => {
  it('a human citizen finds a distant grove; the nearby reach alone would leave it idle', () => {
    const s = createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    const p = s.players[0];
    const t0 = findResource(s, R_TREE, p.startX, p.startY, 30);
    const u = spawnUnit(s, 0, 'citizen', p.startX, p.startY + 2);
    u.order = { k: 'gather', tile: t0, res: 'wood', phase: 'go' };
    // Strip every tree within the near reach of the tile, keep the rest of the map.
    const cx = t0 % s.w, cy = Math.floor(t0 / s.w);
    for (let y = cy - 8; y <= cy + 8; y++) for (let x = cx - 8; x <= cx + 8; x++) if (s.res[y * s.w + x] === R_TREE) s.res[y * s.w + x] = R_NONE;
    expect(findResource(s, R_TREE, cx + 0.5, cy + 0.5, 8)).toBe(-1);
    const far = findResource(s, R_TREE, cx + 0.5, cy + 0.5, SPREAD.far);
    expect(far).toBeGreaterThanOrEqual(0);
    step(s);
    expect(u.order.k).toBe('gather');
  });
});
