import { describe, expect, it } from 'vitest';
import { AGES, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import type { Building } from '../src/sim/types';

/** The computer in the Age of the Horde raises a Horsetail Standard once it has a Stable and a band's worth of riders (#727). */

describe('the computer and the Horsetail Standard (#727)', () => {
  it('raises one, and only one', () => {
    const s = createGame({ seed: 3, size: 'small', mapType: 'plains', players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    p.epoch = AGES.horde.tier;
    p.age = 'horde';
    p.walked = ['steppe', 'horde'];
    p.res = { food: 3000, wood: 3000, stone: 600, gold: 800 };
    s.players[1].res.gold = 500;
    const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    placeBuilding(s, 0, 'stable', tc.tx + 5, tc.ty, true).built = true;
    for (let i = 0; i < 20; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
    for (let i = 0; i < 8; i++) spawnUnit(s, 0, 'cavalry', p.startX + 3 + (i % 4), p.startY - 4 - Math.floor(i / 4));
    s.tick = secs(300);
    s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: {} };
    const mine = () => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'standard');
    for (let i = 0; i < secs(300) && !mine().some((x) => x.built); i++) step(s);
    expect(mine().length).toBe(1);
  });
});
