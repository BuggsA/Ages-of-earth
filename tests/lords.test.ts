import { describe, expect, it } from 'vitest';
import { LANDMARKS, TICK_HZ } from '../src/sim/data';
import { claimWork } from '../src/sim/landmarks';
import { createGame, step } from '../src/sim/game';
import type { GameState } from '../src/sim/types';

/** Lords of the Land: keep every landmark for LANDMARKS.lordsSeconds and win. */

const game = (): GameState =>
  createGame({ seed: 7, size: 'small', mode: 'lords', peaceMinutes: 0, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'greeks' }] });

const hold = (s: GameState, player: number, n = s.landmarks!.length): void => {
  for (const m of s.landmarks!.slice(0, n)) {
    m.owner = player;
    m.claim = claimWork();
  }
};

describe('lords of the land', () => {
  it('starts a countdown once one side keeps every landmark, and stops it when one is lost', () => {
    const s = game();
    expect(s.landmarks!.length).toBeGreaterThanOrEqual(LANDMARKS.lordsMin);
    hold(s, 0, s.landmarks!.length - 1);
    step(s);
    expect(s.landTeam).toBe(-1);
    hold(s, 0);
    step(s);
    expect(s.landTeam).toBe(s.players[0].team);
    expect(s.landTimer).toBeGreaterThan(LANDMARKS.lordsSeconds * TICK_HZ - 5);
    expect(s.events.some((e) => e.k === 'landHold' && e.team === s.players[0].team)).toBe(true);
    s.landmarks![0].owner = -1;
    step(s);
    expect(s.landTeam).toBe(-1);
    expect(s.landTimer).toBe(-1);
  });

  it('wins for the keeper when the countdown ends', () => {
    const s = game();
    hold(s, 1);
    for (let i = 0; i < (LANDMARKS.lordsSeconds + 2) * TICK_HZ && !s.over; i++) step(s);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(s.players[1].team);
    expect(s.events.some((e) => e.k === 'over' && e.how === 'lands')).toBe(true);
  }, 60000);

  it('does not count with fewer landmarks than the minimum', () => {
    const s = game();
    s.landmarks = s.landmarks!.slice(0, LANDMARKS.lordsMin - 1);
    hold(s, 0);
    step(s);
    expect(s.landTeam).toBe(-1);
  });
});

describe('lords of the land is a game mode', () => {
  it('runs no countdown in a plain conquest match', () => {
    const s = createGame({ seed: 7, size: 'small', peaceMinutes: 0, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'greeks' }] });
    for (const m of s.landmarks!) {
      m.owner = 0;
      m.claim = claimWork();
    }
    step(s);
    expect(s.landTeam).toBe(-1);
  });
});
