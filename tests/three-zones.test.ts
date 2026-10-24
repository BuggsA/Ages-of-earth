import { describe, expect, it } from 'vitest';
import { SILO, TICK_HZ, secs } from '../src/sim/data';
import { createGame, step, type PlayerSetup } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { revealed, ringsFor, warnRadius } from '../src/sim/silo';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import type { Building, GameState, Launch } from '../src/sim/types';

/** The three-zone warning (#762): seeded decoys, blurred rings, one set per rival team, the exact reveal. */

const game = (seed = 5, players: PlayerSetup[] = [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }]) => {
  const s = createGame({ seed, size: 'small', startEpoch: 5, players });
  // Spare rival Town Centers far off: a real strike may break the first, and the match must go on.
  for (let o = 1; o < players.length; o++) placeBuilding(s, o, 'towncenter', s.players[o].startX < s.w / 2 ? s.w - 8 : 8, s.players[o].startY < s.h / 2 ? s.h - 8 : 8, true);
  s.players[0].res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
  return s;
};
const tc = (s: GameState, o: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === o && e.type === 'towncenter')!;
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const siloAt = (s: GameState, dx: number, dy = 8) => placeBuilding(s, 0, 'silo', s.players[0].startX + dx, s.players[0].startY + dy, true);
/** Let the attacker see the whole map, as after long scouting. */
const scoutAll = (s: GameState) => { s.players[0].seen.fill(1); s.players[0].vis.fill(1); };
/** Raise a silo, fill the store and fire at (x, y); returns the launch. */
const launchAt = (s: GameState, x: number, y: number, dx = 8): Launch => {
  const silo = siloAt(s, dx);
  run(s, 1);
  s.players[0].nukes = { n: SILO.cap };
  step(s, [{ t: 'launch', p: 0, silo: silo.id, x, y }]);
  return s.launches![s.launches!.length - 1];
};
const onTile = (v: number) => v - Math.floor(v) === 0.5;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));

