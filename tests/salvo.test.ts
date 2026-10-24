import { describe, expect, it } from 'vitest';
import { FISSION, SALVO, SILO, WARHEADS, secs } from '../src/sim/data';
import { checksum, createGame, step, type PlayerSetup } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { aloftOf, revealed, ringsFor, salvoFuel, salvoProblem, siloLimit, stockOf } from '../src/sim/silo';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import type { Building, Command, GameEvent, GameState, Launch } from '../src/sim/types';

/** The salvo (#765): three silos, three warheads, three real rings drawn like a single strike's, scrubbed one silo at a time. */

const game = (seed = 5, players: PlayerSetup[] = [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }]) => {
  const s = createGame({ seed, size: 'small', startEpoch: 5, players });
  // Spare rival Town Centers far off: a real strike may break the first, and the match must go on.
  for (let o = 1; o < players.length; o++) placeBuilding(s, o, 'towncenter', s.players[o].startX < s.w / 2 ? s.w - 8 : 8, s.players[o].startY < s.h / 2 ? s.h - 8 : 8, true);
  for (const p of s.players) p.res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
  return s;
};
const tc = (s: GameState, o: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === o && e.type === 'towncenter')!;
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const learn = (s: GameState, o = 0) => restat(s, s.players[o], () => { s.players[o].techs.push('launchControl'); });
/** Three standing silos round player `o`'s start, Launch Control learned, a full store. */
const armed = (s: GameState, o = 0): Building[] => {
  learn(s, o);
  const p = s.players[o];
  const silos = [[8, 8], [12, 8], [-10, 8]].map(([dx, dy]) => placeBuilding(s, o, 'silo', p.startX + dx, p.startY + dy, true));
  run(s, 1);
  p.nukes = { n: SILO.cap };
  return silos;
};
/** Three points round the rival's Town Center, `gap` tiles apart, toward the middle of the map. */
const trio = (s: GameState, gap = SILO.apart + 2) => {
  const t = tc(s, 1);
  const sx = t.x < s.w / 2 ? 1 : -1, sy = t.y < s.h / 2 ? 1 : -1;
  return [{ x: t.x, y: t.y }, { x: t.x + sx * gap, y: t.y }, { x: t.x, y: t.y + sy * gap }];
};
const order = (silos: Building[], pts: { x: number; y: number }[], p = 0): Extract<Command, { t: 'launch' }> => ({ t: 'launch', p, silo: silos[0].id, x: pts[0].x, y: pts[0].y, more: pts.slice(1).map((a, i) => ({ silo: silos[i + 1].id, ...a })) });
const scoutAll = (s: GameState) => { s.players[0].seen.fill(1); s.players[0].vis.fill(1); };
const onTile = (v: number) => v - Math.floor(v) === 0.5;
const launched = (s: GameState) => s.events.filter((e): e is Extract<GameEvent, { k: 'silo' }> => e.k === 'silo' && e.what === 'launched');

