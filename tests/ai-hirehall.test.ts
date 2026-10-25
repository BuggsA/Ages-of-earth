import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { AGES, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import type { Building } from '../src/sim/types';

/** The computer in the Age of Merchants raises a Hire Hall once it has a Market (#727). */
describe('the computer and the Hire Hall (#727)', () => {
  it('raises one beside its town, and only one', () => {
    const s = createGame({ seed: 7, size: 'medium', peaceMinutes: 30, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'hard', civ: 'greeks' }] });
    s.rares = [];
    const p = s.players[1];
    restat(s, p, () => { p.age = 'merchant'; p.epoch = AGES.merchant.tier; });
    p.res = { food: 3000, wood: 3000, stone: 600, gold: 2000 };
    p.cap = 200;
    const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter')!;
    for (let i = 0; i < 12; i++) spawnUnit(s, 1, 'citizen', tc.x + 2 + (i % 6), tc.y + 4 + Math.floor(i / 6));
    const spot = findSpot(s, 'market', tc.x, tc.y, 6, 24)!;
    placeBuilding(s, 1, 'market', spot.tx, spot.ty, true);
    s.tick = secs(300);
    s.ai[1] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: {} };
    const mine = () => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 1 && e.type === 'hirehall');
    for (let i = 0; i < secs(180) && !mine().some((b) => b.built); i++) step(s);
    expect(mine().length).toBe(1);
  });
});
