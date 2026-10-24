import { describe, expect, it } from 'vitest';
import { AI_SILO, FLIGHT, SILO, TICK_HZ, secs } from '../src/sim/data';
import { checksum, createGame, step, type PlayerSetup } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { flightOf, missilesAt, revealed, warningsOf } from '../src/sim/silo';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import type { Building, Command, GameState, Launch } from '../src/sim/types';

/** The flight (#772, s1 of #759): a missile every player watches, climbing toward a district, then bending onto its true point. */

const game = (seed = 5, players: PlayerSetup[] = [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }]) => {
  const s = createGame({ seed, size: 'small', startEpoch: 5, players });
  // Spare rival Town Centers far off: a real strike may break the first, and the match must go on.
  for (let o = 1; o < players.length; o++) placeBuilding(s, o, 'towncenter', s.players[o].startX < s.w / 2 ? s.w - 8 : 8, s.players[o].startY < s.h / 2 ? s.h - 8 : 8, true);
  for (const p of s.players) p.res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
  return s;
};
const tc = (s: GameState, o: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === o && e.type === 'towncenter')!;
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const scoutAll = (s: GameState) => { s.players[0].seen.fill(1); s.players[0].vis.fill(1); };
/** A rival town spread wide enough to draw decoys from. */
const town = (s: GameState) => {
  const t = tc(s, 1);
  for (const [dx, dy] of [[-14, -2], [12, -4], [-4, -14], [10, 8], [-12, 8]]) placeBuilding(s, 1, 'barracks', Math.floor(t.x) + dx, Math.floor(t.y) + dy, true);
  return t;
};
/** Raise a silo, fill the store and fire at (x, y); returns the launch, or null if it was refused. */
const launchAt = (s: GameState, x: number, y: number): Launch | null => {
  const silo = placeBuilding(s, 0, 'silo', s.players[0].startX + 8, s.players[0].startY + 8, true);
  run(s, 1);
  s.players[0].nukes = { n: SILO.cap };
  step(s, [{ t: 'launch', p: 0, silo: silo.id, x, y }]);
  return s.launches?.[s.launches.length - 1] ?? null;
};
const d2 = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
/** Read a course as a player would: where the missile is now and was a half and a whole second ago, carried on to the end of the clock. */
const guess = (l: Launch, t: number) => {
  const dt = TICK_HZ / 2;
  const [[a], [b], [c]] = [t - 2 * dt, t - dt, t].map((k) => missilesAt(l, k));
  const left = l.at - t;
  const vx = (c.x - b.x) / dt, vy = (c.y - b.y) / dt, ax = (c.x - 2 * b.x + a.x) / (dt * dt), ay = (c.y - 2 * b.y + a.y) / (dt * dt);
  return { x: c.x + vx * left + 0.5 * ax * left * left, y: c.y + vy * left + 0.5 * ay * left * left };
};
/** The ring the missile's nose points at (the least angle off its heading), as an index into `rings`. */
const pointedAt = (l: Launch, t: number, rings: { x: number; y: number }[]) => {
  const [a] = missilesAt(l, t - TICK_HZ / 2), [b] = missilesAt(l, t);
  const hx = b.x - a.x, hy = b.y - a.y;
  const cos = rings.map((r) => ((r.x - b.x) * hx + (r.y - b.y) * hy) / Math.sqrt(d2(r, b) * (hx * hx + hy * hy)));
  return cos.indexOf(Math.max(...cos));
};
/** Launches at the rival town across many maps, each with its three rings (the target varies over three of the town's buildings). */
const many = (n: number) => {
  const out: { l: Launch; rings: { x: number; y: number }[]; real: number }[] = [];
  for (let seed = 1; out.length < n; seed++) {
    const s = game(seed);
    const t = town(s);
    scoutAll(s);
    const aim = [{ x: t.x, y: t.y }, { x: t.x + 12, y: t.y - 4 }, { x: t.x - 4, y: t.y - 14 }][seed % 3];
    const l = launchAt(s, aim.x, aim.y);
    if (l) out.push({ l, rings: l.warn![0].rings, real: l.warn![0].real });
  }
  return out;
};