describe('the salvo (#765)', () => {
  it('spends three warheads at the order, one from each of three silos, on the people\'s one clock', () => {
    const s = game();
    const silos = armed(s);
    const pts = trio(s);
    step(s, [order(silos, pts)]);
    expect(s.launches).toHaveLength(1);
    const l = s.launches![0];
    expect(l.salvo!.map((sh) => sh.silo)).toEqual(silos.map((b) => b.id));
    expect(l.salvo!.map(({ x, y }) => ({ x, y }))).toEqual(pts);
    expect(stockOf(s.players[0])).toBe(SILO.cap - SALVO.trio);
    expect(aloftOf(s, 0)).toBe(SALVO.trio);
    expect(l.at - s.tick).toBe(secs(SILO.fuse) - 1);
  });

  it('allows a third silo only with Launch Control, and never a fourth', () => {
    const s = game();
    const p = s.players[0];
    placeBuilding(s, 0, 'silo', p.startX + 8, p.startY + 8, true);
    placeBuilding(s, 0, 'silo', p.startX + 12, p.startY + 8, false);
    expect(siloLimit(s, 0, 'silo')).toMatch(/at most 2.*Launch Control/);
    learn(s);
    expect(siloLimit(s, 0, 'silo')).toBeNull();
    placeBuilding(s, 0, 'silo', p.startX - 10, p.startY + 8, true);
    expect(siloLimit(s, 0, 'silo')).toMatch(/at most 3/);
  });

  it('checks the points and silos when the order is given', () => {
    const s = game();
    const silos = armed(s);
    const pts = trio(s);
    const shots = (q: { x: number; y: number }[], from = silos) => q.map((a, i) => ({ silo: from[i].id, ...a }));
    expect(salvoProblem(s, 0, shots(pts))).toBeNull();
    expect(salvoProblem(s, 0, shots(trio(s, SILO.apart - 1)))).toMatch(/apart/);
    expect(salvoProblem(s, 0, shots([pts[0], pts[1], { x: -3, y: pts[2].y }]))).toMatch(/on the map/);
    expect(salvoProblem(s, 0, shots(pts, [silos[0], silos[0], silos[1]]))).toMatch(/standing silos/);
    expect(salvoProblem(s, 0, shots(pts).slice(0, 2))).toMatch(/Pick 3/);
    const theirs = placeBuilding(s, 1, 'silo', s.players[1].startX + 8, s.players[1].startY + 8, true);
    expect(salvoProblem(s, 0, shots(pts, [silos[0], silos[1], theirs]))).toMatch(/standing silos/);
    // A refused order changes nothing.
    step(s, [{ ...order(silos, pts), more: shots(trio(s, 3)).slice(1) }]);
    expect(s.launches).toBeUndefined();
    expect(stockOf(s.players[0])).toBe(SILO.cap);
    expect(s.events.some((e) => e.k === 'refused' && /apart/.test(e.why))).toBe(true);
    // Fewer than three standing silos, a short store, or no Launch Control: no salvo.
    s.players[0].nukes = { n: 2 };
    expect(salvoProblem(s, 0)).toMatch(/3 warheads from your store/);
    s.players[0].nukes = { n: 3 };
    silos[2].hp = 0;
    expect(salvoProblem(s, 0)).toMatch(/3 standing Missile Silos: you have 2/);
    const t = game();
    placeBuilding(t, 0, 'silo', t.players[0].startX + 8, t.players[0].startY + 8, true);
    expect(salvoProblem(t, 0)).toMatch(/Launch Control/);
  });

  it('costs a plain Atomic people more fuel on each warhead than one past the fork', () => {
    const s = game();
    const silos = armed(s);
    const gold = s.players[0].res.gold;
    expect(salvoFuel(s.players[0]).gold).toBe(SILO.fuel.gold * SALVO.trio * (1 + SALVO.surcharge));
    step(s, [order(silos, trio(s))]);
    expect(gold - s.players[0].res.gold).toBe(SILO.fuel.gold * SALVO.trio * (1 + SALVO.surcharge));
    const f = game();
    const fs = armed(f);
    restat(f, f.players[0], () => { f.players[0].age = 'fission'; });
    const before = f.players[0].res.gold;
    step(f, [order(fs, trio(f))]);
    expect(before - f.players[0].res.gold).toBe(SILO.fuel.gold * SALVO.trio);
    // On the Fission clock, and the Fission poison round one silo only, as for any launch.
    expect(f.launches![0].at - f.tick).toBe(secs(FISSION.fuse) - 1);
    expect(f.fallout).toHaveLength(1);
  });

  it('looks to a rival like a single strike: one launch, one event of the same shape, three rings by the same rule', () => {
    const one = game();
    scoutAll(one);
    const [silo] = armed(one);
    const t = tc(one, 1);
    step(one, [{ t: 'launch', p: 0, silo: silo.id, x: t.x, y: t.y }]);
    const many = game();
    scoutAll(many);
    const silos = armed(many);
    step(many, [order(silos, trio(many))]);
    const [a] = launched(one), [b] = launched(many);
    expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
    expect({ ...b, x: 0, y: 0, id: 0 }).toEqual({ ...a, x: 0, y: 0, id: 0 });
    const l = many.launches![0];
    for (const [s, k] of [[one, one.launches![0]], [many, l]] as [GameState, Launch][]) {
      const rings = ringsFor(s, k, 1);
      expect(rings).toHaveLength(3);
      for (const r of rings) expect(onTile(r.x) && onTile(r.y)).toBe(true);
    }
    // Every ring is its own true point's tile, blurred by at most SILO.blur on each axis; none is the attacker's aim itself.
    const set = l.warn![0];
    set.rings.forEach((r, i) => {
      const p = l.salvo![set.of![i]];
      expect(Math.abs(r.x - (Math.floor(p.x) + 0.5))).toBeLessThanOrEqual(SILO.blur);
      expect(Math.abs(r.y - (Math.floor(p.y) + 0.5))).toBeLessThanOrEqual(SILO.blur);
    });
    expect([...set.of!].sort()).toEqual([0, 1, 2]);
    // The attacker sees its own three aims.
    expect(ringsFor(many, l, 0)).toEqual(trio(many));
  });

  it('keeps all three rings at the reveal, where they were drawn, and strikes each true point', () => {
    const s = game();
    scoutAll(s);
    const silos = armed(s);
    const pts = trio(s);
    step(s, [order(silos, pts)]);
    const l = s.launches![0];
    const before = ringsFor(s, l, 1);
    while (!revealed(s, l)) step(s);
    expect(ringsFor(s, l, 1)).toEqual(before);
    const blasts = (s.blasts ?? []).length;
    while (s.launches?.length) step(s);
    const struck = s.blasts!.slice(blasts);
    expect(struck.map(({ x, y, r }) => ({ x, y, r }))).toEqual(pts.map((p) => ({ ...p, r: WARHEADS.atomic.r })));
  });

  it('scrubs one warhead and its ring for each silo that falls; the others fly on and land', () => {
    const s = game();
    scoutAll(s);
    const silos = armed(s);
    const pts = trio(s);
    step(s, [order(silos, pts)]);
    const l = s.launches![0];
    run(s, 2);
    const shown = ringsFor(s, l, 1);
    silos[1].hp = 0;
    step(s);
    const scrub = s.events.filter((e) => e.k === 'silo' && e.what === 'scrubbed');
    expect(scrub).toEqual([expect.objectContaining({ id: l.id, x: pts[1].x, y: pts[1].y })]);
    expect(s.launches).toHaveLength(1);
    expect(ringsFor(s, l, 1)).toEqual(shown.filter((_, i) => l.warn![0].of![i] !== 1));
    expect(ringsFor(s, l, 0)).toEqual([pts[0], pts[2]]);
    expect(aloftOf(s, 0)).toBe(2);
    const blasts = (s.blasts ?? []).length;
    while (s.launches?.length) step(s);
    expect(s.blasts!.slice(blasts).map(({ x, y }) => ({ x, y }))).toEqual([pts[0], pts[2]]);
    // Every silo down: the whole launch is scrubbed.
    const t = game();
    const ts = armed(t);
    step(t, [order(ts, trio(t))]);
    for (const b of ts) b.hp = 0;
    step(t);
    expect(t.launches).toBeUndefined();
    expect(t.events.filter((e) => e.k === 'silo' && e.what === 'scrubbed')).toHaveLength(3);
  });

  it('keeps a salvo across save and load mid-flight, scrubs and all, and plays on the same', () => {
    const s = game();
    scoutAll(s);
    const silos = armed(s);
    step(s, [order(silos, trio(s))]);
    run(s, 2);
    silos[2].hp = 0;
    run(s, 1);
    const copy = deserialize(serialize(s));
    expect(copy.launches).toEqual(s.launches);
    expect(checksum(copy)).toBe(checksum(s));
    while (s.launches?.length) step(s);
    while (copy.launches?.length) step(copy);
    expect(copy.blasts).toEqual(s.blasts);
    expect(checksum(copy)).toBe(checksum(s));
  });

  it('tracks a salvo and a single strike in the air at once, each on its own', () => {
    const s = game(5, [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }]);
    const silos = armed(s);
    const theirs = placeBuilding(s, 1, 'silo', s.players[1].startX + 8, s.players[1].startY + 8, true);
    run(s, 1);
    s.players[1].nukes = { n: 1 };
    const home = tc(s, 0);
    step(s, [order(silos, trio(s)), { t: 'launch', p: 1, silo: theirs.id, x: home.x, y: home.y }]);
    expect(s.launches).toHaveLength(2);
    const [a, b] = s.launches!;
    expect(ringsFor(s, a, 1)).toHaveLength(3);
    expect(ringsFor(s, b, 0)).toHaveLength(3);
    silos[0].hp = 0;
    step(s);
    expect(ringsFor(s, a, 1)).toHaveLength(2);
    expect(ringsFor(s, b, 0)).toHaveLength(3);
    while (!revealed(s, b)) step(s);
    expect(ringsFor(s, a, 1)).toHaveLength(2);
    expect(ringsFor(s, b, 0)).toHaveLength(1);
  });
});

