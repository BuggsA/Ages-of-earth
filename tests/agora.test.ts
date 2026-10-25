import { describe, expect, it } from 'vitest';
import { AGORA, secs } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import { agoraRate, agoraStep, inAgora, rim, square } from '../src/sim/agora';
import { findSpot } from '../src/sim/ai';
import type { Building, GameState } from '../src/sim/types';
import { placeBuilding } from '../src/sim/world';

// The agora (#729, the Greeks): a Market trades in proportion to the square left open round it and the town round the square.
const game = () => createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'greeks' }, { name: 'B', ai: null, civ: 'chinese' }] });
const tcOf = (s: GameState, owner: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
/** A Market on bare ground well clear of the Town Center: a clean patch is found by trying spots. */
const market = (s: GameState, owner: number): Building => {
  const spot = findSpot(s, 'market', tcOf(s, owner).x, tcOf(s, owner).y, 8, 30, 1)!;
  return placeBuilding(s, owner, 'market', spot.tx, spot.ty, true);
};

describe('the agora', () => {
  it('pays a Greek Market and no one else', () => {
    const s = game();
    market(s, 0);
    market(s, 1);
    expect(agoraRate(s, 0)).toBeGreaterThan(0);
    expect(agoraRate(s, 1)).toBe(0);
  });

  it('pays less when the square is built over, and a town round it pays more', () => {
    const s = game();
    const m = market(s, 0);
    const bare = agoraRate(s, 0);
    // A town round the square: houses past it.
    for (let k = 0; k < 4; k++) placeBuilding(s, 0, 'house', m.tx + AGORA.inner + 3 + (k % 2) * 3, m.ty + m.size + AGORA.inner + 1 + Math.floor(k / 2) * 3, true);
    const town = agoraRate(s, 0);
    expect(rim(s, m)).toBeGreaterThan(0);
    expect(town).toBeGreaterThan(bare);
    // The same houses in the square itself.
    const before = square(s, m).open;
    placeBuilding(s, 0, 'house', m.tx - 2, m.ty + 1, true);
    expect(square(s, m).open).toBeLessThan(before);
    expect(agoraRate(s, 0)).toBeLessThan(town);
  });

  it('puts the trade in the treasury every few seconds and in the stats', () => {
    const s = game();
    market(s, 0);
    s.tick = secs(AGORA.every);
    const gold = s.players[0].res.gold;
    agoraStep(s);
    expect(s.players[0].res.gold - gold).toBeCloseTo(agoraRate(s, 0) * AGORA.every, 6);
    expect(s.players[0].stats.agora).toBeGreaterThan(0);
  });

  it('keeps the computer from raising anything in a square', () => {
    const s = game();
    const m = market(s, 0);
    expect(inAgora(s, m.tx - 1, m.ty, 2)).toBe(true);
    expect(inAgora(s, m.tx + m.size + AGORA.inner + 1, m.ty, 2)).toBe(false);
    const spot = findSpot(s, 'house', m.x, m.y, 1, 8, 1)!;
    expect(inAgora(s, spot.tx, spot.ty, 2)).toBe(false);
  });
});
