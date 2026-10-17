import { describe, expect, it } from 'vitest';
import { ageOf } from '../../src/sim/ages';
import { secs } from '../../src/sim/data';
import { createGame, step } from '../../src/sim/game';
import { placeProblem } from '../../src/sim/grid';
import type { Building, GameState } from '../../src/sim/types';
import { placeBuilding, spawnUnit } from '../../src/sim/world';

/** The computer turns sailor (the Age of Sail, #50's walk): a coastal town whose boats have landed the catch takes the road. */

const game = (): GameState => {
  const s = createGame({ seed: 2, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: 'hard', civ: 'britons' }, { name: 'B', ai: null, civ: 'britons' }] });
  s.peaceUntil = 1e9;
  const p = s.players[0];
  p.epoch = 2;
  // Enough for the turn, not for the Gunpowder Age (another way off the road).
  p.res = { food: 700, wood: 700, stone: 100, gold: 300 };
  for (let i = 0; i < 40; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
  for (let i = 0; i < 12; i++) spawnUnit(s, 0, 'infantry', p.startX + 4 + (i % 4), p.startY - 4 - Math.floor(i / 4));
  s.tick = secs(600);
  s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: { sail: true } };
  return s;
};
const dock = (s: GameState): Building => {
  const p = s.players[0];
  let best: { tx: number; ty: number } | null = null;
  let bestD = Infinity;
  for (let ty = 1; ty < s.h; ty++)
    for (let tx = 1; tx < s.w; tx++) {
      if (placeProblem(s, 'dock', tx, ty)) continue;
      const d = (tx - p.startX) ** 2 + (ty - p.startY) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { tx, ty };
      }
    }
  return placeBuilding(s, 0, 'dock', best!.tx, best!.ty, true);
};
const run = (s: GameState, seconds: number, until: () => boolean) => {
  for (let i = 0; i < secs(seconds) && !s.over && !until(); i++) step(s);
};

describe('the computer turns sailor', () => {
  it('takes the Age of Sail once its boats have landed the catch', () => {
    const s = game();
    dock(s);
    s.players[0].stats.fished = 500;
    run(s, 90, () => ageOf(s.players[0]) === 'sail');
    expect(ageOf(s.players[0])).toBe('sail');
  });

  it('waits on the catch', () => {
    const s = game();
    dock(s);
    run(s, 60, () => ageOf(s.players[0]) !== 'middle');
    expect(ageOf(s.players[0])).toBe('middle');
  });

  it('keeps to the trunk when it has passed the road by', () => {
    const s = game();
    s.ai[0].roads = { sail: false };
    dock(s);
    s.players[0].stats.fished = 500;
    run(s, 60, () => ageOf(s.players[0]) === 'sail');
    expect(ageOf(s.players[0])).not.toBe('sail');
  });

  it('comes ashore when its last Dock is lost', () => {
    const s = game();
    const d = dock(s);
    s.players[0].stats.fished = 500;
    run(s, 90, () => ageOf(s.players[0]) === 'sail');
    expect(ageOf(s.players[0])).toBe('sail');
    d.hp = 0;
    s.players[0].res = { food: 700, wood: 700, stone: 100, gold: 300 };
    run(s, 90, () => ageOf(s.players[0]) !== 'sail');
    expect(ageOf(s.players[0])).toBe('middle');
  });

  it('keeps a small fleet once it sails, and not before', () => {
    const fleet = (road: boolean) => {
      const s = game();
      s.ai[0].roads = { sail: road };
      dock(s);
      s.players[0].stats.fished = road ? 500 : 0;
      s.players[0].res = { food: 700, wood: 3000, stone: 100, gold: 3000 };
      run(s, 120, () => ageOf(s.players[0]) === 'sail');
      s.players[0].res = { food: 100, wood: 3000, stone: 100, gold: 3000 };
      run(s, 150, () => false);
      return s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.hp > 0 && e.type === 'warship').length;
    };
    expect(fleet(true)).toBeGreaterThan(0);
    expect(fleet(false)).toBe(0);
  });
});
