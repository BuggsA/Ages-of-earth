import { describe, expect, it } from 'vitest';
import { findSpot } from '../../src/sim/ai';
import { RELIC, TICK_HZ } from '../../src/sim/data';
import { checksum, createGame, step, type GameSetup } from '../../src/sim/game';
import { placeProblem, walkable } from '../../src/sim/grid';
import { generateMap } from '../../src/sim/mapgen';
import { keptIn } from '../../src/sim/relics';
import { deserialize, serialize } from '../../src/sim/save';
import type { Building, Command, GameState, MapSize, MapType, Relic, Unit } from '../../src/sim/types';
import { placeBuilding, spawnUnit } from '../../src/sim/world';

const game = (o: Partial<GameSetup> = {}): GameState =>
  createGame({
    seed: o.seed ?? 7,
    size: o.size ?? 'small',
    mapType: o.mapType,
    startEpoch: o.startEpoch ?? 1,
    wonderSeconds: o.wonderSeconds,
    players: o.players ?? [
      { name: 'A', ai: null, civ: 'romans' },
      { name: 'B', ai: null, civ: 'romans' },
    ],
  });

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};
const tcOf = (s: GameState, p: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === p && e.type === 'towncenter')!;
function temple(s: GameState, p: number): Building {
  const tc = tcOf(s, p);
  const at = findSpot(s, 'temple', tc.x, tc.y, 5, 20)!;
  return placeBuilding(s, p, 'temple', at.tx, at.ty, true);
}
/** The relic nearest a player's town, with a priest standing a few steps from it. */
function relicAndPriest(s: GameState, p = 0): { r: Relic; priest: Unit } {
  const pl = s.players[p];
  const r = [...s.relics].sort((a, b) => (a.x - pl.startX) ** 2 + (a.y - pl.startY) ** 2 - ((b.x - pl.startX) ** 2 + (b.y - pl.startY) ** 2))[0];
  const priest = spawnUnit(s, p, 'priest', r.x + 2, r.y);
  return { r, priest };
}

describe('relics on the map', () => {
  it('every town has one at the same distance, more lie between the towns, all on open ground anyone can walk to', () => {
    const types: MapType[] = ['continental', 'highlands', 'lakes', 'forest', 'plains', 'sea'];
    const sizes: MapSize[] = ['small', 'medium', 'large'];
    for (const type of types) {
      for (const size of sizes) {
        for (const n of [2, 3, 4]) {
          const m = generateMap(11, size, n, type);
          const label = `${type} ${size} ${n}`;
          expect(m.relics.length, label).toBeGreaterThanOrEqual(n);
          expect(m.relics.length, label).toBeLessThanOrEqual(n + RELIC.extra[size]);
          for (const st of m.starts) {
            const own = m.relics.filter((r) => m.starts.every((o) => o === st || (r.x - st.x) ** 2 + (r.y - st.y) ** 2 < (r.x - o.x) ** 2 + (r.y - o.y) ** 2));
            const d = Math.min(...own.map((r) => Math.sqrt((r.x - st.x) ** 2 + (r.y - st.y) ** 2)));
            expect(Math.abs(d - RELIC.home), label).toBeLessThanOrEqual(3);
          }
          for (const r of m.relics) {
            const i = Math.floor(r.y) * m.w + Math.floor(r.x);
            expect(m.block[i], label).toBe(0);
            for (const o of m.relics) if (o !== r) expect((o.x - r.x) ** 2 + (o.y - r.y) ** 2).toBeGreaterThanOrEqual(RELIC.spacing ** 2);
          }
        }
      }
    }
  });

  it('nothing can be built over a relic lying on the ground', () => {
    const s = game();
    const r = s.relics[0];
    expect(placeProblem(s, 'house', Math.floor(r.x) - 1, Math.floor(r.y) - 1)).toBe('blocked');
  });
});

