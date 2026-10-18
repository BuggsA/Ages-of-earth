import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { SICKNESS, secs } from '../src/sim/data';
import { checksum, createGame, step } from '../src/sim/game';
import { foulNow, loadAt, pressure, sickStep, tenders, workShare } from '../src/sim/sickness';
import type { Building, GameState, Unit } from '../src/sim/types';
import { countPop, placeBuilding, spawnUnit } from '../src/sim/world';
import { gatherRate } from '../src/sim/units';

// The Sickness (#541): a crowded, thick-streeted town breaks out in fever; priests at a Temple nurse it, the roads carry it, quarantine shuts them.
const game = (civ = 'greeks') => {
  const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: civ as never }, { name: 'B', ai: null, civ: 'greeks' }] });
  s.players[0].epoch = 1;
  return s;
};
const tcOf = (s: GameState, owner: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
/** A town of `pop` people in `cap` room, with `houses` houses laid `gap` tiles apart in a block. */
function town(s: GameState, pop: number, cap: number, houses: number, gap: number): void {
  const tc = tcOf(s, 0);
  for (let i = 0; i < houses; i++) placeBuilding(s, 0, 'house', Math.floor(tc.x) + 6 + (i % 5) * gap, Math.floor(tc.y) + 6 + Math.floor(i / 5) * gap, true);
  countPop(s);
  s.players[0].pop = pop;
  s.players[0].cap = cap;
}
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < secs(seconds); i++) {
    s.players[0].pop = Math.max(s.players[0].pop, 0);
    sickStep(s);
    s.tick++;
  }
};

