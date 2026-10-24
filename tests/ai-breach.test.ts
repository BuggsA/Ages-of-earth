import { describe, expect, it } from 'vitest';
import { wallLine } from '../src/sim/commands';
import { AGES, AI_DYKE, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { dykePlan, isPolder } from '../src/sim/water';
import type { Building, GameState } from '../src/sim/types';
import { restat } from '../src/sim/world';

/** The computer and the breach (#701 s3): a gap in a line that once stood whole is mended at once, in the age or after it. */

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

const until = (s: GameState, sec: number, done: () => boolean) => {
  for (let i = 0; i < secs(sec) && !done(); i++) step(s);
};

/** Its line raised and some polder won, then one dyke of it gone. */
function breached(): { s: GameState; o: number; gap: number } {
  const { s, o } = dykeTown();
  until(s, 300, () => (s.players[o].stats.drained ?? 0) >= 3);
  expect(s.ai[o].dyke!.raised).toBe(true);
  const plan = s.ai[o].dyke!.plan!;
  const gap = plan.line[plan.line.length >> 1];
  const b = s.byId.get(s.bldAt[gap]) as Building;
  expect(b.type).toBe('dyke');
  b.hp = 0;
  step(s);
  return { s, o, gap };
}

const mended = (s: GameState, o: number, gap: number) => {
  const b = s.byId.get(s.bldAt[gap]);
  return !!b && b.kind === 'building' && b.type === 'dyke' && b.owner === o && b.built;
};

describe('the computer and the breach (#701 s3)', () => {
  it('mends a breach in its line in the Age of Dykes', () => {
    const { s, o, gap } = breached();
    until(s, 60, () => mended(s, o, gap));
    expect(mended(s, o, gap)).toBe(true);
    const plan = s.ai[o].dyke!.plan!;
    // Pumped dry again, at least in part.
    until(s, 60, () => plan.basin.filter((t) => isPolder(s, t)).length >= 3);
    expect(plan.basin.filter((t) => isPolder(s, t)).length).toBeGreaterThanOrEqual(3);
  });

  it('mends it after leaving the age too, for a people that walked the Dykes', () => {
    const { s, o, gap } = breached();
    const p = s.players[o];
    p.walked = [...(p.walked ?? []), 'dykes'];
    restat(s, p, () => {
      p.epoch = AGES.gunpowder.tier;
      p.age = 'gunpowder';
    });
    until(s, 60, () => mended(s, o, gap));
    expect(mended(s, o, gap)).toBe(true);
  });
});
