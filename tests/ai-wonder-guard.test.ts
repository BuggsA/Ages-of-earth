import { describe, expect, it } from 'vitest';
import { AI_WONDER, TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { GameState } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer guards its own Wonder (#374). */

const game = (level: 'gentle' | 'easy' | 'normal'): GameState =>
  createGame({ seed: 7, size: 'small', peaceMinutes: 0, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: level, civ: 'greeks' }] });

function setup(level: 'gentle' | 'easy' | 'normal') {
  const s = game(level);
  for (const e of s.ents) if (e.kind === 'unit' && e.owner !== 0 && e.owner !== 1) e.hp = 0;
  s.animals = [];
  const b = s.players[1];
  const w = placeBuilding(s, 1, 'wonder', Math.floor(b.startX) + 12, Math.floor(b.startY), false)!;
  const army = [];
  for (let i = 0; i < 10; i++) army.push(spawnUnit(s, 1, 'infantry', b.startX + (i % 5) * 0.5, b.startY + 3));
  return { s, w, army };
}

const near = (u: { x: number; y: number }, w: { x: number; y: number }) => Math.hypot(u.x - w.x, u.y - w.y);

describe('a rising Wonder is guarded', () => {
  it('a clever computer posts soldiers at it', () => {
    const { s, w, army } = setup('normal');
    for (let i = 0; i < 40 * TICK_HZ; i++) step(s);
    const at = army.filter((u) => u.hp > 0 && near(u, w) <= AI_WONDER.stay + w.size).length;
    expect(at).toBeGreaterThanOrEqual(AI_WONDER.least);
  });

  it('answers an enemy army coming within its reach with the whole army', () => {
    const { s, w, army } = setup('normal');
    const foe = spawnUnit(s, 0, 'infantry', w.x + AI_WONDER.reach - 4, w.y);
    for (let i = 0; i < 6 * TICK_HZ; i++) step(s);
    const before = near(foe, w);
    const moved = army.filter((u) => u.hp > 0 && u.order.k !== 'idle').length;
    expect(moved).toBeGreaterThan(army.length / 2);
    expect(before).toBeLessThan(AI_WONDER.reach);
  });

  it('leaves Normal and Easy as they were', () => {
    for (const level of ['easy', 'gentle'] as const) {
      const { s, w, army } = setup(level);
      for (let i = 0; i < 20 * TICK_HZ; i++) step(s);
      expect(army.filter((u) => near(u, w) <= AI_WONDER.stay + w.size).length).toBe(0);
    }
  });
});
