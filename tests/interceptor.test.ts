import { afterEach, describe, expect, it } from 'vitest';
import { INTERCEPT, SILO, secs } from '../src/sim/data';
import { buildBarred } from '../src/sim/ages';
import { checksum, createGame, step, type PlayerSetup } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { charged, covers, ringOf, ringsFor, shownToAll } from '../src/sim/silo';
import { placeBuilding, restat } from '../src/sim/world';
import type { Building, GameEvent, GameState, Launch } from '../src/sim/types';

/** Missile defence s2 (#777, of #759): the Interceptor Battery, the roll drawn and stored at 2 s, met at 1 s, a hit taking blast and fallout. */

const game = (seed = 5, players: PlayerSetup[] = [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }]) => {
  const s = createGame({ seed, size: 'small', startEpoch: 5, players });
  // Spare rival Town Centers far off: a real strike may break the first, and the match must go on.
  for (let o = 1; o < players.length; o++) placeBuilding(s, o, 'towncenter', s.players[o].startX < s.w / 2 ? s.w - 8 : 8, s.players[o].startY < s.h / 2 ? s.h - 8 : 8, true);
  for (const p of s.players) p.res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
  return s;
};
const tc = (s: GameState, o: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === o && e.type === 'towncenter')!;
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const until = (s: GameState, tick: number) => { while (s.tick < tick) step(s); };
const learn = (s: GameState, o: number, tech: 'interceptors' | 'launchControl') => restat(s, s.players[o], () => { s.players[o].techs.push(tech); });
const silos = (s: GameState, n: number): Building[] => {
  const p = s.players[0];
  const out = [[8, 8], [12, 8], [-10, 8]].slice(0, n).map(([dx, dy]) => placeBuilding(s, 0, 'silo', p.startX + dx, p.startY + dy, true));
  run(s, 1);
  p.nukes = { n: SILO.cap };
  return out;
};
/** A finished battery of `o`'s whose centre stands at (x, y) (a 2-tile building: its centre is a whole tile corner). */
const battery = (s: GameState, o: number, x: number, y: number): Building => placeBuilding(s, o, 'battery', x - 1, y - 1, true);
const fireAt = (s: GameState, silo: Building, x: number, y: number): Launch => {
  step(s, [{ t: 'launch', p: 0, silo: silo.id, x, y }]);
  return s.launches![s.launches!.length - 1];
};
const icptEvents = (s: GameState) => s.events.filter((e): e is Extract<GameEvent, { k: 'intercept' }> => e.k === 'intercept');
const struck = (s: GameState) => s.events.filter((e) => e.k === 'silo' && e.what === 'struck');
/** The real ring rival team 1 is shown for a single strike. */
const ring = (s: GameState, l: Launch) => ringOf(l, s.players[1].team, 0);

const chance = INTERCEPT.chance;
afterEach(() => { INTERCEPT.chance = chance; });

