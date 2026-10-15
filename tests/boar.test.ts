import { describe, expect, it } from 'vitest';
import { BOAR, TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { generateMap } from '../src/sim/mapgen';
import { spawnAnimal } from '../src/sim/animals';
import type { Command, GameState, Unit } from '../src/sim/types';
import { R_BERRY, R_MEAT, R_NONE } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** Wild boars: a guard by a berry patch out from each town. */

const game = (seed = 11): GameState =>
  createGame({ seed, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

function meadow(seed = 11): { s: GameState; x: number; y: number } {
  const s = game(seed);
  s.animals = [];
  for (let y = 8; y < s.h - 8; y++) {
    for (let x = 8; x < s.w - 8; x++) {
      if (s.players.some((p) => Math.hypot(x - p.startX, y - p.startY) < 18)) continue;
      let open = true;
      for (let dy = -4; dy <= 4 && open; dy++) for (let dx = -4; dx <= 4 && open; dx++) open = walkable(s, x + dx, y + dy) && s.res[(y + dy) * s.w + x + dx] === R_NONE;
      if (open) return { s, x: x + 0.5, y: y + 0.5 };
    }
  }
  throw new Error('no meadow');
}

const party = (s: GameState, x: number, y: number, n: number): Unit[] => {
  const list: Unit[] = [];
  for (let i = 0; i < n; i++) list.push(spawnUnit(s, 0, 'citizen', x + i * 0.3 - 0.5, y + 2.5));
  return list;
};

describe('boars', () => {
  it('stand by a berry patch a way out from every town', () => {
    for (const players of [2, 3, 4]) {
      for (const seed of [3, 8, 21]) {
        const m = generateMap(seed, 'medium', players);
        const boars = m.wild.filter((b) => b.kind === 'boar');
        expect(boars.length).toBeGreaterThanOrEqual(m.starts.length - 1);
        for (const b of boars) {
          let berries = false;
          for (let dy = -BOAR.near; dy <= BOAR.near; dy++) for (let dx = -BOAR.near; dx <= BOAR.near; dx++) if (m.res[(Math.floor(b.y) + dy) * m.w + Math.floor(b.x) + dx] === R_BERRY) berries = true;
          expect(berries).toBe(true);
          expect(Math.min(...m.starts.map((st) => Math.hypot(b.x - st.x, b.y - st.y)))).toBeGreaterThanOrEqual(BOAR.min);
        }
      }
    }
  });

  it('beats a lone citizen but falls to three, leaving a carcass', () => {
    const lone = meadow();
    spawnAnimal(lone.s, lone.x, lone.y, 'boar');
    const [c] = party(lone.s, lone.x, lone.y, 1);
    run(lone.s, 25, [{ t: 'hunt', p: 0, ids: [c.id], target: lone.s.animals[0].id }]);
    expect(lone.s.byId.has(c.id) && c.hp > 0).toBe(false);

    const m = meadow();
    const boar = spawnAnimal(m.s, m.x, m.y, 'boar');
    const three = party(m.s, m.x, m.y, 3);
    run(m.s, 25, [{ t: 'hunt', p: 0, ids: three.map((u) => u.id), target: boar.id }]);
    expect(m.s.animals.some((a) => a.id === boar.id)).toBe(false);
    expect(three.filter((u) => u.hp > 0).length).toBeGreaterThanOrEqual(2);
    let meat = 0;
    for (let i = 0; i < m.s.res.length; i++) if (m.s.res[i] === R_MEAT) meat += m.s.amount[i];
    expect(meat).toBeGreaterThan(0);
  });

  it('charges whoever walks near, then gives up at its leash', () => {
    const m = meadow();
    const boar = spawnAnimal(m.s, m.x, m.y, 'boar');
    const u = spawnUnit(m.s, 0, 'citizen', m.x + 2, m.y);
    run(m.s, 2);
    expect(boar.state).toBe('fight');
    u.x = u.px = m.x + BOAR.leash + 3;
    u.order = { k: 'idle' };
    run(m.s, 12);
    expect(boar.state).not.toBe('fight');
  });
});
