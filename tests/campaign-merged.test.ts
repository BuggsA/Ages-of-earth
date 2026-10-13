import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { SCENARIOS } from '../src/sim/campaign';
import { TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { Building, GameState } from '../src/sim/types';
import { placeBuilding } from '../src/sim/world';

/** The campaign beside the systems that came after it: relics and trading posts. */

const chapter = (id: string, wonderSeconds?: number): GameState => {
  const sc = SCENARIOS.find((c) => c.id === id)!;
  // Nobody at the controls on either side, so only the scenario and the relics act.
  return createGame({ ...sc.setup, wonderSeconds, scenario: id, players: sc.setup.players.map((p) => ({ ...p, ai: null })) });
};

const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

function keepEveryRelic(s: GameState, owner: number): void {
  const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
  const at = findSpot(s, 'temple', tc.x, tc.y, 5, 20)!;
  const t = placeBuilding(s, owner, 'temple', at.tx, at.ty, true);
  for (const r of s.relics) Object.assign(r, { carrier: 0, temple: t.id, x: t.x, y: t.y });
}

describe('the campaign with relics and trade', () => {
  it('every chapter has relics and trading posts on its map', () => {
    for (const sc of SCENARIOS) {
      const s = chapter(sc.id);
      expect(s.relics.length, sc.id).toBeGreaterThan(0);
      expect(s.posts.length, sc.id).toBeGreaterThan(0);
    }
  });

  it('keeping every relic neither wins nor loses a chapter, but the relics still pay', () => {
    for (const owner of [0, 1]) {
      const s = chapter('first-fires', 20);
      keepEveryRelic(s, owner);
      const gold = s.players[owner].res.gold;
      run(s, 60);
      expect(s.relicTeam).toBe(-1);
      expect(s.over).toBe(false);
      expect(s.scenario!.result).toBeNull();
      expect(s.players[owner].res.gold).toBeGreaterThan(gold);
    }
  });

  it('outside a chapter, keeping every relic still wins', () => {
    const sc = SCENARIOS[0];
    const s = createGame({ ...sc.setup, wonderSeconds: 20, players: sc.setup.players.map((p) => ({ ...p, ai: null })) });
    keepEveryRelic(s, 0);
    run(s, 60);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
  });
});
