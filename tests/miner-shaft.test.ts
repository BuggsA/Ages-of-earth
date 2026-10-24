import { describe, expect, it } from 'vitest';
import { createGame, step } from '../src/sim/game';
import { clearResource, placeProblem } from '../src/sim/grid';
import { giveOrder } from '../src/sim/units';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import { R_STONE, T_ROCK } from '../src/sim/types';
import type { GameState } from '../src/sim/types';

/** A person's miner whose seam runs dry takes a free Mine Shaft nearby before standing idle (#344). */

const game = (): GameState =>
  createGame({ seed: 3, size: 'small', players: [{ name: 'A', ai: null, civ: 'greeks' }, { name: 'B', ai: null }] });

function setup(s: GameState) {
  const p = s.players[0];
  // A shaft site beside rock, near the start.
  let site: { tx: number; ty: number } | null = null;
  let bestD = Infinity;
  for (let ty = 2; ty < s.h - 3; ty++) for (let tx = 2; tx < s.w - 3; tx++) {
    const d = (tx - p.startX) ** 2 + (ty - p.startY) ** 2;
    if (d >= bestD || d < 36 || placeProblem(s, 'shaft', tx, ty, true, 0)) continue;
    let rock = false;
    for (let y = ty - 2; y < ty + 4; y++) for (let x = tx - 2; x < tx + 4; x++) if (s.terrain[y * s.w + x] === T_ROCK) rock = true;
    if (rock) { bestD = d; site = { tx, ty }; }
  }
  if (!site) throw new Error('no site');
  const shaft = placeBuilding(s, 0, 'shaft', site.tx, site.ty, true);
  shaft.seam = 'stone';
  // One last stone tile; the miner works it out.
  for (let i = 0; i < s.res.length; i++) if (s.res[i] === R_STONE) clearResource(s, i);
  const tile = (site.ty + 2) * s.w + site.tx + 6;
  s.res[tile] = R_STONE;
  s.amount[tile] = 3;
  const u = spawnUnit(s, 0, 'citizen', site.tx + 6.5, site.ty + 2.5);
  placeBuilding(s, 0, 'storehouse', site.tx + 5, site.ty - 2, true);
  giveOrder(u, { k: 'gather', tile, res: 'stone', phase: 'go' });
  return { shaft, u };
}

describe('a dry seam sends the miner down a free shaft (#344)', () => {
  it('takes the shaft when the last stone is gone', () => {
    const s = game();
    const { shaft, u } = setup(s);
    for (let i = 0; i < 20 * 40 && u.order.k !== 'shaft'; i++) step(s);
    expect(u.order.k).toBe('shaft');
    if (u.order.k === 'shaft') expect(u.order.target).toBe(shaft.id);
  });
});
