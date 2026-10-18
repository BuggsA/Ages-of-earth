import { describe, expect, it } from 'vitest';
import { aiStep, floodBuildHeld, floodComing } from '../src/sim/ai';
import { FLOOD, SEASON, secs } from '../src/sim/data';
import { createGame } from '../src/sim/game';
import type { Building, GameState } from '../src/sim/types';

// The Egyptian computer plays the flood's rhythm (#517): big builds wait for the river, food is laid up in spring.
const inSeason = (i: number) => secs(SEASON.len) * i + 1;

function rich(civ: 'egyptians' | 'romans', season: number): GameState {
  const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: 'hard', civ }, { name: 'B', ai: null, civ: 'greeks' }] });
  const p = s.players[0];
  p.epoch = 3;
  p.res = { food: 5000, wood: 5000, gold: 5000, stone: 5000 };
  s.tick = inSeason(season);
  return s;
}
const think = (s: GameState) => {
  for (let i = 0; i < 4; i++) {
    aiStep(s);
    s.tick += secs(15);
    s.players[0].res = { food: 5000, wood: 5000, gold: 5000, stone: 5000 };
  }
};
const built = (s: GameState, type: string) => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === type).length;

describe('the Egyptian computer and the flood (#517)', () => {
  it('keeps its wonder for the flood, when the corvée builds twice as fast', () => {
    for (const season of [0, 2, 3]) {
      const s = rich('egyptians', season);
      think(s);
      expect(built(s, 'wonder'), `season ${season}`).toBe(0);
    }
    const s = rich('egyptians', FLOOD.season);
    think(s);
    expect(built(s, 'wonder')).toBe(1);
  });

  it('does not make another people wait', () => {
    const s = rich('romans', 0);
    think(s);
    expect(built(s, 'wonder')).toBe(1);
  });

  it('leans to food in the spring before the flood, and keeps its wonder for the river', () => {
    for (let season = 0; season < 4; season++) {
      const s = rich('egyptians', season);
      const p = s.players[0];
      expect(floodComing(s, p), `season ${season}`).toBe(season === (FLOOD.season + 3) % 4);
      expect(floodBuildHeld(s, p), `season ${season}`).toBe(season !== FLOOD.season);
      // Not for another people, nor for the plain computer.
      const r = rich('romans', season);
      expect(floodComing(r, r.players[0])).toBe(false);
      expect(floodBuildHeld(r, r.players[0])).toBe(false);
      p.ai = 'easy';
      expect(floodComing(s, p)).toBe(false);
    }
  });
});
