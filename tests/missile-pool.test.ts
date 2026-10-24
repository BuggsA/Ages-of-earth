import { describe, expect, it } from 'vitest';
import { FISSION, FUSION, SILO, WARHEADS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { inFallout, launchProblem, loaded, shownToAll, siloLimit, stockOf, warheadsOf, warnRadius } from '../src/sim/silo';
import { warheadFor } from '../src/sim/ai';
import { placeBuilding, restat } from '../src/sim/world';
import type { Building, Command, GameState } from '../src/sim/types';

const game = () => {
  const s = createGame({ seed: 5, size: 'small', startEpoch: 5, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  // A spare rival Town Center far from both towns: a real strike may break the first, and the match must go on.
  placeBuilding(s, 1, 'towncenter', s.players[1].startX < s.w / 2 ? s.w - 8 : 8, s.players[1].startY < s.h / 2 ? s.h - 8 : 8, true);
  s.players[0].res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
  return s;
};
const tc = (s: GameState, o: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === o && e.type === 'towncenter')!;
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const turn = (s: GameState, age: 'fission' | 'fusion') => restat(s, s.players[0], () => { s.players[0].age = age; });
const siloAt = (s: GameState, dx: number, dy = 8) => placeBuilding(s, 0, 'silo', s.players[0].startX + dx, s.players[0].startY + dy, true);
const fire = (s: GameState, silo: Building, x: number, y: number, w?: 'atomic' | 'fission' | 'fusion') => step(s, [{ t: 'launch', p: 0, silo: silo.id, x, y, ...(w ? { w } : {}) }]);
/** A far point with nothing of the rival's near it, so a strike ends nothing. */
const empty = (s: GameState) => ({ x: s.players[0].startX < s.w / 2 ? s.w - 8 : 8, y: s.players[0].startY < s.h / 2 ? 8 : s.h - 8 });

describe('the missile pool (#753)', () => {
  it('starts with SILO.stock once a silo stands, spends at the order, and refuses an empty store', () => {
    const s = game();
    expect(s.players[0].nukes).toBeUndefined();
    const silo = siloAt(s, 8);
    run(s, 1);
    expect(s.players[0].nukes?.n).toBe(SILO.stock);
    const t = empty(s);
    fire(s, silo, t.x, t.y);
    // Spent the moment it is ordered, not when it lands.
    expect(stockOf(s.players[0])).toBe(SILO.stock - 1);
    expect(s.launches).toHaveLength(1);
    expect(loaded(s, silo)).toBe(false);
    expect(launchProblem(s, 0, silo, t.x, t.y)).toMatch(/Refuelling/);
    fire(s, silo, t.x, t.y);
    expect(s.launches).toHaveLength(1);
  });

  it('makes one warhead every refuel, never more than SILO.cap in store and in the air together', () => {
    const s = game();
    const silo = siloAt(s, 8);
    run(s, 1);
    run(s, SILO.refuel + 1);
    expect(stockOf(s.players[0])).toBe(SILO.stock + 1);
    run(s, SILO.refuel * (SILO.cap + 2));
    expect(stockOf(s.players[0])).toBe(SILO.cap);
    expect(s.players[0].nukes!.next).toBeUndefined();
    // One in the air holds a slot: the store refills only to cap − 1 while it flies.
    const t = empty(s);
    fire(s, silo, t.x, t.y);
    expect(stockOf(s.players[0])).toBe(SILO.cap - 1);
    run(s, SILO.fuse - 2);
    expect(stockOf(s.players[0]) + (s.launches?.length ?? 0)).toBeLessThanOrEqual(SILO.cap);
  });

  it('keeps its store when every silo falls, and fires again from a new one; any standing silo launches', () => {
    const s = game();
    const a = siloAt(s, 8), b = siloAt(s, 12);
    run(s, 1);
    s.players[0].nukes = { n: 2, next: s.tick + secs(SILO.refuel) };
    const t = empty(s);
    fire(s, b, t.x, t.y);
    expect(s.launches![0].silo).toBe(b.id);
    a.hp = 0;
    b.hp = 0;
    run(s, 1);
    // The launch from the fallen silo is scrubbed and its warhead lost; the one in store stays.
    expect(s.launches).toBeUndefined();
    expect(stockOf(s.players[0])).toBe(1);
    const c = siloAt(s, -10);
    expect(launchProblem(s, 0, c, t.x, t.y)).toBeNull();
    fire(s, c, t.x, t.y);
    expect(s.launches).toHaveLength(1);
    expect(stockOf(s.players[0])).toBe(0);
  });

  it('Fusion makes a warhead the moment a slot frees, so at most SILO.cap are aloft', () => {
    const s = game(); turn(s, 'fusion');
    const silo = siloAt(s, 8);
    const t = empty(s);
    for (let i = 0; i < SILO.cap + 2; i++) fire(s, silo, t.x, t.y);
    expect(s.launches).toHaveLength(SILO.cap);
    expect(launchProblem(s, 0, silo, t.x, t.y)).toMatch(/already in the air/);
    silo.hp = 0;
    run(s, 1);
    expect(s.launches).toBeUndefined();
    expect(stockOf(s.players[0])).toBe(SILO.cap);
  });
});

describe('the silo limit (#753)', () => {
  it('lets a people raise at most SILO.most silos, rising sites included', () => {
    const s = game();
    expect(siloLimit(s, 0, 'silo')).toBeNull();
    siloAt(s, 8);
    placeBuilding(s, 0, 'silo', s.players[0].startX + 12, s.players[0].startY + 8, false);
    expect(siloLimit(s, 0, 'silo')).toMatch(/at most 2/);
    expect(siloLimit(s, 0, 'house')).toBeNull();
    expect(siloLimit(s, 1, 'silo')).toBeNull();
    const before = s.ents.filter((e) => e.kind === 'building' && e.type === 'silo').length;
    const builder = s.ents.find((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen')!;
    step(s, [{ t: 'build', p: 0, ids: [builder.id], type: 'silo', tx: s.players[0].startX + 8, ty: s.players[0].startY - 10 }]);
    expect(s.ents.filter((e) => e.kind === 'building' && e.type === 'silo').length).toBe(before);
    expect(s.events.some((e) => e.k === 'refused' && /at most 2/.test(e.why))).toBe(true);
  });
});

describe('the warhead chosen at launch (#753)', () => {
  it('plain Atomic fires only Atomic; Fission chooses Atomic or Fission; Fusion Atomic or Fusion', () => {
    const s = game();
    const silo = siloAt(s, 8);
    const t = empty(s);
    expect(warheadsOf(s.players[0])).toEqual(['atomic']);
    expect(launchProblem(s, 0, silo, t.x, t.y, 'fission')).toMatch(/cannot make/);
    expect(launchProblem(s, 0, silo, t.x, t.y, 'bogus' as 'atomic')).toMatch(/cannot make/);
    turn(s, 'fission');
    expect(warheadsOf(s.players[0])).toEqual(['atomic', 'fission']);
    expect(launchProblem(s, 0, silo, t.x, t.y, 'fusion')).toMatch(/cannot make/);
    turn(s, 'fusion');
    expect(warheadsOf(s.players[0])).toEqual(['atomic', 'fusion']);
  });

  it('runs on one clock per people whatever it sends, and pays the warhead’s own fuel', () => {
    for (const [age, fuse, own, fuel] of [['fission', FISSION.fuse, 'fission', FISSION.fuel], ['fusion', FUSION.fuse, 'fusion', FUSION.fuel]] as const) {
      const s = game(); turn(s, age);
      const silo = siloAt(s, 8);
      s.players[0].nukes = { n: 2 };
      const t = empty(s);
      let gold = s.players[0].res.gold;
      fire(s, silo, t.x, t.y, 'atomic');
      expect(s.players[0].res.gold).toBe(gold - SILO.fuel.gold);
      gold = s.players[0].res.gold;
      fire(s, silo, t.x, t.y, own);
      expect(s.players[0].res.gold).toBe(gold - fuel.gold);
      const [a, b] = s.launches!;
      expect([a.w, b.w]).toEqual(['atomic', own]);
      // Both clocks are the people's: launched a tick apart, they land a tick apart.
      expect(b.at - a.at).toBe(1);
      expect(a.at - (s.tick - 2)).toBeLessThanOrEqual(secs(fuse));
      expect(a.at - (s.tick - 2)).toBeGreaterThan(secs(fuse) - 3);
    }
  });

  it('warns every player of the same ring whatever was sent, and names no warhead', () => {
    const s = game(); turn(s, 'fission');
    const silo = siloAt(s, 8);
    s.players[0].nukes = { n: 2 };
    const t = empty(s);
    const rings: (number | undefined)[] = [];
    for (const w of ['atomic', 'fission'] as const) {
      fire(s, silo, t.x, t.y, w);
      const ev = s.events.find((e) => e.k === 'silo' && e.what === 'launched') as { w?: string; ring?: number } | undefined;
      expect(ev).toBeDefined();
      expect(ev?.w).toBeUndefined();
      rings.push(ev?.ring);
    }
    expect(rings).toEqual([WARHEADS.fission.r, WARHEADS.fission.r]);
    expect(warnRadius(s, 0)).toBe(WARHEADS.fission.r);
  });

  it('an Atomic warhead from a Fusion people poisons where it lands; a Fission people’s every launch poisons its silo', () => {
    const s = game(); turn(s, 'fusion');
    const silo = siloAt(s, 8);
    const t = empty(s);
    fire(s, silo, t.x, t.y, 'atomic');
    run(s, FUSION.fuse + 2);
    expect(inFallout(s, t.x, t.y)).toBe(true);
    const f = game(); turn(f, 'fission');
    const fs = siloAt(f, 8);
    fire(f, fs, t.x, t.y, 'atomic');
    expect(inFallout(f, fs.x + 1, fs.y)).toBe(true);
  });

  it('the computer weighs worth for gold: a cheap Atomic at a lone town, its own warhead only when it pays', () => {
    const s = game(); turn(s, 'fission');
    const spare = s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter').pop()!;
    // Houses hard by the spare Town Center: inside both blasts, so the cheap warhead does it all.
    for (const [dx, dy] of [[4, 0], [0, 4], [-4, 0], [0, -4]]) placeBuilding(s, 1, 'house', spare.tx + dx + 1, spare.ty + dy + 1, true);
    const near = warheadFor(s, s.players[0], spare.x, spare.y);
    expect(near?.w).toBe('atomic');
  });
});

describe('silos are seen by all (#753)', () => {
  it('a finished, standing silo is drawn for every player; a rising or fallen one is not', () => {
    const s = game();
    const silo = siloAt(s, 8);
    expect(shownToAll(silo)).toBe(true);
    const site = placeBuilding(s, 0, 'silo', s.players[0].startX + 12, s.players[0].startY + 8, false);
    expect(shownToAll(site)).toBe(false);
    silo.hp = 0;
    expect(shownToAll(silo)).toBe(false);
  });
});

describe('the pool in saves and replays (#753)', () => {
  it('survives a save, and a replay of the same commands plays out the same', () => {
    const play = () => {
      const s = game(); turn(s, 'fission');
      const silo = siloAt(s, 8);
      s.players[0].nukes = { n: 2 };
      const t = empty(s);
      const cmds: Command[] = [{ t: 'launch', p: 0, silo: silo.id, x: t.x, y: t.y, w: 'atomic' }, { t: 'launch', p: 0, silo: silo.id, x: t.x + 1, y: t.y, w: 'fission' }];
      for (const c of JSON.parse(JSON.stringify(cmds)) as Command[]) step(s, [c]);
      return s;
    };
    const a = play(), b = play();
    expect(serialize(a)).toBe(serialize(b));
    const back = deserialize(serialize(a));
    expect(back.players[0].nukes).toEqual(a.players[0].nukes);
    expect(back.launches).toEqual(a.launches);
    run(a, 3); run(back, 3);
    expect(serialize(back)).toBe(serialize(a));
    expect(tc(a, 1).hp).toBe(tc(back, 1).hp);
  });
});
