import { afterEach, describe, expect, it } from 'vitest';
import { INTERCEPT, SILO, secs } from '../src/sim/data';
import { checksum, createGame, step, type PlayerSetup } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { armed, covers, fuelOf, held, launchProblem, ringOf, rulesOf, salvoProblem, salvoSilos, stockOf } from '../src/sim/silo';
import { placeBuilding, restat } from '../src/sim/world';
import type { Building, GameEvent, GameState, Launch } from '../src/sim/types';

/** Missile defence s3 (#781, of #759): a silo held in Reserve answers a rival warhead with a warhead of its people's store. */

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
/** `n` finished silos of `o`'s round its start, and a full store. */
const silos = (s: GameState, o: number, n: number): Building[] => {
  const p = s.players[o];
  const out = [[8, 8], [12, 8], [-10, 8]].slice(0, n).map(([dx, dy]) => placeBuilding(s, o, 'silo', p.startX + dx, p.startY + dy, true));
  run(s, 1);
  p.nukes = { n: SILO.cap };
  return out;
};
const battery = (s: GameState, o: number, x: number, y: number): Building => placeBuilding(s, o, 'battery', x - 1, y - 1, true);
/** Hold `b` in Reserve (by its owner's command) and wait until it stands ready. */
const reserve = (s: GameState, b: Building) => {
  step(s, [{ t: 'reserve', p: b.owner, silo: b.id, on: true }]);
  run(s, INTERCEPT.arm);
  expect(armed(s, b)).toBe(true);
};
const fireAt = (s: GameState, silo: Building, x: number, y: number): Launch => {
  step(s, [{ t: 'launch', p: 0, silo: silo.id, x, y }]);
  return s.launches![s.launches!.length - 1];
};
const icptEvents = (s: GameState) => s.events.filter((e): e is Extract<GameEvent, { k: 'intercept' }> => e.k === 'intercept');
const struck = (s: GameState) => s.events.filter((e) => e.k === 'silo' && e.what === 'struck');
const refusals = (s: GameState) => s.events.filter((e) => e.k === 'refused');

const chance = INTERCEPT.chance;
afterEach(() => { INTERCEPT.chance = chance; });

