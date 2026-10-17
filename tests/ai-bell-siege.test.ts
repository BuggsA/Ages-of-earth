import { describe, expect, it } from 'vitest';
import { AI_BELL, TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { Building, GameState, Unit } from '../src/sim/types';
import { distToRect, walkable } from '../src/sim/grid';
import { spawnUnit } from '../src/sim/world';

/** The computer's town bell sounds the all-clear for a siege that has stopped coming (#487). */

const run = (s: GameState, secs: number) => { for (let i = 0; i < secs * TICK_HZ; i++) step(s); };
/** Run with the foes pinned where they stand: a standing army that won't be drawn off or shot. */
const runPinned = (s: GameState, foes: Unit[], secs: number) => {
  const at = foes.map((u) => [u.x, u.y]);
  for (let i = 0; i < secs * TICK_HZ; i++) { foes.forEach((u, k) => { u.x = at[k][0]; u.y = at[k][1]; u.path = null; }); step(s); }
};

function setup() {
  const s = createGame({ seed: 7, size: 'small', peaceMinutes: 0, startEpoch: 1, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'normal', civ: 'greeks' }] });
  s.animals = [];
  s.players[1].res = { food: 2000, wood: 2000, stone: 2000, gold: 2000 };
  run(s, 60);
  s.ents = s.ents.filter((e) => !(e.kind === 'unit' && e.owner === 1 && e.type !== 'citizen'));
  const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter')!;
  const mine = s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 1 && e.hp > 0);
  /** A walkable spot `gap` tiles from the town's nearest building, as close as it can be to `near` (so the foes edge in, not jump about). */
  const at = (gap: number, near?: { x: number; y: number }) => {
    let best = { x: 0, y: 0 };
    let bestD = Infinity;
    for (let y = 1; y < s.h - 1; y += 0.5) for (let x = 1; x < s.w - 1; x += 0.5) {
      const d = Math.min(...mine.map((b) => distToRect(x, y, b)));
      if (Math.abs(d - gap) > 0.15 || !walkable(s, x, y)) continue;
      const c = near ? Math.hypot(x - near.x, y - near.y) : x;
      if (c < bestD) { bestD = c; best = { x, y }; }
    }
    return best;
  };
  return { s, tc, at };
}

describe('the computer\'s town bell and a parked siege', () => {
  it('stops ringing when foes stand off beyond reach and come no closer', () => {
    const { s, at } = setup();
    const foes: Unit[] = [];
    for (let i = 0; i < 6; i++) { const u = spawnUnit(s, 0, 'ranged', at(11).x, at(11).y + i * 0.1); u.hp = 1e6; foes.push(u); }
    runPinned(s, foes, 10);
    expect(s.ai[1].bell).toBeGreaterThanOrEqual(0);
    runPinned(s, foes, AI_BELL.stale + 40);
    expect(s.ai[1].bell).toBe(-1);
  });

  it('keeps ringing while a foe keeps closing in', () => {
    const { s, at } = setup();
    const foes: Unit[] = [];
    for (let i = 0; i < 6; i++) { const u = spawnUnit(s, 0, 'ranged', at(11.5).x, at(11.5).y + i * 0.1); u.hp = 1e6; foes.push(u); }
    runPinned(s, foes, 10);
    expect(s.ai[1].bell).toBeGreaterThanOrEqual(0);
    // Over 90 seconds, longer than the minute, but each 30 a little nearer and all still out of reach.
    for (let k = 0; k < 3; k++) {
      const to = at(11.5 - (k + 1), foes[0]);
      for (const u of foes) { u.x = to.x; u.y = to.y; }
      runPinned(s, foes, 30);
    }
    expect(s.ai[1].bell).toBeGreaterThanOrEqual(0);
  });
});
