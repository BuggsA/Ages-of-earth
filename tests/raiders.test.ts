import { describe, expect, it } from 'vitest';
import { AI_WILD, RAIDER, TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { generateMap } from '../src/sim/mapgen';
import { spawnAnimal } from '../src/sim/animals';
import type { Command, GameState, Unit } from '../src/sim/types';
import { R_NONE } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** Raider camps: a guarded band out between the towns, plundered by whoever fells the last. */

const game = (seed = 11): GameState =>
  createGame({ seed, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

function meadow(): { s: GameState; x: number; y: number } {
  const s = game();
  s.animals = [];
  for (let y = 8; y < s.h - 8; y++) {
    for (let x = 8; x < s.w - 8; x++) {
      if (s.players.some((p) => Math.hypot(x - p.startX, y - p.startY) < 18)) continue;
      let open = true;
      for (let dy = -5; dy <= 5 && open; dy++) for (let dx = -5; dx <= 5 && open; dx++) open = walkable(s, x + dx, y + dy) && s.res[(y + dy) * s.w + x + dx] === R_NONE;
      if (open) return { s, x: x + 0.5, y: y + 0.5 };
    }
  }
  throw new Error('no meadow');
}

/** A camp's band, tied to its fire as the map sets them up. */
function band(s: GameState, x: number, y: number) {
  const out = [];
  for (let k = 0; k < RAIDER.guards; k++) {
    const a = spawnAnimal(s, x + (k - 1) * 0.6, y + (k === 1 ? 0.5 : 0), 'raider');
    a.homeX = x;
    a.homeY = y;
    out.push(a);
  }
  return out;
}

const squad = (s: GameState, type: 'citizen' | 'infantry', x: number, y: number, n: number): Unit[] => {
  const list: Unit[] = [];
  for (let i = 0; i < n; i++) list.push(spawnUnit(s, 0, type, x + i * 0.3 - 0.5, y + 3));
  return list;
};

describe('raider camps', () => {
  it('stand out between the towns, away from every one', () => {
    for (const players of [2, 3]) {
      for (const seed of [2, 3, 8]) {
        const m = generateMap(seed, 'medium', players);
        expect(m.camps.length).toBeGreaterThanOrEqual(1);
        expect(m.camps.length).toBeLessThanOrEqual(RAIDER.camps.medium);
        for (const c of m.camps) expect(Math.min(...m.starts.map((st) => Math.hypot(c.x - st.x, c.y - st.y)))).toBeGreaterThanOrEqual(RAIDER.home);
      }
    }
  });

  it('are absent from campaign maps, and a match starts with a full band at each', () => {
    expect(generateMap(5, 'small', 2, 'continental', false).camps).toEqual([]);
    const s = game(1);
    const raiders = s.animals.filter((a) => a.kind === 'raider');
    expect(raiders.length % RAIDER.guards).toBe(0);
    expect(raiders.length).toBeGreaterThan(0);
  });

  it('beat a lone citizen, call the whole band, and fall to a squad of soldiers', () => {
    const lone = meadow();
    const alone = band(lone.s, lone.x, lone.y);
    const [c] = squad(lone.s, 'citizen', lone.x, lone.y, 1);
    run(lone.s, 25, [{ t: 'hunt', p: 0, ids: [c.id], target: alone[0].id }]);
    expect(c.hp <= 0 || !lone.s.byId.has(c.id)).toBe(true);

    const m = meadow();
    const guards = band(m.s, m.x, m.y);
    const soldiers = squad(m.s, 'infantry', m.x, m.y, 5);
    const before = { ...m.s.players[0].res };
    run(m.s, 40, [{ t: 'hunt', p: 0, ids: soldiers.map((u) => u.id), target: guards[0].id }]);
    expect(m.s.animals.some((a) => a.kind === 'raider')).toBe(false);
    expect(soldiers.some((u) => u.hp > 0)).toBe(true);
    const res = m.s.players[0].res;
    expect(res.gold - before.gold).toBe(RAIDER.loot.gold);
    expect(res.food - before.food).toBe(RAIDER.loot.food);
    expect(res.wood - before.wood).toBe(RAIDER.loot.wood);
  });

  it('pay nothing until the last raider falls, and leave no carcass', () => {
    const m = meadow();
    const guards = band(m.s, m.x, m.y);
    const gold = m.s.players[0].res.gold;
    guards[0].hp = 0.1;
    const [u] = squad(m.s, 'infantry', m.x, m.y, 1);
    u.x = m.x;
    u.y = m.y + 1;
    run(m.s, 2, [{ t: 'hunt', p: 0, ids: [u.id], target: guards[0].id }]);
    expect(m.s.animals.filter((a) => a.kind === 'raider').length).toBeLessThan(RAIDER.guards);
    expect(m.s.players[0].res.gold).toBe(gold);
    expect(m.s.carcasses ?? []).toHaveLength(0);
  });

  it('are marched on by a computer with soldiers to spare, within reach of home', () => {
    const s = createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'normal', civ: 'romans' }] });
    s.animals = [];
    const me = s.players[1];
    const guards = band(s, me.startX + 12, me.startY + 12);
    const soldiers: Unit[] = [];
    for (let i = 0; i < AI_WILD.raid; i++) soldiers.push(spawnUnit(s, 1, 'infantry', me.startX + 2 + i * 0.4, me.startY + 2));
    s.peaceUntil = 0;
    let sent = false;
    for (let i = 0; i < 40 * TICK_HZ && !sent; i++) {
      step(s);
      sent = soldiers.some((u) => u.order.k === 'hunt' && guards.some((g) => g.id === (u.order as { target: number }).target));
    }
    expect(sent).toBe(true);
  });
});
