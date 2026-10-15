import { describe, expect, it } from 'vitest';
import { LANDMARKS, TICK_HZ } from '../src/sim/data';
import { checksum, createGame, scoreOf, step, type GameSetup } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import { landOwnerAt } from '../src/sim/borders';
import { claimWork } from '../src/sim/landmarks';
import { generateMap } from '../src/sim/mapgen';
import { deserialize, serialize } from '../src/sim/save';
import type { GameState, Landmark, LandmarkKind, MapSize, MapType, Unit } from '../src/sim/types';
import { maxHp, spawnUnit } from '../src/sim/world';

const game = (o: Partial<GameSetup> = {}): GameState =>
  createGame({
    seed: o.seed ?? 7,
    size: o.size ?? 'small',
    mapType: o.mapType,
    scenario: o.scenario,
    peaceMinutes: o.peaceMinutes,
    players: o.players ?? [
      { name: 'A', ai: null, civ: 'romans' },
      { name: 'B', ai: null, civ: 'romans' },
    ],
  });

const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

/** A landmark of a kind (the first one made that kind, if this map has none), with `n` of a player's citizens on it. */
function markWith(s: GameState, kind: LandmarkKind, p = 0, n = 1, type: Unit['type'] = 'citizen'): { m: Landmark; people: Unit[] } {
  const m = s.landmarks!.find((x) => x.kind === kind) ?? s.landmarks![0];
  m.kind = kind;
  const people: Unit[] = [];
  for (let k = 0; k < n; k++) people.push(spawnUnit(s, p, type, m.x + 1 + k * 0.3, m.y + 0.5));
  return { m, people };
}

describe('contested landmarks on the map', () => {
  it('stand one more than the towns, between them, apart, on open ground, one of each kind on a two-town map', () => {
    const types: MapType[] = ['continental', 'highlands', 'lakes', 'forest', 'plains', 'sea'];
    const sizes: MapSize[] = ['small', 'medium', 'large'];
    let total = 0;
    for (const type of types) {
      for (const size of sizes) {
        for (const n of [2, 4]) {
          const m = generateMap(13, size, n, type);
          const label = `${type} ${size} ${n}`;
          expect(m.landmarks.length, label).toBeLessThanOrEqual(Math.min(LANDMARKS.max, n + 1));
          total += m.landmarks.length;
          const firstThree = m.landmarks.slice(0, 3).map((x) => x.kind);
          expect(new Set(firstThree).size, label).toBe(firstThree.length);
          for (const lm of m.landmarks) {
            expect(m.block[Math.floor(lm.y) * m.w + Math.floor(lm.x)], label).toBe(0);
            for (const st of m.starts) expect(Math.sqrt((lm.x - st.x) ** 2 + (lm.y - st.y) ** 2), label).toBeGreaterThanOrEqual(LANDMARKS.home);
            for (const q of m.landmarks) if (q !== lm) expect(Math.sqrt((lm.x - q.x) ** 2 + (lm.y - q.y) ** 2), label).toBeGreaterThanOrEqual(LANDMARKS.spacing);
          }
        }
      }
    }
    // Nearly every map finds room for its landmarks.
    expect(total).toBeGreaterThan(types.length * sizes.length * 5 * 0.85);
  });

  it('leave the rest of the map as it was, and stay out of campaign chapters', () => {
    const a = generateMap(21, 'medium', 2, 'continental');
    const b = generateMap(21, 'medium', 2, 'continental');
    expect(a.landmarks).toEqual(b.landmarks);
    expect(generateMap(21, 'medium', 2, 'continental', false).landmarks).toEqual([]);
  });
});

describe('claiming a landmark', () => {
  it('a lone citizen takes one nobody keeps in the claim time, and three take it three times as fast', () => {
    const s = game();
    const { m } = markWith(s, 'crag', 0, 1);
    run(s, LANDMARKS.claim - 1);
    expect(m.owner).toBe(-1);
    expect(m.by).toBe(0);
    run(s, 2);
    expect(m.owner).toBe(0);

    const t = game();
    const { m: m2 } = markWith(t, 'crag', 1, 3);
    run(t, LANDMARKS.claim / 3 + 1);
    expect(m2.owner).toBe(1);
  });

  it('nothing moves while two sides stand on it', () => {
    const s = game();
    const { m } = markWith(s, 'spring', 0, 1);
    spawnUnit(s, 1, 'citizen', m.x - 1, m.y - 0.5);
    run(s, LANDMARKS.claim + 5);
    expect(m.owner).toBe(-1);
    expect(m.claim).toBe(0);
  });

  it('a rival pulls a held one down to nobody first, then claims it for itself', () => {
    const s = game();
    const { m, people } = markWith(s, 'cairn', 0, 1);
    run(s, LANDMARKS.claim + 1);
    expect(m.owner).toBe(0);
    for (const u of people) u.hp = 0;
    spawnUnit(s, 1, 'citizen', m.x - 1, m.y - 0.5);
    const seen: string[] = [];
    for (let i = 0; i < (LANDMARKS.claim * 2 + 2) * TICK_HZ; i++) {
      step(s);
      for (const ev of s.events) if (ev.k === 'landmark' || ev.k === 'landmarkThreat') seen.push(`${ev.k}:${ev.owner}`);
    }
    expect(seen).toEqual(['landmarkThreat:0', 'landmark:-1', 'landmark:1']);
    expect(m.owner).toBe(1);
  });

  it('a peace treaty keeps what is held, though one nobody keeps may still be claimed', () => {
    const s = game({ peaceMinutes: 5 });
    const { m, people } = markWith(s, 'crag', 0, 1);
    run(s, LANDMARKS.claim + 1);
    expect(m.owner).toBe(0);
    for (const u of people) u.hp = 0;
    spawnUnit(s, 1, 'citizen', m.x - 1, m.y - 0.5);
    run(s, LANDMARKS.claim * 2 + 2);
    expect(m.owner).toBe(0);
    expect(m.claim).toBe(claimWork());
  });
});