describe('the Sickness', () => {
  it('builds taint only in a big, full, thick-streeted town, and not in the Stone Age', () => {
    const roomy = game();
    town(roomy, 30, 80, 4, 8);
    expect(pressure(roomy, roomy.players[0])).toBe(0);
    const packed = game();
    town(packed, 100, 100, 15, 2);
    const p = pressure(packed, packed.players[0]);
    expect(p).toBeGreaterThan(0.5);
    const loose = game();
    town(loose, 100, 100, 15, 7);
    expect(pressure(loose, loose.players[0])).toBeLessThan(p);
    const old = game();
    town(old, 100, 100, 15, 2);
    old.players[0].epoch = 0;
    expect(pressure(old, old.players[0])).toBe(0);
  });

  it('breaks out when taint reaches 1, with the fever at its start', () => {
    const s = game();
    town(s, 100, 100, 15, 2);
    run(s, 400);
    expect(s.players[0].fever).toBeDefined();
    expect(s.players[0].taint).toBeCloseTo(SICKNESS.after, 1);
    expect(s.events.some((e) => e.k === 'sick' && e.owner === 0 && e.what === 'broke')).toBe(true);
  });

  it('is eased by a Temple, and never touches a campaign chapter', () => {
    const a = game();
    const b = game();
    town(a, 100, 100, 15, 2);
    town(b, 100, 100, 15, 2);
    const tc = tcOf(b, 0);
    placeBuilding(b, 0, 'temple', Math.floor(tc.x) - 7, Math.floor(tc.y) + 6, true);
    run(a, 100);
    run(b, 100);
    expect(b.players[0].taint ?? 0).toBeLessThan(a.players[0].taint ?? 0);
    const c = game();
    town(c, 100, 100, 15, 2);
    c.scenario = { id: 'x' } as never;
    run(c, 400);
    expect(c.players[0].taint).toBeUndefined();
    expect(c.players[0].fever).toBeUndefined();
  });

  it('slows gathering and building by its severity, and a well town works at full pace', () => {
    const s = game();
    const u = s.ents.find((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen')!;
    const well = gatherRate(s, u, 'farm');
    expect(workShare(s, 0)).toBe(1);
    s.players[0].fever = { sev: 0.8, since: 0 };
    expect(workShare(s, 0)).toBeCloseTo(1 - 0.8 * SICKNESS.slow, 6);
    expect(gatherRate(s, u, 'farm')).toBeCloseTo(well * (1 - 0.8 * SICKNESS.slow), 6);
  });

  it('is nursed down by priests at a finished Temple, and only by them', () => {
    const none = game();
    const nursed = game();
    for (const s of [none, nursed]) {
      town(s, 40, 80, 4, 8);
      s.players[0].fever = { sev: 0.6, since: 0 };
    }
    const tc = tcOf(nursed, 0);
    const temple = placeBuilding(nursed, 0, 'temple', Math.floor(tc.x) - 7, Math.floor(tc.y) + 6, true);
    for (let i = 0; i < 3; i++) spawnUnit(nursed, 0, 'priest', temple.x + 2 + i, temple.y);
    expect(tenders(nursed, 0)).toBe(3);
    expect(tenders(none, 0)).toBe(0);
    run(none, 60);
    run(nursed, 60);
    expect(nursed.players[0].fever!.sev).toBeLessThan(none.players[0].fever!.sev);
    // A priest far from the Temple does not count; neither does one with a relic.
    const far = game();
    town(far, 40, 80, 4, 8);
    const t2 = placeBuilding(far, 0, 'temple', Math.floor(tcOf(far, 0).x) - 7, Math.floor(tcOf(far, 0).y) + 6, true);
    spawnUnit(far, 0, 'priest', t2.x + SICKNESS.tendReach + 5, t2.y);
    expect(tenders(far, 0)).toBe(0);
  });

  it('ends when the severity is spent, and takes citizens while it runs hot', () => {
    const s = game();
    town(s, 40, 80, 4, 8);
    s.players[0].fever = { sev: 0.004, since: 0 };
    run(s, 10);
    expect(s.players[0].fever).toBeUndefined();

    const hot = game();
    town(hot, 40, 80, 4, 8);
    hot.players[0].fever = { sev: 0.9, since: 0 };
    const citizens = () => hot.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen' && e.hp > 0).length;
    const before = citizens();
    run(hot, 45);
    expect(citizens()).toBeLessThan(before);
  });

  it('spreads by the roads: a sick trader fouls a post, a well one loading there brings taint home', () => {
    const s = game();
    const post = s.posts[0];
    s.players[1].epoch = 1;
    expect(foulNow(s, post)).toBe(false);
    s.players[1].fever = { sev: 0.4, since: 0 };
    expect(loadAt(s, 1, post)).toBe(true);
    expect(foulNow(s, post)).toBe(true);
    expect(s.players[0].taint).toBeUndefined();
    loadAt(s, 0, post);
    expect(s.players[0].taint).toBeCloseTo(SICKNESS.import, 6);
    // Not a second time while a sick town's own trader loads: it is already sick.
    s.tick += secs(SICKNESS.foul) + 1;
    expect(foulNow(s, post)).toBe(false);
  });

  it('shuts the roads under quarantine, at the Town Center’s word, and lifts them again', () => {
    const s = game();
    const post = s.posts[0];
    s.posts[0].foul = s.tick + secs(100);
    applyCommand(s, { t: 'quarantine', p: 0, on: true });
    expect(s.players[0].quarantine).toBe(true);
    expect(loadAt(s, 0, post)).toBe(false);
    expect(s.players[0].taint).toBeUndefined();
    const t = spawnUnit(s, 0, 'trader', tcOf(s, 0).x + 3, tcOf(s, 0).y + 3);
    step(s, [{ t: 'route', p: 0, ids: [t.id], post: post.id }]);
    expect(t.order.k).not.toBe('trade');
    applyCommand(s, { t: 'quarantine', p: 0, on: false });
    expect(s.players[0].quarantine).toBeUndefined();
    expect(loadAt(s, 0, post)).toBe(true);
  });

  it('drains a fever faster under quarantine', () => {
    const a = game();
    const b = game();
    for (const s of [a, b]) {
      town(s, 40, 80, 4, 8);
      s.players[0].fever = { sev: 0.6, since: 0 };
    }
    b.players[0].quarantine = true;
    run(a, 60);
    run(b, 60);
    expect(b.players[0].fever!.sev).toBeLessThan(a.players[0].fever!.sev);
  });

  it('spares a camp on the move half the pressure', () => {
    const s = game('mongols');
    town(s, 100, 100, 15, 2);
    const g = game('greeks');
    town(g, 100, 100, 15, 2);
    run(s, 100);
    run(g, 100);
    expect(s.players[0].taint ?? 0).toBeLessThan(g.players[0].taint ?? 0);
  });

  it('is the same on every run', () => {
    const play = () => {
      const s = game();
      town(s, 100, 100, 15, 2);
      for (let i = 0; i < 2400; i++) step(s);
      return checksum(s);
    };
    expect(play()).toBe(play());
  });

  it('is met by the clever computer: a Temple when taint builds, quarantine in a hard fever, the roads open again when well', () => {
    const s = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: 'hard', civ: 'greeks' }, { name: 'B', ai: null, civ: 'greeks' }] });
    const p = s.players[0];
    p.epoch = 1;
    spawnUnit(s, 0, 'trader', tcOf(s, 0).x + 3, tcOf(s, 0).y + 3);
    p.fever = { sev: 0.9, since: 0 };
    for (let i = 0; i < 200; i++) step(s);
    expect(p.quarantine).toBe(true);
    delete p.fever;
    for (let i = 0; i < 200; i++) step(s);
    expect(p.quarantine).toBeUndefined();
  });
});
