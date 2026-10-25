import { describe, expect, it } from 'vitest';
import { AGES, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import type { Building } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer in the Age of Sea-Raiders raises a Raiders' Strand once it has a Dock and a ship (#727). */

describe('the computer and the Raiders\' Strand (#727)', () => {
  it('raises one, and only one', () => {
    const s = createGame({ seed: 2, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: 'hard', civ: 'britons' }, { name: 'B', ai: null, civ: 'britons' }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    p.epoch = AGES.searaider.tier;
    p.age = 'searaider';
    p.walked = ['warband', 'sail', 'searaider'];
    p.res = { food: 3000, wood: 3000, stone: 600, gold: 800 };
    let best: { tx: number; ty: number } | null = null;
    let bestD = Infinity;
    for (let ty = 1; ty < s.h; ty++)
      for (let tx = 1; tx < s.w; tx++) {
        if (placeProblem(s, 'dock', tx, ty)) continue;
        const d = (tx - p.startX) ** 2 + (ty - p.startY) ** 2;
        if (d < bestD) { bestD = d; best = { tx, ty }; }
      }
    const dock = placeBuilding(s, 0, 'dock', best!.tx, best!.ty, true);
    dock.built = true;
    spawnUnit(s, 0, 'transport', dock.x, dock.y + 2);
    for (let i = 0; i < 20; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
    s.tick = secs(300);
    s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: {} };
    const mine = () => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'strand');
    for (let i = 0; i < secs(240) && !mine().some((x) => x.built); i++) step(s);
    expect(mine().length).toBe(1);
  });
});
