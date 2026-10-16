import { describe, expect, it } from 'vitest';
import { FAIR, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { placeBuilding } from '../src/sim/world';
import { findSpot } from '../src/sim/ai';
import { tripGold } from '../src/sim/trade';
import { fairShare } from '../src/sim/fair';

/** Feast days (#356 audit, the Age of Fairs): trade at a fairground pays more on the feast. */
function setup(age: 'fair' | 'merchant') {
  const s = createGame({ seed: 5, size: 'medium', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  const p = s.players[0];
  p.epoch = 3;
  p.age = age;
  const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
  const ms = findSpot(s, 'market', tc.x, tc.y, 4, 14)!;
  const market = placeBuilding(s, 0, 'market', ms.tx, ms.ty, true);
  const ts = findSpot(s, 'temple', market.x, market.y, 4, 8)!;
  const temple = placeBuilding(s, 0, 'temple', ts.tx, ts.ty, true);
  return { s, market, temple };
}
const post = { x: 0, y: 0 } as never;

describe('Feast days', () => {
  it('pay more at a fairground with a relic on the feast, and not otherwise', () => {
    const { s, market, temple } = setup('fair');
    s.relics.push({ id: s.nextId++, x: temple.x, y: temple.y, carrier: 0, temple: temple.id });
    s.tick = secs(FAIR.every) + 5;
    expect(fairShare(s, 0, market)).toBe(FAIR.pay);
    expect(tripGold(s, 0, market, post)).toBeGreaterThan(0);
    s.tick = secs(FAIR.every) + secs(FAIR.open) + 5;
    expect(fairShare(s, 0, market)).toBe(1);
    s.tick = secs(FAIR.every) + 5;
    s.relics[s.relics.length - 1].temple = 0;
    expect(fairShare(s, 0, market)).toBe(1);
  });
  it('leave other ages alone', () => {
    const { s, market, temple } = setup('merchant');
    s.relics.push({ id: s.nextId++, x: temple.x, y: temple.y, carrier: 0, temple: temple.id });
    s.tick = secs(FAIR.every) + 5;
    expect(fairShare(s, 0, market)).toBe(1);
  });
  it('announce the feast when it opens', () => {
    const { s, temple } = setup('fair');
    s.relics.push({ id: s.nextId++, x: temple.x, y: temple.y, carrier: 0, temple: temple.id });
    s.tick = secs(FAIR.every);
    step(s, []);
    expect(s.events.some((e) => e.k === 'fair' && e.owner === 0)).toBe(true);
  });
});