describe('the Interceptor Battery (#777)', () => {
  it('is raised only after Interceptors, and every player sees it once it stands', () => {
    const s = game();
    const p = s.players[1];
    expect(buildBarred(p, 'battery')).toMatch(/Interceptors/);
    learn(s, 1, 'interceptors');
    expect(buildBarred(p, 'battery')).toBeNull();
    const b = battery(s, 1, p.startX + 6, p.startY + 6);
    expect(shownToAll(b)).toBe(true);
    expect(charged(s, b)).toBe(true);
    b.built = false;
    expect(charged(s, b)).toBe(false);
  });

  it('fires exactly 2 s before the warhead lands and meets it exactly 1 s before; a hit takes the blast and the fallout', () => {
    INTERCEPT.chance = 1;
    const s = game();
    const [silo] = silos(s, 1);
    const t = tc(s, 1);
    const hp = t.hp;
    const l = fireAt(s, silo, t.x, t.y);
    const g = ring(s, l);
    const b = battery(s, 1, Math.round(g.x) + 3, Math.round(g.y));
    until(s, l.at - secs(INTERCEPT.fire));
    expect(l.icpt).toBeUndefined();
    step(s);
    expect(l.icpt).toEqual([{ shot: 0, battery: b.id, owner: 1, x: b.x, y: b.y, hit: true }]);
    expect(icptEvents(s).map((e) => e.what)).toEqual(['fired']);
    expect(charged(s, b)).toBe(false);
    until(s, l.at - secs(INTERCEPT.meet));
    expect(s.launches).toContain(l);
    step(s);
    expect(icptEvents(s).map((e) => e.what)).toEqual(['hit']);
    expect(s.launches ?? []).not.toContain(l);
    until(s, l.at + secs(2));
    expect(struck(s)).toHaveLength(0);
    expect(s.fallout ?? []).toHaveLength(0);
    expect(t.hp).toBe(hp);
  });

  it('a miss flies on and lands, blast and fallout both', () => {
    INTERCEPT.chance = 0;
    const s = game();
    const [silo] = silos(s, 1);
    const t = tc(s, 1);
    const l = fireAt(s, silo, t.x, t.y);
    const g = ring(s, l);
    battery(s, 1, Math.round(g.x) + 3, Math.round(g.y));
    until(s, l.at - secs(INTERCEPT.meet) + 1);
    expect(l.icpt![0].hit).toBe(false);
    expect(icptEvents(s).map((e) => e.what)).toEqual(['missed']);
    expect(s.launches).toContain(l);
    let blasts = 0;
    while (s.tick <= l.at) {
      step(s);
      blasts += struck(s).length;
    }
    expect(blasts).toBe(1);
    expect(s.fallout?.length).toBeGreaterThan(0);
  });

  it('stores the roll on the launch: a save and load, or a change of odds, never draws it again', () => {
    INTERCEPT.chance = 1;
    const s = game();
    const [silo] = silos(s, 1);
    const t = tc(s, 1);
    const l = fireAt(s, silo, t.x, t.y);
    const g = ring(s, l);
    battery(s, 1, Math.round(g.x) + 3, Math.round(g.y));
    until(s, l.at - secs(INTERCEPT.fire) + 1);
    expect(l.icpt![0].hit).toBe(true);
    const copy = deserialize(serialize(s));
    expect(checksum(copy)).toBe(checksum(s));
    expect(copy.launches![0].icpt).toEqual(l.icpt);
    // The odds turn against it after it fired: the stored hit stands, in the original and the loaded copy alike.
    INTERCEPT.chance = 0;
    for (const m of [s, copy]) until(m, l.at + 2);
    expect(checksum(copy)).toBe(checksum(s));
    for (const m of [s, copy]) {
      expect(m.launches ?? []).toHaveLength(0);
      expect(m.fallout ?? []).toHaveLength(0);
    }
  });

  it('decides cover from the ring as drawn, not the true point: a ring just inside the edge is covered, just outside is not', () => {
    const s = game();
    const [silo] = silos(s, 1);
    const t = tc(s, 1);
    const l = fireAt(s, silo, t.x, t.y);
    const set = l.warn!.find((w) => w.team === s.players[1].team)!;
    // Draw the real ring well off the true point, as a wide blur might: the battery reads the ring.
    set.rings[set.real] = { x: Math.floor(t.x) + 0.5 + 30 * (t.x < s.w / 2 ? 1 : -1), y: Math.floor(t.y) + 0.5 };
    const g = ring(s, l);
    const r = INTERCEPT.reach;
    const inside = battery(s, 1, g.x - (r - 0.5), g.y - 0.5);
    const outside = battery(s, 1, g.x + (r + 0.5), g.y - 0.5);
    const atTruth = battery(s, 1, Math.floor(t.x) + 6, Math.floor(t.y) + 6);
    expect(covers(s, inside, l, 0)).toBe(true);
    expect(covers(s, outside, l, 0)).toBe(false);
    expect(covers(s, atTruth, l, 0)).toBe(false);
    until(s, l.at - secs(INTERCEPT.fire) + 1);
    expect(l.icpt!.map((c) => c.battery)).toEqual([inside.id]);
    // The launcher's own batteries never fire at its own warhead.
    learn(s, 0, 'interceptors');
    expect(covers(s, battery(s, 0, g.x - 3.5, g.y - 0.5), l, 0)).toBe(false);
  });

  it('makes one attempt per warhead: the nearest covering battery fires, the others keep their charge', () => {
    const s = game();
    const [silo] = silos(s, 1);
    const t = tc(s, 1);
    const l = fireAt(s, silo, t.x, t.y);
    const g = ring(s, l);
    const far = battery(s, 1, Math.round(g.x) - 8, Math.round(g.y));
    const near = battery(s, 1, Math.round(g.x) + 3, Math.round(g.y));
    until(s, l.at - secs(INTERCEPT.fire) + 1);
    expect(l.icpt!.map((c) => c.battery)).toEqual([near.id]);
    expect(charged(s, far)).toBe(true);
    expect(charged(s, near)).toBe(false);
    // The spent battery reloads.
    run(s, INTERCEPT.reload);
    expect(charged(s, near)).toBe(true);
  });

  it('a battery destroyed or unfinished before the 2 s mark makes no attempt', () => {
    INTERCEPT.chance = 1;
    const s = game();
    const [silo] = silos(s, 1);
    const t = tc(s, 1);
    const l = fireAt(s, silo, t.x, t.y);
    const g = ring(s, l);
    const b = battery(s, 1, Math.round(g.x) + 3, Math.round(g.y));
    const raw = battery(s, 1, Math.round(g.x) - 3, Math.round(g.y));
    raw.built = false;
    until(s, l.at - secs(INTERCEPT.fire));
    b.hp = 0;
    let blasts = 0;
    while (s.tick <= l.at) {
      step(s);
      blasts += struck(s).length;
    }
    expect(l.icpt).toBeUndefined();
    expect(icptEvents(s)).toHaveLength(0);
    expect(blasts).toBe(1);
  });

  it('simultaneous launches: one charge answers the first, a second battery the second', () => {
    for (const two of [false, true]) {
      const s = game();
      const [a, b] = silos(s, 2);
      const t = tc(s, 1);
      step(s, [{ t: 'launch', p: 0, silo: a.id, x: t.x, y: t.y }, { t: 'launch', p: 0, silo: b.id, x: t.x + 1, y: t.y }]);
      const [l1, l2] = s.launches!;
      expect(l1.at).toBe(l2.at);
      const g = ring(s, l1);
      battery(s, 1, Math.round(g.x) + 3, Math.round(g.y));
      if (two) battery(s, 1, Math.round(ring(s, l2).x) - 3, Math.round(ring(s, l2).y));
      until(s, l1.at - secs(INTERCEPT.fire) + 1);
      expect(l1.icpt).toHaveLength(1);
      expect(l2.icpt?.length ?? 0).toBe(two ? 1 : 0);
      if (two) expect(l2.icpt![0].battery).not.toBe(l1.icpt![0].battery);
    }
  });

  it('a salvo against one charge: one of its three warheads draws the attempt, and a hit takes only that one and its ring', () => {
    INTERCEPT.chance = 1;
    const s = game();
    learn(s, 0, 'launchControl');
    const three = silos(s, 3);
    const t = tc(s, 1);
    const sx = t.x < s.w / 2 ? 1 : -1, sy = t.y < s.h / 2 ? 1 : -1;
    const pts = [{ x: t.x, y: t.y }, { x: t.x + sx * 9, y: t.y }, { x: t.x, y: t.y + sy * 9 }];
    step(s, [{ t: 'launch', p: 0, silo: three[0].id, x: pts[0].x, y: pts[0].y, more: pts.slice(1).map((a, i) => ({ silo: three[i + 1].id, ...a })) }]);
    const l = s.launches![0];
    const team = s.players[1].team;
    const gs = [0, 1, 2].map((i) => ringOf(l, team, i));
    // One battery in the middle of the three rings covers them all.
    const mx = Math.round(gs.reduce((n, g) => n + g.x, 0) / 3), my = Math.round(gs.reduce((n, g) => n + g.y, 0) / 3);
    const b = battery(s, 1, mx, my);
    for (let i = 0; i < 3; i++) expect(covers(s, b, l, i)).toBe(true);
    until(s, l.at - secs(INTERCEPT.fire) + 1);
    expect(l.icpt!.map((c) => c.shot)).toEqual([0]);
    until(s, l.at - secs(INTERCEPT.meet) + 1);
    expect(l.salvo![0].gone).toBe(true);
    expect(ringsFor(s, l, 1)).toHaveLength(2);
    let blasts = 0;
    while (s.tick <= l.at) {
      step(s);
      blasts += struck(s).length;
    }
    expect(blasts).toBe(2);
  });
});