describe('the silo held in Reserve (#781)', () => {
  it('launches nothing while set, a salvo included, and stands down at once', () => {
    const s = game();
    restat(s, s.players[0], () => { s.players[0].techs.push('launchControl'); });
    const three = silos(s, 0, 3);
    const t = tc(s, 1);
    step(s, [{ t: 'reserve', p: 0, silo: three[0].id, on: true }]);
    expect(held(three[0])).toBe(true);
    expect(launchProblem(s, 0, three[0], t.x, t.y)).toMatch(/Reserve/);
    step(s, [{ t: 'launch', p: 0, silo: three[0].id, x: t.x, y: t.y }]);
    expect(s.launches ?? []).toHaveLength(0);
    // A salvo neither fires from it nor counts it among the standing silos.
    expect(salvoSilos(s, 0, three[0].id).map((b) => b.id)).toEqual([three[1].id, three[2].id]);
    expect(salvoProblem(s, 0)).toMatch(/Reserve/);
    const pts = [{ x: t.x, y: t.y }, { x: t.x + 9, y: t.y }, { x: t.x, y: t.y + 9 }];
    expect(salvoProblem(s, 0, pts.map((a, i) => ({ silo: three[i].id, ...a })))).toMatch(/Reserve/);
    // Standing down is at once: the same silo launches the next tick.
    step(s, [{ t: 'reserve', p: 0, silo: three[0].id, on: false }]);
    expect(held(three[0])).toBe(false);
    step(s, [{ t: 'launch', p: 0, silo: three[0].id, x: t.x, y: t.y }]);
    expect(s.launches).toHaveLength(1);
  });

  it('is set only by its owner, on a finished silo', () => {
    const s = game();
    const [mine] = silos(s, 0, 1);
    step(s, [{ t: 'reserve', p: 1, silo: mine.id, on: true }]);
    expect(held(mine)).toBe(false);
    expect(refusals(s)).toHaveLength(1);
    mine.built = false;
    step(s, [{ t: 'reserve', p: 0, silo: mine.id, on: true }]);
    expect(held(mine)).toBe(false);
  });

  it(`stands ready only ${INTERCEPT.arm} s after it was set: a silo still arming makes no attempt`, () => {
    INTERCEPT.chance = 1;
    const s = game();
    const [attack] = silos(s, 0, 1);
    const [guard] = silos(s, 1, 1);
    step(s, [{ t: 'reserve', p: 1, silo: guard.id, on: true }]);
    expect(armed(s, guard)).toBe(false);
    // Its arming is pushed past the warhead's landing, so the 2 s mark finds it still arming.
    guard.reserve = s.tick + secs(SILO.fuse + 10);
    const t = tc(s, 1);
    const l = fireAt(s, attack, t.x, t.y);
    until(s, l.at + 1);
    expect(l.icpt).toBeUndefined();
    expect(struck(s)).toHaveLength(1);
    expect(stockOf(s.players[1])).toBe(SILO.cap);
  });

  it('answers a warhead no battery covers: it spends a warhead from the store and the launch fuel, and a hit takes the blast', () => {
    INTERCEPT.chance = 1;
    const s = game();
    const [attack] = silos(s, 0, 1);
    const [guard] = silos(s, 1, 1);
    reserve(s, guard);
    const p = s.players[1];
    const t = tc(s, 1);
    const l = fireAt(s, attack, t.x, t.y);
    until(s, l.at - secs(INTERCEPT.fire));
    const res = { ...p.res };
    expect(stockOf(p)).toBe(SILO.cap);
    step(s);
    expect(l.icpt).toEqual([{ shot: 0, battery: guard.id, owner: 1, x: guard.x, y: guard.y, hit: true, silo: true }]);
    expect(icptEvents(s)).toMatchObject([{ what: 'fired', owner: 1, silo: true, x: guard.x, y: guard.y }]);
    expect(stockOf(p)).toBe(SILO.cap - 1);
    const fuel = fuelOf(rulesOf(p).w);
    for (const [r, n] of Object.entries(fuel) as [keyof typeof res, number][]) expect(p.res[r]).toBe(res[r] - n);
    // It stands ready again only after arming anew; held in Reserve all the while.
    expect(armed(s, guard)).toBe(false);
    expect(held(guard)).toBe(true);
    until(s, l.at + secs(2));
    expect(struck(s)).toHaveLength(0);
    expect(s.fallout ?? []).toHaveLength(0);
    run(s, INTERCEPT.arm);
    expect(armed(s, guard)).toBe(true);
  });

  it('never tries a warhead a battery took: batteries go first, and the silo keeps its warhead', () => {
    INTERCEPT.chance = 0;
    const s = game();
    const [attack] = silos(s, 0, 1);
    const [guard] = silos(s, 1, 1);
    reserve(s, guard);
    const t = tc(s, 1);
    const l = fireAt(s, attack, t.x, t.y);
    const g = ringOf(l, s.players[1].team, 0);
    const b = battery(s, 1, Math.round(g.x) + 3, Math.round(g.y));
    until(s, l.at + 1);
    // The battery missed, and the silo did not follow it up: one attempt per warhead.
    expect(l.icpt).toEqual([{ shot: 0, battery: b.id, owner: 1, x: b.x, y: b.y, hit: false }]);
    expect(stockOf(s.players[1])).toBe(SILO.cap);
    expect(armed(s, guard)).toBe(true);
    expect(struck(s)).toHaveLength(1);
  });

  it('makes no attempt with an empty store, without the fuel, fallen, or stood down', () => {
    INTERCEPT.chance = 1;
    for (const why of ['empty', 'poor', 'fallen', 'down'] as const) {
      const s = game();
      const [attack] = silos(s, 0, 1);
      const [guard] = silos(s, 1, 1);
      reserve(s, guard);
      const p = s.players[1];
      const t = tc(s, 1);
      const l = fireAt(s, attack, t.x, t.y);
      until(s, l.at - secs(INTERCEPT.fire));
      if (why === 'empty') p.nukes = { n: 0, next: s.tick + secs(999) };
      if (why === 'poor') p.res = { food: 0, wood: 0, gold: 0, stone: 0 };
      if (why === 'fallen') guard.hp = 0;
      if (why === 'down') step(s, [{ t: 'reserve', p: 1, silo: guard.id, on: false }]);
      until(s, l.at + 1);
      expect(l.icpt, why).toBeUndefined();
      expect(struck(s), why).toHaveLength(1);
    }
  });

  it('stores the roll on the launch: a save and load never draws it again', () => {
    INTERCEPT.chance = 1;
    const s = game();
    const [attack] = silos(s, 0, 1);
    const [guard] = silos(s, 1, 1);
    reserve(s, guard);
    const t = tc(s, 1);
    const l = fireAt(s, attack, t.x, t.y);
    until(s, l.at - secs(INTERCEPT.fire) + 1);
    expect(l.icpt![0]).toMatchObject({ silo: true, hit: true });
    const copy = deserialize(serialize(s));
    expect(checksum(copy)).toBe(checksum(s));
    expect(copy.launches![0].icpt).toEqual(l.icpt);
    expect((copy.byId.get(guard.id) as Building).reserve).toBe(guard.reserve);
    INTERCEPT.chance = 0;
    for (const m of [s, copy]) until(m, l.at + 2);
    expect(checksum(copy)).toBe(checksum(s));
    for (const m of [s, copy]) {
      expect(m.launches ?? []).toHaveLength(0);
      expect(m.fallout ?? []).toHaveLength(0);
    }
  });

  it('a salvo against one battery and one Reserve silo draws two attempts, the silo taking a warhead the battery does not cover', () => {
    INTERCEPT.chance = 1;
    const s = game();
    restat(s, s.players[0], () => { s.players[0].techs.push('launchControl'); });
    const three = silos(s, 0, 3);
    const [guard] = silos(s, 1, 1);
    reserve(s, guard);
    const t = tc(s, 1);
    const sx = t.x < s.w / 2 ? 1 : -1, sy = t.y < s.h / 2 ? 1 : -1;
    const pts = [{ x: t.x, y: t.y }, { x: t.x + sx * 30, y: t.y }, { x: t.x, y: t.y + sy * 30 }];
    step(s, [{ t: 'launch', p: 0, silo: three[0].id, x: pts[0].x, y: pts[0].y, more: pts.slice(1).map((a, i) => ({ silo: three[i + 1].id, ...a })) }]);
    const l = s.launches![0];
    const g = ringOf(l, s.players[1].team, 0);
    const b = battery(s, 1, Math.round(g.x), Math.round(g.y));
    expect([0, 1, 2].map((i) => covers(s, b, l, i))).toEqual([true, false, false]);
    until(s, l.at - secs(INTERCEPT.fire) + 1);
    // The battery takes the first; the silo, one interceptor ready, the next; the third goes unanswered.
    expect(l.icpt!.map((c) => [c.shot, c.battery])).toEqual([[0, b.id], [1, guard.id]]);
    expect(stockOf(s.players[1])).toBe(SILO.cap - 1);
    let blasts = 0;
    while (s.tick <= l.at) {
      step(s);
      blasts += struck(s).length;
    }
    expect(blasts).toBe(1);
  });

  it('answers only a rival: a warhead of its own people or team draws nothing from it', () => {
    INTERCEPT.chance = 1;
    const s = game();
    const [attack, guard] = silos(s, 0, 2);
    reserve(s, guard);
    const t = tc(s, 1);
    const l = fireAt(s, attack, t.x, t.y);
    until(s, l.at + 1);
    expect(l.icpt).toBeUndefined();
  });
});