describe('the computer and the salvo (#765)', () => {
  /** A computer attacker with three silos long stood, Launch Control and a full store; rival clusters of a Town Center and houses. */
  const setup = (clusters: number) => {
    const s = game(5, [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }]);
    const silos = armed(s);
    for (const b of silos) b.born = -99999;
    const t = tc(s, 1);
    const sx = t.x < s.w / 2 ? 1 : -1, sy = t.y < s.h / 2 ? 1 : -1;
    const at = [{ x: t.x + sx * 14, y: t.y }, { x: t.x, y: t.y + sy * 14 }, { x: t.x + sx * 14, y: t.y + sy * 14 }].slice(0, clusters);
    for (const c of at) {
      placeBuilding(s, 1, 'towncenter', Math.floor(c.x) - 2, Math.floor(c.y) - 2, true);
      for (const [dx, dy] of [[-4, -4], [2, -4], [-4, 2], [2, 2]]) placeBuilding(s, 1, 'house', Math.floor(c.x) + dx, Math.floor(c.y) + dy, true);
    }
    return s;
  };
  const firstLaunch = (s: GameState): Launch | undefined => {
    for (let i = 0; i < secs(4) && !s.launches?.length; i++) step(s);
    return s.launches?.[0];
  };

  it('fires a salvo at three spread-out towns, each worth a warhead', () => {
    const s = setup(3);
    const l = firstLaunch(s);
    expect(l?.salvo).toHaveLength(SALVO.trio);
  });

  it('learns Launch Control at its silo when a salvo would pay, before raising more silos', () => {
    const s = setup(3);
    const p = s.players[0];
    restat(s, p, () => { p.techs = p.techs.filter((t) => t !== 'launchControl'); });
    const silos = s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'silo');
    for (const b of silos.slice(1)) b.hp = 0;
    run(s, 1);
    for (let i = 0; i < 24; i++) spawnUnit(s, 0, 'citizen', p.startX + (i % 6), p.startY - 4 - Math.floor(i / 6));
    p.res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
    let queued = false;
    for (let i = 0; i < secs(4) && !queued; i++) {
      step(s);
      queued = silos[0].queue.some((q) => q.tech === 'launchControl');
    }
    expect(queued).toBe(true);
  });

  it('sends one warhead where fewer than three towns are worth one', () => {
    const s = setup(1);
    const l = firstLaunch(s);
    expect(l).toBeDefined();
    expect(l!.salvo).toBeUndefined();
  });
});