describe('the flight (#772)', () => {
  it('climbs from the silo and ends exactly on the true point when the clock runs out; every player sees the same course', () => {
    const s = game();
    const t = town(s);
    scoutAll(s);
    const l = launchAt(s, t.x + 0.3, t.y - 0.6)!;
    const f = flightOf(l)!;
    const silo = s.byId.get(l.silo)!;
    expect(l.arc).toMatchObject({ x: silo.x, y: silo.y, t0: s.tick - 1 });
    const [start] = missilesAt(l, f.t0);
    expect([start.x, start.y, start.z]).toEqual([silo.x, silo.y, 0]);
    const [end] = missilesAt(l, l.at);
    expect([end.x, end.y, end.z]).toEqual([l.x, l.y, 0]);
    // High through the flight, highest at the bend, and diving through the reveal.
    for (let k = f.t0 + 1; k < l.at; k += 7) expect(missilesAt(l, k)[0].z).toBeGreaterThan(0);
    expect(missilesAt(l, f.tk)[0].z).toBeCloseTo(f.h, 9);
    expect(f.h).toBeGreaterThanOrEqual(FLIGHT.low);
    expect(missilesAt(l, l.at - secs(SILO.reveal))[0].z).toBeLessThan(f.h);
    // Gone once it lands.
    expect(missilesAt(l, l.at + 1)).toEqual([]);
    run(s, SILO.fuse);
    expect(s.launches).toBeUndefined();
    expect(s.events.some((e) => e.k === 'silo' && e.what === 'struck')).toBe(true);
  });

  it('climbs toward the district whatever the true point is, and bends onto it only in the last seconds before the reveal', () => {
    const s = game();
    const t = town(s);
    scoutAll(s);
    const l = launchAt(s, t.x, t.y)!;
    const f = flightOf(l)!;
    // The same course aimed elsewhere: the climb is the same tick for tick; the bend is not.
    const other: Launch = { ...l, x: l.x + 9, y: l.y - 5 };
    for (let k = f.t0; k < f.tk; k += 5) expect(missilesAt(other, k)).toEqual(missilesAt(l, k));
    expect(missilesAt(other, f.tk + secs(2))).not.toEqual(missilesAt(l, f.tk + secs(2)));
    // The bend starts `FLIGHT.read` seconds (scaled by the lure's distance) before the reveal.
    const far = Math.sqrt(d2({ x: l.arc!.lx, y: l.arc!.ly }, l.arc!));
    const read = FLIGHT.read * Math.max(FLIGHT.lo, Math.min(FLIGHT.hi, far / FLIGHT.ref));
    expect(f.tk).toBeCloseTo(l.at - (SILO.reveal + read) * TICK_HZ, 9);
    // No jump in heading or pace at the bend.
    const [a] = missilesAt(l, f.tk - 1), [b] = missilesAt(l, f.tk), [c] = missilesAt(l, f.tk + 1);
    const v1 = { x: b.x - a.x, y: b.y - a.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
    const l1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y), l2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    expect((v1.x * v2.x + v1.y * v2.y) / (l1 * l2)).toBeGreaterThan(0.999);
    expect(Math.abs(l2 / l1 - 1)).toBeLessThan(0.1);
  });

  it('leaks the real zone only late: the early heading points at it barely more than chance, the late course nearly always', () => {
    const runs = many(45);
    let early = 0, atBend = 0, late = 0;
    for (const { l, rings, real } of runs) {
      const f = flightOf(l)!;
      if (pointedAt(l, (f.t0 + f.tk) / 2, rings) === real) early++;
      const near = (p: { x: number; y: number }) => rings.map((r) => d2(r, p)).indexOf(Math.min(...rings.map((r) => d2(r, p))));
      if (near(guess(l, f.tk + TICK_HZ)) === real) atBend++;
      if (near(guess(l, l.at - secs(SILO.reveal) - TICK_HZ)) === real) late++;
    }
    // A straight flight would point at the real ring every time. Chance is a third.
    expect(early / runs.length).toBeLessThan(0.65);
    expect(atBend / runs.length).toBeLessThan(0.65);
    expect(late / runs.length).toBeGreaterThan(0.9);
  });

  it('is drawn once at launch and frozen: the same on every run, across save and load, without spending the match\'s dice', () => {
    const play = (save: boolean) => {
      let s = game();
      const t = town(s);
      scoutAll(s);
      const l = launchAt(s, t.x, t.y)!;
      run(s, 10);
      if (save) s = deserialize(serialize(s));
      run(s, 10);
      return { s, arc: l.arc, now: missilesAt(s.launches![0], s.tick) };
    };
    const a = play(false), b = play(true);
    expect(b.arc).toEqual(a.arc);
    expect(b.now).toEqual(a.now);
    expect(checksum(b.s)).toBe(checksum(a.s));
    // The course draws on its own seed: the match's dice stand where a launch's rings left them.
    const s = game();
    const t = town(s);
    scoutAll(s);
    const silo = placeBuilding(s, 0, 'silo', s.players[0].startX + 8, s.players[0].startY + 8, true);
    run(s, 1);
    s.players[0].nukes = { n: SILO.cap };
    // The twin draws only the launch's rings, then plays the same tick without it.
    const twin = deserialize(serialize(s));
    step(s, [{ t: 'launch', p: 0, silo: silo.id, x: t.x, y: t.y }]);
    warningsOf(twin, 0, [{ x: t.x, y: t.y }]);
    step(twin);
    expect(s.launches![0].arc).toBeDefined();
    expect(twin.rng).toBe(s.rng);
  });

  it('draws no missile for a launch from an older save, which still lands', () => {
    const s = game();
    const t = town(s);
    scoutAll(s);
    const l = launchAt(s, t.x, t.y)!;
    delete l.arc;
    expect(flightOf(l)).toBeNull();
    expect(missilesAt(l, s.tick)).toEqual([]);
    run(s, SILO.fuse);
    expect(s.events.some((e) => e.k === 'silo' && e.what === 'struck')).toBe(true);
  });

  it('flies a salvo as one missile from its first silo, which splits at the bend into one per live warhead', () => {
    const s = game();
    restat(s, s.players[0], () => { s.players[0].techs.push('launchControl'); });
    const p = s.players[0];
    const silos = [[8, 8], [12, 8], [-10, 8]].map(([dx, dy]) => placeBuilding(s, 0, 'silo', p.startX + dx, p.startY + dy, true));
    run(s, 1);
    p.nukes = { n: SILO.cap };
    const t = tc(s, 1);
    const sx = t.x < s.w / 2 ? 1 : -1, sy = t.y < s.h / 2 ? 1 : -1;
    const pts = [{ x: t.x, y: t.y }, { x: t.x + sx * 10, y: t.y }, { x: t.x, y: t.y + sy * 10 }];
    const order: Command = { t: 'launch', p: 0, silo: silos[0].id, x: pts[0].x, y: pts[0].y, more: pts.slice(1).map((a, i) => ({ silo: silos[i + 1].id, ...a })) };
    step(s, [order]);
    const l = s.launches![0];
    const f = flightOf(l)!;
    expect(l.arc).toMatchObject({ x: silos[0].x, y: silos[0].y });
    expect(missilesAt(l, f.tk - 1)).toHaveLength(1);
    expect(missilesAt(l, f.tk + 1)).toHaveLength(3);
    expect(missilesAt(l, l.at).map(({ x, y }) => ({ x, y }))).toEqual(pts);
    // A silo that falls takes its warhead's missile with it.
    silos[2].hp = 0;
    step(s);
    expect(missilesAt(l, f.tk + 1)).toHaveLength(2);
    expect(missilesAt(l, l.at).map(({ x, y }) => ({ x, y }))).toEqual(pts.slice(0, 2));
  });

  it('a computer defender reads the bend like a player: it stops clearing a ring the course has ruled out, never the real one', () => {
    let tried = 0;
    for (let seed = 1; seed < 40 && tried < 3; seed++) {
      const s = game(seed, [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: 'hard', civ: 'romans' }]);
      const t = town(s);
      scoutAll(s);
      const l = launchAt(s, t.x, t.y);
      if (!l) continue;
      const f = flightOf(l)!;
      const set = l.warn![0];
      const real = set.rings[set.real];
      // Only maps where a player reading the course at that moment would rule the decoy out.
      const when = Math.ceil(f.tk + AI_SILO.read * TICK_HZ);
      if (when >= l.at - secs(SILO.reveal)) continue;
      const g = guess(l, when);
      const decoy = set.rings.map((r, i) => ({ r, i })).filter(({ i }) => i !== set.real).sort((a, b) => d2(b.r, g) - d2(a.r, g))[0].r;
      if (d2(real, g) >= d2(decoy, g)) continue;
      tried++;
      while (s.tick < when) step(s);
      const inDecoy = [0, 1].map((k) => spawnUnit(s, 1, 'infantry', decoy.x + k * 0.4, decoy.y));
      const inReal = [0, 1].map((k) => spawnUnit(s, 1, 'infantry', real.x + k * 0.4, real.y));
      for (let i = 0; i < TICK_HZ && !revealed(s, l); i++) step(s);
      // Run out of a ring: a plain move (the army's own orders are attack-moves).
      const ranOut = (m: { order: unknown }) => { const o = m.order as { k: string; amove?: boolean }; return o.k === 'move' && !o.amove; };
      for (const m of inDecoy) expect(ranOut(m)).toBe(false);
      for (const m of inReal) expect(ranOut(m)).toBe(true);
    }
    expect(tried).toBeGreaterThan(0);
  });
});
