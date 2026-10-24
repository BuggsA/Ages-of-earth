import { describe, expect, it } from 'vitest';
import { wallLine } from '../src/sim/commands';
import { AGES, AI_DYKE, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { dykePlan, isPolder } from '../src/sim/water';
import type { Building, GameState } from '../src/sim/types';
import { restat } from '../src/sim/world';

/** The computer on the Water Road (#701 s1): in the Age of Dykes it lays its planned line, raises a mill behind it and pumps the bay dry. */

function dykeTown(): { s: GameState; o: number } {
  for (let seed = 1; seed < 40; seed++) {
    const s = createGame({ seed, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: null }] });
    const p = s.players[0];
    const plan = dykePlan(s, p.startX, p.startY, AI_DYKE.reach, AI_DYKE, wallLine);
    if (!plan || !plan.line.length) continue;
    s.peaceUntil = 1e9;
    restat(s, p, () => {
      p.epoch = AGES.dykes.tier;
      p.age = 'dykes';
    });
    p.res = { food: 3000, wood: 3000, stone: 1500, gold: 1000 };
    return { s, o: 0 };
  }
  throw new Error('no such map');
}

describe('the computer in the Age of Dykes (#701 s1)', () => {
  it('lays its dyke line, raises a windmill behind it and pumps the bay', () => {
    const { s, o } = dykeTown();
    const dykes = () => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === o && e.type === 'dyke');
    for (let i = 0; i < secs(60) && !dykes().length; i++) step(s);
    expect(dykes().length).toBeGreaterThan(0);
    for (let i = 0; i < secs(300) && !(s.players[o].stats.drained ?? 0); i++) step(s);
    expect(s.ents.some((e) => e.kind === 'building' && e.owner === o && e.type === 'windmill')).toBe(true);
    expect(s.players[o].stats.drained ?? 0).toBeGreaterThan(0);
    const plan = s.ai[o].dyke!.plan!;
    expect(plan.basin.some((t) => isPolder(s, t))).toBe(true);
  });
});
