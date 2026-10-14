import { describe, expect, it } from 'vitest';
import { RUINS, TECHS, TICK_HZ } from '../src/sim/data';
import { checksum, createGame, step, type GameSetup } from '../src/sim/game';
import { placeProblem, walkable } from '../src/sim/grid';
import { generateMap } from '../src/sim/mapgen';
import { digWork, loreFor } from '../src/sim/ruins';
import { deserialize, serialize } from '../src/sim/save';
import type { Command, GameState, MapSize, MapType, Ruin, RuinFind, Unit } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

const game = (o: Partial<GameSetup> = {}): GameState =>
  createGame({
    seed: o.seed ?? 7,
    size: o.size ?? 'small',
    mapType: o.mapType,
    startEpoch: o.startEpoch ?? 1,
    scenario: o.scenario,
    players: o.players ?? [
      { name: 'A', ai: null, civ: 'romans' },
      { name: 'B', ai: null, civ: 'romans' },
    ],
  });

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

/** A ruin holding a given find (dealt anew if this map has none), with citizens beside it. */
function ruinWith(s: GameState, find: RuinFind, p = 0, n = 1): { r: Ruin; diggers: Unit[] } {
  const r = s.ruins!.find((x) => x.find === find) ?? s.ruins![0];
  r.find = find;
  const diggers: Unit[] = [];
  for (let k = 0; k < n; k++) diggers.push(spawnUnit(s, p, 'citizen', r.x + 1 + k * 0.4, r.y + 0.5));
  return { r, diggers };
}

const dig = (p: number, ids: Unit[], r: Ruin): Command => ({ t: 'dig', p, ids: ids.map((u) => u.id), target: r.id });

describe('ancient ruins on the map', () => {
  it('stand between the towns, far from each, on open ground every town can walk to, holding different finds', () => {
    const types: MapType[] = ['continental', 'highlands', 'lakes', 'forest', 'plains', 'sea'];
    const sizes: MapSize[] = ['small', 'medium', 'large'];
    let total = 0;
    for (const type of types) {
      for (const size of sizes) {
        for (const n of [2, 4]) {
          const m = generateMap(13, size, n, type);
          const label = `${type} ${size} ${n}`;
          expect(m.ruins.length, label).toBeLessThanOrEqual(RUINS.count[size]);
          total += m.ruins.length;
          // Never two of a find among the first four.
          const firstFour = m.ruins.slice(0, 4).map((r) => r.find);
          expect(new Set(firstFour).size, label).toBe(firstFour.length);
          for (const r of m.ruins) {
            const i = Math.floor(r.y) * m.w + Math.floor(r.x);
            expect(m.block[i], label).toBe(0);
            for (const st of m.starts) expect(Math.sqrt((r.x - st.x) ** 2 + (r.y - st.y) ** 2), label).toBeGreaterThanOrEqual(RUINS.home);
            for (const q of m.ruins) if (q !== r) expect(Math.sqrt((r.x - q.x) ** 2 + (r.y - q.y) ** 2), label).toBeGreaterThanOrEqual(RUINS.spacing);
          }
        }
      }
    }
    // Most maps find room for all of them.
    expect(total).toBeGreaterThan(36 * 2);
  });

  it('leave the rest of the map as it was', () => {
    const a = generateMap(21, 'medium', 3, 'continental');
    const b = generateMap(21, 'medium', 3, 'continental', false);
    expect(a.ruins.length).toBeGreaterThan(0);
    expect(b.ruins.length).toBe(0);
    expect(a.relics).toEqual(b.relics);
    expect(a.posts).toEqual(b.posts);
    expect(a.deer).toEqual(b.deer);
  });

  it('are left out of campaign chapters', () => {
    const s = game({ scenario: 'first-fires' });
    expect(s.ruins).toBeUndefined();
  });

  it('cannot be built over', () => {
    const s = game();
    const r = s.ruins![0];
    expect(walkable(s, Math.floor(r.x), Math.floor(r.y))).toBe(true);
    expect(placeProblem(s, 'house', Math.floor(r.x) - 1, Math.floor(r.y) - 1)).toBe('blocked');
  });
});

