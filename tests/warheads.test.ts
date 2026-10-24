import { describe, expect, it } from 'vitest';
import { SILO, WARHEADS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { blastDamage, inFallout } from '../src/sim/silo';
import { sees } from '../src/sim/vision';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import type { Building, GameState } from '../src/sim/types';

const game = () => {
  const s = createGame({ seed: 5, size: 'small', startEpoch: 5, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  placeBuilding(s, 1, 'towncenter', s.players[1].startX < s.w / 2 ? s.w - 8 : 8, s.players[1].startY < s.h / 2 ? s.h - 8 : 8, true);
  s.players[0].res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
  return s;
};
const tc = (s: GameState, o: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === o && e.type === 'towncenter')!;
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const turn = (s: GameState, age: 'fission' | 'fusion') => restat(s, s.players[0], () => { s.players[0].age = age; });
const fire = (s: GameState, x: number, y: number, wait: number) => {
  const silo = placeBuilding(s, 0, 'silo', s.players[0].startX + 8, s.players[0].startY + 8, true);
  step(s, [{ t: 'launch', p: 0, silo: silo.id, x, y }]);
  run(s, wait);
};

describe('warhead damage curves (#752)', () => {
  it('follow peak / (1 + (d/2)²) and taper to nothing at the blast radius', () => {
    for (const w of ['atomic', 'fission', 'fusion'] as const) {
      const { peak, r } = WARHEADS[w];
      expect(blastDamage(w, 0)).toBe(peak);
      expect(blastDamage(w, 2)).toBeCloseTo(peak / 2, 6);
      expect(blastDamage(w, 4)).toBeCloseTo(peak / 5, 6);
      // Before the last 2 tiles the curve is untouched; inside them it is scaled by (R − d) / 2.
      expect(blastDamage(w, r - 2)).toBeCloseTo(peak / (1 + ((r - 2) / 2) ** 2), 6);
      expect(blastDamage(w, r - 1)).toBeCloseTo((peak / (1 + ((r - 1) / 2) ** 2)) / 2, 6);
      expect(blastDamage(w, r)).toBe(0);
      expect(blastDamage(w, r + 3)).toBe(0);
    }
    expect([WARHEADS.atomic, WARHEADS.fission, WARHEADS.fusion].map((w) => [w.peak, w.r])).toEqual([[12000, 8], [20000, 10], [40000, 12]]);
  });

  it('a direct Atomic hit breaks a Town Center, and the same strike measures from the footprint edge', () => {
    const s = game();
    const far = tc(s, 1);
    const edge = far.x + far.size / 2;
    // Aimed 6 tiles off the edge, along the row: damage is the curve at 6, not at the distance to the centre.
    const hp = far.hp;
    fire(s, edge + 6, far.y, SILO.fuse + 2);
    expect(hp - far.hp).toBeCloseTo(blastDamage('atomic', 6), 0);
    expect(far.hp).toBeGreaterThan(0);
    const s2 = game();
    const t2 = tc(s2, 1);
    fire(s2, t2.x, t2.y, SILO.fuse + 2);
    expect(t2.hp).toBeLessThanOrEqual(0);
  });

  it('hits a unit by its own position, spares the sheltered, and nothing at the radius', () => {
    const s = game();
    const t = tc(s, 1);
    const near = spawnUnit(s, 1, 'infantry', t.x + 3, t.y);
    const rim = spawnUnit(s, 1, 'infantry', t.x + WARHEADS.atomic.r, t.y);
    const inside = spawnUnit(s, 1, 'infantry', t.x + 1, t.y);
    inside.inside = t.id;
    const hn = near.hp, hr = rim.hp, hi = inside.hp;
    fire(s, t.x, t.y, SILO.fuse + 2);
    expect(near.hp).toBeLessThan(hn);
    expect(rim.hp).toBe(hr);
    expect(inside.hp).toBe(hi);
  });

  it('the fallout radius is its own number: a bigger blast leaves the same 5 tiles', () => {
    for (const age of ['atomic', 'fission'] as const) {
      const s = game();
      if (age === 'fission') turn(s, 'fission');
      const t = tc(s, 1);
      fire(s, t.x, t.y, (age === 'fission' ? 25 : SILO.fuse) + 2);
      expect(s.fallout?.filter((f) => f.x === t.x && f.y === t.y)).toHaveLength(1);
      expect(inFallout(s, t.x + SILO.reach - 0.5, t.y)).toBe(true);
      expect(inFallout(s, t.x + SILO.reach + 0.5, t.y)).toBe(false);
      expect(WARHEADS[age].r).toBeGreaterThan(SILO.reach);
    }
  });

  it('Fusion strikes harder and farther, and leaves no fallout', () => {
    const s = game(); turn(s, 'fusion');
    const far = tc(s, 1);
    const u = spawnUnit(s, 1, 'infantry', far.x + 11, far.y);
    const hu = u.hp;
    fire(s, far.x, far.y, 70 + 2);
    expect(u.hp).toBeLessThan(hu);
    expect(s.fallout).toBeUndefined();
  });
});

describe('the blast is seen by everyone (#752)', () => {
  it('lifts the fog for every player over its radius for SILO.lift seconds, then drops it', () => {
    const s = game();
    // A spot neither town sees.
    const x = s.w / 2, y = s.h / 2;
    step(s);
    expect(sees(s, 0, x, y) || sees(s, 1, x, y)).toBe(false);
    fire(s, x, y, SILO.fuse + 1);
    expect(s.blasts).toHaveLength(1);
    step(s); step(s); step(s); step(s);
    expect(sees(s, 0, x, y)).toBe(true);
    expect(sees(s, 1, x, y)).toBe(true);
    expect(sees(s, 1, x + WARHEADS.atomic.r - 1, y)).toBe(true);
    expect(sees(s, 1, x + WARHEADS.atomic.r + 3, y)).toBe(false);
    expect(s.players[1].seen[Math.floor(y) * s.w + Math.floor(x)]).toBe(1);
    const back = deserialize(serialize(s));
    expect(back.blasts).toEqual(s.blasts);
    run(s, SILO.lift + 1);
    expect(s.blasts).toBeUndefined();
    expect(sees(s, 1, x, y)).toBe(false);
  });
});