describe('the computer and the Interceptor Battery (#777)', () => {
  it('learns Interceptors and covers its Town Center once a rival stands in the Industrial Age', () => {
    const s = createGame({ seed: 3, size: 'small', startEpoch: 4, players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    p.res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
    placeBuilding(s, 0, 'workshop', p.startX - 9, p.startY + 6, true);
    for (let i = 0; i < secs(240); i++) {
      step(s);
      if (s.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.type === 'battery' && e.built)) break;
    }
    expect(p.techs).toContain('interceptors');
    const b = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'battery');
    expect(b?.built).toBe(true);
    const home = tc(s, 0);
    expect(Math.hypot(b!.x - home.x, b!.y - home.y)).toBeLessThan(INTERCEPT.reach - 2);
  });

  it('leaves them alone while every rival is still short of the Industrial Age', () => {
    const s = createGame({ seed: 3, size: 'small', startEpoch: 4, players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    p.res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
    restat(s, s.players[1], () => { s.players[1].epoch = 3; });
    placeBuilding(s, 0, 'workshop', p.startX - 9, p.startY + 6, true);
    run(s, 60);
    expect(p.techs).not.toContain('interceptors');
  });
});

describe('the computer attacker and the cover (#777)', () => {
  /** A computer attacker with one silo long stood and a full store; two like rival clusters of a Town Center and houses. */
  const setup = (cover: boolean) => {
    const s = game(5, [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }]);
    const [silo] = silos(s, 1);
    silo.born = -99999;
    const t = tc(s, 1);
    const sx = t.x < s.w / 2 ? 1 : -1, sy = t.y < s.h / 2 ? 1 : -1;
    const at = [{ x: t.x + sx * 16, y: t.y }, { x: t.x, y: t.y + sy * 16 }];
    for (const c of at) {
      placeBuilding(s, 1, 'towncenter', Math.floor(c.x) - 2, Math.floor(c.y) - 2, true);
      for (const [dx, dy] of [[-4, -4], [2, -4], [-4, 2], [2, 2]]) placeBuilding(s, 1, 'house', Math.floor(c.x) + dx, Math.floor(c.y) + dy, true);
    }
    // Cover the first town and the cluster beside it, never the second cluster.
    if (cover) for (const c of [{ x: t.x, y: t.y }, at[0]]) battery(s, 1, Math.round(c.x) - 3 * sx, Math.round(c.y) - 3 * sy);
    return { s, open: at[1] };
  };
  const firstLaunch = (s: GameState): Launch | undefined => {
    for (let i = 0; i < secs(4) && !s.launches?.length; i++) step(s);
    return s.launches?.[0];
  };

  it('aims where no charged rival battery covers, when a target as good lies outside the cover', () => {
    const { s, open } = setup(true);
    const l = firstLaunch(s)!;
    expect(l).toBeDefined();
    expect(Math.hypot(l.x - open.x, l.y - open.y)).toBeLessThan(6);
  });
});