describe('digging', () => {
  it('one citizen digs a ruin out in its time; two in about half', () => {
    const s = game();
    const { r, diggers } = ruinWith(s, 'hoard', 0, 1);
    run(s, RUINS.dig - 2, [dig(0, diggers, r)]);
    expect(r.by).toBe(-1);
    expect(r.dug).toBeGreaterThan(0);
    run(s, 6);
    expect(r.by).toBe(0);

    const t = game();
    const two = ruinWith(t, 'hoard', 0, 2);
    run(t, RUINS.dig / 2 + 3, [dig(0, two.diggers, two.r)]);
    expect(two.r.by).toBe(0);
  });

  it('a hoard pays gold', () => {
    const s = game();
    const { r, diggers } = ruinWith(s, 'hoard', 0, 3);
    const before = s.players[0].res.gold;
    run(s, RUINS.dig / 3 + 4, [dig(0, diggers, r)]);
    expect(s.players[0].res.gold - before).toBe(RUINS.gold);
    // And the citizens stand down.
    for (const u of diggers) expect(u.order.k).toBe('idle');
  });

  it('lost knowledge hands over the cheapest technology of the age, free', () => {
    const s = game();
    const { r, diggers } = ruinWith(s, 'lore', 0, 3);
    const tech = loreFor(s, s.players[0])!;
    expect(tech).toBeTruthy();
    expect(TECHS[tech].epoch).toBeLessThanOrEqual(s.players[0].epoch);
    const res = { ...s.players[0].res };
    run(s, RUINS.dig / 3 + 4, [dig(0, diggers, r)]);
    expect(s.players[0].techs).toContain(tech);
    expect(s.players[0].res).toEqual(res);
    expect(s.players[1].techs).not.toContain(tech);
  });

  it('an old map lays the whole land open to the finder (and allies), not to rivals', () => {
    const s = game();
    const { r, diggers } = ruinWith(s, 'map', 0, 3);
    expect(s.players[0].seen.every((v) => v === 1)).toBe(false);
    run(s, RUINS.dig / 3 + 4, [dig(0, diggers, r)]);
    expect(s.players[0].seen.every((v) => v === 1)).toBe(true);
    expect(s.players[1].seen.every((v) => v === 1)).toBe(false);
  });

  it('a relic comes up out of the earth beside the ruin', () => {
    const s = game();
    const { r, diggers } = ruinWith(s, 'relic', 0, 3);
    const n = s.relics.length;
    run(s, RUINS.dig / 3 + 4, [dig(0, diggers, r)]);
    expect(s.relics.length).toBe(n + 1);
    const relic = s.relics[s.relics.length - 1];
    expect(Math.sqrt((relic.x - r.x) ** 2 + (relic.y - r.y) ** 2)).toBeLessThan(4);
    expect(relic.carrier).toBe(0);
    expect(relic.temple).toBe(0);
  });

  it('is shared work: whoever strikes the last spade takes the find, and a dug ruin gives nothing more', () => {
    const s = game();
    const { r, diggers } = ruinWith(s, 'hoard', 0, 1);
    const rival = spawnUnit(s, 1, 'citizen', r.x - 1, r.y - 0.5);
    run(s, RUINS.dig - 10, [dig(0, diggers, r)]);
    // The rival's citizen joins late and the two finish it together, one stroke each per tick.
    const gold = [s.players[0].res.gold, s.players[1].res.gold];
    run(s, 10, [dig(1, [rival], r)]);
    expect(r.by).toBeGreaterThanOrEqual(0);
    expect(r.dug).toBe(digWork());
    expect(s.players[0].res.gold - gold[0] + s.players[1].res.gold - gold[1]).toBe(RUINS.gold);
    // Ordered to dig again: refused, nothing changes.
    const after = [s.players[0].res.gold, s.players[1].res.gold];
    run(s, 5, [dig(0, diggers, r)]);
    expect([s.players[0].res.gold, s.players[1].res.gold]).toEqual(after);
    expect(diggers[0].order.k).toBe('idle');
  });

  it('only citizens dig; soldiers sent along walk over', () => {
    const s = game();
    const { r } = ruinWith(s, 'hoard', 0, 0);
    const soldier = spawnUnit(s, 0, 'infantry', r.x + 3, r.y);
    run(s, RUINS.dig + 5, [{ t: 'dig', p: 0, ids: [soldier.id], target: r.id }]);
    expect(r.dug).toBe(0);
    expect(Math.sqrt((soldier.x - r.x) ** 2 + (soldier.y - r.y) ** 2)).toBeLessThan(3);
  });

  it('a half-dug ruin saves and loads, and the match plays on the same', () => {
    const s = game();
    const { r, diggers } = ruinWith(s, 'relic', 0, 1);
    run(s, 10, [dig(0, diggers, r)]);
    const t = deserialize(serialize(s));
    expect(t.ruins).toEqual(s.ruins);
    run(s, RUINS.dig);
    run(t, RUINS.dig);
    expect(checksum(t)).toBe(checksum(s));
    expect(t.ruins![s.ruins!.indexOf(r)].by).toBe(0);
  });
});

describe('the computer', () => {
  it('sends citizens to dig the ruins once its town has grown', () => {
    const s = game({
      startEpoch: 0,
      players: [
        { name: 'A', ai: 'normal', civ: 'greeks' },
        { name: 'B', ai: 'hard', civ: 'britons' },
      ],
    });
    run(s, 12 * 60);
    expect(s.ruins!.some((r) => r.by >= 0)).toBe(true);
  });
});
