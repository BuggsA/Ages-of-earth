import { describe, expect, it } from 'vitest';
import { AGES, AI_WATERLINE, INUND, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { isInund } from '../src/sim/water';
import type { Building, GameState } from '../src/sim/types';
import { restat, spawnUnit } from '../src/sim/world';

/** The computer in the Age of the Water Line (#701 s4): it sets a sluice, keeps gun-barges, and opens the sluice when an army comes. */

function lineTown(): { s: GameState; o: number } {
  const s = createGame({ seed: 4, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: null }] });
  const p = s.players[0];
  s.peaceUntil = 1e9;
  restat(s, p, () => {
    p.epoch = AGES.waterline.tier;
    p.age = 'waterline';
    p.walked = [...(p.walked ?? []), 'dykes', 'waterline'];
  });
  p.res = { food: 3000, wood: 3000, stone: 1500, gold: 2000 };
  return { s, o: 0 };
}

const sluiceOf = (s: GameState, o: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === o && e.type === 'sluice');

describe('the computer in the Age of the Water Line (#701 s4)', () => {
  it('sets a sluice by home, launches gun-barges from it, and opens it when an enemy army comes', () => {
    const { s, o } = lineTown();
    for (let i = 0; i < secs(120) && !sluiceOf(s, o)?.built; i++) step(s);
    const sluice = sluiceOf(s, o)!;
    expect(sluice?.built).toBe(true);
    expect(sluice.open).toBeFalsy();
    for (let i = 0; i < secs(90) && !s.ents.some((e) => e.kind === 'unit' && e.owner === o && e.type === 'barge'); i++) step(s);
    expect(s.ents.some((e) => e.kind === 'unit' && e.owner === o && e.type === 'barge')).toBe(true);
    // An army of the rival's walks up to the sluice.
    s.peaceUntil = 0;
    for (let i = 0; i < AI_WATERLINE.threat + 2; i++) spawnUnit(s, 1, 'infantry', sluice.x + 3 + (i % 3) * 0.5, sluice.y + 3 + Math.floor(i / 3) * 0.5);
    for (let i = 0; i < secs(3) && !sluice.open; i++) step(s);
    expect(sluice.open).toBe(true);
    for (let i = 0; i < secs(INUND.every * 3); i++) step(s);
    expect(s.inund && s.inund.some((v, t) => v !== 0 && isInund(s, t))).toBe(true);
    // Once the army is gone, it shuts the sluice again.
    for (const e of s.ents) if (e.kind === 'unit' && e.owner === 1) e.hp = 0;
    for (let i = 0; i < secs(AI_WATERLINE.calm + 3) && sluice.open; i++) step(s);
    expect(sluice.open).toBeFalsy();
  });
});