describe('the computer and the Reserve (#781)', () => {
  /** A computer attacker (player 0) with `n` long-stood silos and a full store; a rival with a silo of its own and a town to strike. */
  const setup = (n: number, town = true) => {
    const s = game(5, [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }]);
    const mine = silos(s, 0, n);
    for (const b of mine) b.born = -99999;
    silos(s, 1, 1);
    if (!town) return { s, mine };
    // A rival cluster worth a warhead: a Town Center and houses round it.
    const t = tc(s, 1);
    const c = { x: Math.floor(t.x) + (t.x < s.w / 2 ? 16 : -16), y: Math.floor(t.y) };
    placeBuilding(s, 1, 'towncenter', c.x - 2, c.y - 2, true);
    for (const [dx, dy] of [[-4, -4], [2, -4], [-4, 2], [2, 2]]) placeBuilding(s, 1, 'house', c.x + dx, c.y + dy, true);
    return { s, mine };
  };

  it('holds its last silo in Reserve while a rival stands a silo, and still strikes from the other', () => {
    const { s, mine } = setup(2);
    for (let i = 0; i < secs(INTERCEPT.think + 2) && !held(mine[1]); i++) step(s);
    expect(held(mine[1])).toBe(true);
    expect(held(mine[0])).toBe(false);
    for (let i = 0; i < secs(4) && !s.launches?.length; i++) step(s);
    expect(s.launches?.[0]?.silo).toBe(mine[0].id);
    expect(held(mine[1])).toBe(true);
  });

  it('with one silo and a full store, holds it in Reserve while nothing is worth a warhead', () => {
    const { s, mine } = setup(1, false);
    for (let i = 0; i < secs(INTERCEPT.think + 2) && !held(mine[0]); i++) step(s);
    expect(held(mine[0])).toBe(true);
  });

  it('with its one silo held in Reserve, stands it down to strike: Reserve never stops the attack', () => {
    const { s, mine } = setup(1);
    // Held and armed already, as if it had held it a while.
    mine[0].reserve = s.tick;
    for (let i = 0; i < secs(4) && !s.launches?.length; i++) step(s);
    expect(s.launches?.[0]?.silo).toBe(mine[0].id);
    expect(held(mine[0])).toBe(false);
  });
});