describe('what a landmark gives its keeper', () => {
  it('the land round it, where nothing is built on the landmark itself, and a share of the score', () => {
    const s = game();
    const { m } = markWith(s, 'crag', 0, 3);
    const before = scoreOf(s, s.players[0]);
    run(s, LANDMARKS.claim);
    expect(m.owner).toBe(0);
    expect(landOwnerAt(s, Math.floor(m.x) + 3, Math.floor(m.y))).toBe(0);
    expect(placeProblem(s, 'house', Math.floor(m.x), Math.floor(m.y), true, 0)).toBe('blocked');
    // A rival may not build in the keeper's land, where the keeper may.
    let spots = 0;
    for (let dy = -4; dy <= 3; dy++) {
      for (let dx = -4; dx <= 3; dx++) {
        const tx = Math.floor(m.x) + dx;
        const ty = Math.floor(m.y) + dy;
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) continue;
        if (placeProblem(s, 'house', tx, ty, true, 0) !== null || landOwnerAt(s, tx + 1, ty + 1) !== 0) continue;
        expect(placeProblem(s, 'house', tx, ty, true, 1)).toBe('foreign');
        spots++;
      }
    }
    expect(spots).toBeGreaterThan(0);
    expect(scoreOf(s, s.players[0]) - before).toBeGreaterThanOrEqual(LANDMARKS.score);
  });

  it('the Lookout Crag shows the land all round it', () => {
    const s = game();
    const { m, people } = markWith(s, 'crag', 0, 3);
    run(s, LANDMARKS.claim);
    for (const u of people) u.hp = 0;
    run(s, 1);
    const far = Math.floor(m.y) * s.w + Math.floor(m.x) + LANDMARKS.crag.sight - 1;
    expect(s.players[0].vis[far]).toBe(1);
    expect(s.players[1].vis[far]).toBe(0);
  });

  it("the Ancestors' Cairn gives room for more people", () => {
    const s = game();
    run(s, 1);
    const cap = s.players[0].cap;
    markWith(s, 'cairn', 0, 3);
    run(s, LANDMARKS.claim);
    expect(s.players[0].cap).toBe(cap + LANDMARKS.cairn.pop);
  });

  it("the Sacred Spring mends its keeper's people, and nobody else's", () => {
    const s = game();
    const { m, people } = markWith(s, 'spring', 0, 3);
    run(s, LANDMARKS.claim);
    expect(m.owner).toBe(0);
    const hurt = people[0];
    hurt.hp = maxHp(s, hurt) / 2;
    const rival = spawnUnit(s, 1, 'citizen', m.x + 30, m.y);
    rival.hp = maxHp(s, rival) / 2;
    run(s, 10);
    expect(hurt.hp).toBeGreaterThan(maxHp(s, hurt) / 2 + maxHp(s, hurt) * LANDMARKS.spring.heal * 3);
    expect(rival.hp).toBe(maxHp(s, rival) / 2);
  });
});

describe('landmarks and the match', () => {
  it('survive a save and play on the same', () => {
    const s = game();
    markWith(s, 'spring', 0, 2);
    run(s, 8);
    const t = deserialize(serialize(s));
    run(s, 20);
    run(t, 20);
    expect(t.landmarks).toEqual(s.landmarks);
    expect(checksum(t)).toBe(checksum(s));
  });

  it('the computer walks out and claims one in the Stone Age', () => {
    let taken = 0;
    for (const seed of [7, 11]) {
      const s = createGame({ seed, size: 'small', players: [{ name: 'N', ai: 'normal' }, { name: 'H', ai: 'hard' }] });
      run(s, 150);
      if (s.landmarks!.some((m) => m.owner >= 0)) taken++;
    }
    expect(taken).toBe(2);
  });
});
