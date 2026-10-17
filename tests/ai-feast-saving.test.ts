import { describe, expect, it } from 'vitest';
import { AI_FAIR, FAIR, secs } from '../src/sim/data';
import { feastSoon } from '../src/sim/ai';
import { nextFeastIn } from '../src/sim/fair';
import { createGame } from '../src/sim/game';
import { findSpot } from '../src/sim/ai';
import { placeBuilding } from '../src/sim/world';
import type { Building } from '../src/sim/types';

/** The computer holds its muster for the feast-day levy (#356). */
function setup() {
  const s = createGame({ seed: 5, size: 'medium', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  const p = s.players[0];
  p.epoch = 3;
  p.age = 'fair';
  const ts = findSpot(s, 'temple', p.startX + 6, p.startY + 6, 0, 10)!;
  const temple = placeBuilding(s, 0, 'temple', ts.tx, ts.ty, true) as Building;
  s.relics.push({ id: s.nextId++, x: temple.x, y: temple.y, carrier: 0, temple: temple.id });
  const bs = findSpot(s, 'barracks', temple.x, temple.y, 2, 8)!;
  const barracks = placeBuilding(s, 0, 'barracks', bs.tx, bs.ty, true) as Building;
  return { s, p, barracks };
}

describe('the computer saves for the feast (#356)', () => {
  it('counts down to the next feast', () => {
    const { s } = setup();
    s.tick = secs(FAIR.every) - 10;
    expect(nextFeastIn(s)).toBe(10);
    s.tick = secs(FAIR.every) + 5;
    expect(nextFeastIn(s)).toBe(0);
  });
  it('holds a unit at a fairground building just before the feast, not long before or during it', () => {
    const { s, p, barracks } = setup();
    const n = AI_FAIR.army;
    s.tick = secs(FAIR.every) - secs(AI_FAIR.save) + 5;
    expect(feastSoon(s, p, 'infantry', barracks, n)).toBe(true);
    expect(feastSoon(s, p, 'hero', barracks, n)).toBe(false);
    expect(feastSoon(s, p, 'infantry', barracks, n - 1)).toBe(false);
    s.tick = secs(FAIR.every) - secs(AI_FAIR.save) - 5;
    expect(feastSoon(s, p, 'infantry', barracks, n)).toBe(false);
    s.tick = secs(FAIR.every) + 5;
    expect(feastSoon(s, p, 'infantry', barracks, n)).toBe(false);
  });
  it('does not hold at a building off the fairground', () => {
    const { s, p, barracks } = setup();
    s.tick = secs(FAIR.every) - 5;
    barracks.x += 60;
    expect(feastSoon(s, p, 'infantry', barracks, 10)).toBe(false);
  });
  it('buys now when the purse already holds a deep hoard', () => {
    const { s, p, barracks } = setup();
    s.tick = secs(FAIR.every) - 5;
    expect(feastSoon(s, p, 'infantry', barracks, 10, 100, 25)).toBe(false);
    expect(feastSoon(s, p, 'infantry', barracks, 10, 99, 25)).toBe(true);
  });
});
