import { describe, expect, it } from 'vitest';
import { markWorth } from '../src/sim/ai';
import { AI_MARK, TICK_HZ } from '../src/sim/data';
import { claimWork } from '../src/sim/landmarks';
import { createGame, step } from '../src/sim/game';
import type { GameState, Unit } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** The computer holds what it keeps: it sends soldiers to a landmark of its own that rivals are pulling down. */

const game = (): GameState =>
  createGame({ seed: 7, size: 'small', peaceMinutes: 0, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'hard', civ: 'greeks' }] });

describe('the computer defends its landmarks', () => {
  it('sends its idle soldiers to a landmark of its own that a rival stands on alone', () => {
    const s = game();
    const ai = s.players[1];
    const m = s.landmarks![0];
    m.owner = ai.id;
    m.by = ai.id;
    m.claim = claimWork();
    // A rival raider sits on it; the computer has a band of soldiers at home.
    spawnUnit(s, 0, 'citizen', m.x + 0.5, m.y + 0.5);
    const home = s.ents.find((e) => e.kind === 'building' && e.owner === ai.id)!;
    const band: Unit[] = [];
    for (let i = 0; i < 4; i++) band.push(spawnUnit(s, ai.id, 'infantry', home.x + 2 + i * 0.4, home.y + 3));
    for (let i = 0; i < 12 * TICK_HZ; i++) step(s);
    const gone = band.filter((u) => u.hp > 0 && (u.order.k === 'move' || u.order.k === 'attack') && Math.hypot(u.x - home.x, u.y - home.y) > 3);
    expect(gone.length).toBeGreaterThanOrEqual(3);
  }, 30000);
});

describe('the computer prizes its own people\'s kind of landmark', () => {
  it('finds a favoured kind worth a longer walk than the same kind to a people that does not favour it', () => {
    const s = game();
    const m = s.landmarks![0];
    for (const [civ, kind] of [['greeks', 'spring'], ['mongols', 'crag'], ['chinese', 'grove']] as const) {
      s.players[1].civ = civ;
      m.kind = kind;
      const view = { p: s.players[1], citizens: [], army: [] } as never;
      const own = markWorth(s, view, m);
      s.players[1].civ = 'romans';
      expect(own).toBeCloseTo(markWorth(s, view, m) * AI_MARK.worth.kin, 6);
    }
  });
});
