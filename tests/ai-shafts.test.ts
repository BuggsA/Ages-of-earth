import { describe, expect, it } from 'vitest';
import { secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { clearResource } from '../src/sim/grid';
import { R_GOLD, R_STONE } from '../src/sim/types';
import type { GameState } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer and the Mine Shaft (#681): once no stone or gold lies near home, it sinks a shaft and puts a miner down it. */

const game = (): GameState => {
  const s = createGame({ seed: 2, size: 'small', players: [{ name: 'A', ai: 'hard', civ: 'greeks' }, { name: 'B', ai: null, civ: 'greeks' }] });
  s.peaceUntil = 1e9;
  const p = s.players[0];
  p.age = 'bronze';
  p.epoch = 1;
  p.res = { food: 3000, wood: 3000, stone: 0, gold: 0 };
  for (let i = 0; i < 24; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
  placeBuilding(s, 0, 'storehouse', p.startX + 5, p.startY + 5, true);
  for (let i = 0; i < s.res.length; i++) if (s.res[i] === R_STONE || s.res[i] === R_GOLD) clearResource(s, i);
  s.tick = secs(600);
  s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: {} };
  return s;
};

describe('the computer digs shafts (#681)', () => {
  it('raises a shaft and staffs it when the deposits are gone', () => {
    const s = game();
    const shaft = () => s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'shaft' && e.built);
    const dug = () => s.ents.some((e) => e.kind === 'unit' && e.owner === 0 && e.order.k === 'shaft');
    for (let i = 0; i < secs(400) && !s.over && !(shaft() && dug()); i++) step(s);
    expect(shaft()).toBeTruthy();
    expect(dug()).toBe(true);
  });
});