describe('the three-zone warning (#762)', () => {
  it('shows a rival three rings, one real and blurred by at most SILO.blur tiles; the attacker sees only its own aim', () => {
    const s = game();
    scoutAll(s);
    const t = tc(s, 1);
    const x = t.x + 0.73, y = t.y - 0.2;
    const l = launchAt(s, x, y);
    expect(l.warn).toHaveLength(1);
    const set = l.warn![0];
    expect(set.team).toBe(s.players[1].team);
    expect(set.rings).toHaveLength(3);
    const real = set.rings[set.real];
    expect(Math.abs(real.x - (Math.floor(x) + 0.5))).toBeLessThanOrEqual(SILO.blur);
    expect(Math.abs(real.y - (Math.floor(y) + 0.5))).toBeLessThanOrEqual(SILO.blur);
    // Every ring sits on a tile's centre, on the map: the click's fractions never single out the real one.
    for (const r of set.rings) {
      expect(onTile(r.x) && onTile(r.y)).toBe(true);
      expect(r.x > 0 && r.y > 0 && r.x < s.w && r.y < s.h).toBe(true);
    }
    expect(ringsFor(s, l, 1)).toEqual(set.rings);
    expect(ringsFor(s, l, 0)).toEqual([{ x, y }]);
    // The launch event names no point a rival's screen should use: it carries the launch, whose rings it reads.
    const ev = s.events.find((e) => e.k === 'silo' && e.what === 'launched');
    expect(ev && ev.k === 'silo' && ev.id).toBe(l.id);
  });

  it('draws decoys apart from the target and each other, near what the attacker scouted, the same on every run', () => {
    const draw = () => {
      const s = game();
      const t = tc(s, 1);
      // A town spread wide enough to draw decoys from (a lone Town Center falls back: next test).
      for (const [dx, dy] of [[-14, -2], [12, -4], [-4, -14], [10, 8], [-12, 8]]) placeBuilding(s, 1, 'barracks', Math.floor(t.x) + dx, Math.floor(t.y) + dy, true);
      scoutAll(s);
      return { s, l: launchAt(s, t.x, t.y) };
    };
    const { s, l } = draw();
    const set = l.warn![0];
    const decoys = set.rings.filter((_, i) => i !== set.real);
    const real = set.rings[set.real];
    // Apart before the blur, so at least `apart` less the blur on both rings once drawn.
    const slack = 2 * SILO.blur * Math.SQRT2;
    for (const d of decoys) expect(dist(d, real)).toBeGreaterThanOrEqual(SILO.apart - slack);
    expect(dist(decoys[0], decoys[1])).toBeGreaterThanOrEqual(SILO.apart - slack);
    // Each decoy is a blurred tile of something of the rival's the attacker had seen.
    const rival = s.ents.filter((e) => e.owner === 1 && e.hp > 0);
    for (const d of decoys) expect(rival.some((e) => Math.abs(Math.floor(e.x) + 0.5 - d.x) <= SILO.blur && Math.abs(Math.floor(e.y) + 0.5 - d.y) <= SILO.blur)).toBe(true);
    expect(draw().l.warn).toEqual(l.warn);
  });

  it('weighs only what was scouted: with nothing seen, decoys fall back near the target, on the map', () => {
    const s = game();
    s.players[0].seen.fill(0);
    s.players[0].vis.fill(0);
    const t = tc(s, 1);
    // Freeze the eyes: a vision pass during the launch tick would see again round the attacker's own town only.
    const l = launchAt(s, t.x, t.y);
    const set = l.warn![0];
    for (const r of set.rings) expect(r.x > 0 && r.y > 0 && r.x < s.w && r.y < s.h).toBe(true);
    for (const [i, r] of set.rings.entries()) if (i !== set.real) expect(dist(r, set.rings[set.real])).toBeLessThanOrEqual(SILO.spread * Math.SQRT2 + 2 * SILO.blur * Math.SQRT2 + 1);
  });

  it('gives each rival team its own set, and allies the same one', () => {
    const s = game(7, [{ name: 'A', ai: null, civ: 'romans', team: 0 }, { name: 'B', ai: null, civ: 'romans', team: 1 }, { name: 'C', ai: null, civ: 'romans', team: 1 }, { name: 'D', ai: null, civ: 'romans', team: 2 }]);
    scoutAll(s);
    const t = tc(s, 1);
    const l = launchAt(s, t.x, t.y);
    expect(l.warn!.map((w) => w.team)).toEqual([1, 2]);
    expect(ringsFor(s, l, 1)).toEqual(ringsFor(s, l, 2));
    expect(ringsFor(s, l, 3)).toEqual(l.warn![1].rings);
    expect(ringsFor(s, l, 3)).not.toEqual(ringsFor(s, l, 1));
  });

  it('applies one blur rule to every ring: across many launches every ring moves 0 to SILO.blur tiles, the real one included', () => {
    const offs = new Set<number>();
    for (let seed = 1; seed <= 6; seed++) {
      const s = game(seed);
      scoutAll(s);
      const t = tc(s, 1);
      const l = launchAt(s, t.x, t.y);
      const real = l.warn![0].rings[l.warn![0].real];
      offs.add(real.x - (Math.floor(t.x) + 0.5));
      offs.add(real.y - (Math.floor(t.y) + 0.5));
    }
    for (const o of offs) expect(Math.abs(o)).toBeLessThanOrEqual(SILO.blur);
    expect([...offs].some((o) => o !== 0)).toBe(true);
  });

  it('reveals at exactly SILO.reveal seconds left, once, keeping the real ring where it was drawn; damage lands on the true point', () => {
    const s = game();
    scoutAll(s);
    const t = tc(s, 1);
    const l = launchAt(s, t.x, t.y);
    const set = l.warn![0];
    const reveals: number[] = [];
    // A warhead strikes in the tick that runs with its clock at `at`; the reveal comes in the tick that runs with SILO.reveal seconds left.
    while (s.tick < l.at - secs(SILO.reveal)) step(s);
    expect(revealed(s, l)).toBe(false);
    expect(ringsFor(s, l, 1)).toHaveLength(3);
    step(s);
    expect(l.at - (s.tick - 1)).toBe(secs(SILO.reveal));
    expect(revealed(s, l)).toBe(true);
    expect(s.events.filter((e) => e.k === 'silo' && e.what === 'revealed')).toHaveLength(1);
    // The reveal does not snap to the true point: the real ring stays where it was drawn.
    expect(ringsFor(s, l, 1)).toEqual([set.rings[set.real]]);
    // The attacker's view is its aim throughout.
    expect(ringsFor(s, l, 0)).toEqual([{ x: t.x, y: t.y }]);
    let struck: { x: number; y: number } | null = null;
    while (s.launches?.some((k) => k.id === l.id)) {
      step(s);
      for (const e of s.events) {
        if (e.k === 'silo' && e.what === 'revealed') reveals.push(e.id!);
        if (e.k === 'silo' && e.what === 'struck') struck = { x: e.x, y: e.y };
      }
    }
    expect(reveals).toEqual([]);
    expect(struck).toEqual({ x: t.x, y: t.y });
    expect(s.blasts!.at(-1)).toMatchObject({ x: t.x, y: t.y });
  });

  it('keeps the rings frozen across save and load, and plays on the same', () => {
    const s = game();
    scoutAll(s);
    const t = tc(s, 1);
    const l = launchAt(s, t.x, t.y);
    run(s, 2);
    const copy = deserialize(serialize(s));
    expect(copy.launches![0].warn).toEqual(l.warn);
    run(s, 4);
    run(copy, 4);
    expect(copy.launches![0].warn).toEqual(s.launches![0].warn);
    expect(copy.rng).toBe(s.rng);
  });

  it('tracks simultaneous launches apart: each its own rings and its own reveal', () => {
    const s = game();
    scoutAll(s);
    const t = tc(s, 1);
    const a = launchAt(s, t.x, t.y, 8);
    run(s, 2);
    const b = launchAt(s, t.x + 10, t.y + 4, 12);
    expect(a.id).not.toBe(b.id);
    expect(a.warn).not.toEqual(b.warn);
    const seen: number[] = [];
    while (s.launches?.length) {
      step(s);
      for (const e of s.events) if (e.k === 'silo' && e.what === 'revealed') seen.push(e.id!);
      if (s.launches?.some((l) => l.id === a.id)) expect(ringsFor(s, a, 1)).toHaveLength(revealed(s, a) ? 1 : 3);
    }
    expect(seen).toEqual([a.id, b.id]);
  });

  it('a computer defender runs from the rings it is shown, decoys included', () => {
    const s = game(5, [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'hard', civ: 'romans' }]);
    scoutAll(s);
    const t = tc(s, 1);
    const l = launchAt(s, t.x, t.y);
    const set = l.warn![0];
    const decoy = set.rings[(set.real + 1) % 3];
    const men = [0, 1, 2].map((k) => spawnUnit(s, 1, 'infantry', decoy.x + k * 0.4, decoy.y));
    for (let i = 0; i < TICK_HZ; i++) step(s);
    const r = warnRadius(s, 0);
    // Ordered out past the ring's edge, away from its centre (not merely carrying on with what they did).
    for (const m of men) {
      const o = m.order as { k: string; x?: number; y?: number };
      expect(o.k).toBe('move');
      expect(dist({ x: o.x!, y: o.y! }, decoy)).toBeGreaterThan(r);
    }
  });
});