describe('carrying relics', () => {
  it('a priest picks one up, carries it to a Temple, and it brings in gold', () => {
    const s = game();
    const t = temple(s, 0);
    const { r, priest } = relicAndPriest(s);
    run(s, 4, [{ t: 'relic', p: 0, ids: [priest.id], target: r.id }]);
    expect(r.carrier).toBe(priest.id);
    run(s, 90);
    expect(r.temple).toBe(t.id);
    expect(r.carrier).toBe(0);
    expect(keptIn(s, t)).toBe(1);
    expect(priest.order.k).toBe('idle');
    const gold = s.players[0].res.gold;
    run(s, 20);
    expect(s.players[0].res.gold - gold).toBe((20 / RELIC.every) * RELIC.gold);
  });

  it('only priests carry them; a priest carrying one cannot convert, and can set it down', () => {
    const s = game();
    const { r, priest } = relicAndPriest(s);
    const soldier = spawnUnit(s, 0, 'infantry', r.x - 2, r.y);
    run(s, 6, [{ t: 'relic', p: 0, ids: [soldier.id], target: r.id }]);
    expect(r.carrier).toBe(0);
    run(s, 0.1, [{ t: 'delete', p: 0, ids: [soldier.id] }]);
    run(s, 4, [{ t: 'relic', p: 0, ids: [priest.id], target: r.id }]);
    expect(r.carrier).toBe(priest.id);
    // No Temple yet: the priest holds on to it.
    run(s, 2);
    expect(priest.order.k).toBe('idle');
    expect(r.carrier).toBe(priest.id);
    const foe = spawnUnit(s, 1, 'infantry', priest.x + 3, priest.y);
    foe.stance = 'stand';
    run(s, 15, [{ t: 'convert', p: 0, ids: [priest.id], target: foe.id }]);
    expect(foe.owner).toBe(1);
    run(s, 1, [{ t: 'dropRelic', p: 0, ids: [priest.id] }]);
    expect(r.carrier).toBe(0);
    expect(walkable(s, Math.floor(r.x), Math.floor(r.y))).toBe(true);
    run(s, 15, [{ t: 'convert', p: 0, ids: [priest.id], target: foe.id }]);
    expect(foe.owner).toBe(0);
  });

  it('a fallen carrier lets it go, and an enemy priest can take it home', () => {
    const s = game();
    const enemyTemple = temple(s, 1);
    const { r, priest } = relicAndPriest(s);
    run(s, 4, [{ t: 'relic', p: 0, ids: [priest.id], target: r.id }]);
    expect(r.carrier).toBe(priest.id);
    priest.hp = 0;
    run(s, 0.1);
    expect(r.carrier).toBe(0);
    expect(s.byId.has(priest.id)).toBe(false);
    expect(walkable(s, Math.floor(r.x), Math.floor(r.y))).toBe(true);
    const thief = spawnUnit(s, 1, 'priest', r.x + 1, r.y + 1);
    run(s, 4, [{ t: 'relic', p: 1, ids: [thief.id], target: r.id }]);
    expect(r.carrier).toBe(thief.id);
    run(s, 150);
    expect(r.temple).toBe(enemyTemple.id);
  });

  it('a fallen Temple spills its relics round the rubble', () => {
    const s = game();
    const t = temple(s, 0);
    for (const r of s.relics.slice(0, 2)) {
      r.temple = t.id;
      r.x = t.x;
      r.y = t.y;
    }
    t.hp = 0;
    run(s, 0.1);
    for (const r of s.relics.slice(0, 2)) {
      expect(r.temple).toBe(0);
      expect(walkable(s, Math.floor(r.x), Math.floor(r.y))).toBe(true);
      expect(Math.abs(r.x - t.x) + Math.abs(r.y - t.y)).toBeLessThan(8);
    }
    expect(Math.floor(s.relics[0].x) !== Math.floor(s.relics[1].x) || Math.floor(s.relics[0].y) !== Math.floor(s.relics[1].y)).toBe(true);
  });

  it('a side that keeps every relic wins once the countdown runs out, unless one is taken back first', () => {
    const s = game({ wonderSeconds: 30 });
    const t = temple(s, 0);
    const keepAll = () => {
      for (const r of s.relics) {
        r.carrier = 0;
        r.temple = t.id;
        r.x = t.x;
        r.y = t.y;
      }
    };
    keepAll();
    run(s, 1);
    expect(s.relicTeam).toBe(0);
    expect(s.relicTimer).toBeGreaterThan(0);
    run(s, 10);
    // One taken back: the countdown stops, and starts afresh when all are kept again.
    s.relics[0].temple = 0;
    run(s, 1);
    expect(s.relicTeam).toBe(-1);
    expect(s.relicTimer).toBe(-1);
    keepAll();
    run(s, 25);
    expect(s.over).toBe(false);
    run(s, 10);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
    expect(s.players[1].defeated).toBe(true);
  });

  it('a match with a relic being carried saves and plays on exactly the same', () => {
    const s = game();
    temple(s, 0);
    const { r, priest } = relicAndPriest(s);
    run(s, 3, [{ t: 'relic', p: 0, ids: [priest.id], target: r.id }]);
    const copy = deserialize(serialize(s));
    run(s, 40);
    run(copy, 40);
    expect(checksum(copy)).toBe(checksum(s));
    expect(copy.relics).toEqual(s.relics);
  });
});
