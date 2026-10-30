import { describe, expect, it } from 'vitest';
import { INTERCEPT, SILO, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { ringOf, setReserve } from '../src/sim/silo';
import { placeBuilding } from '../src/sim/world';
import type { Building, GameEvent, GameState, Launch } from '../src/sim/types';

/** Why nothing rose (the owner, 2026-10-30): a people that stood guard is told what kept its guard down when a warhead flies on unanswered. */

const game = () => {
  const s = createGame({ seed: 5, size: 'small', startEpoch: 5, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
  for (const p of s.players) p.res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
  return s;
};
const tc = (s: GameState, o: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === o && e.type === 'towncenter')!;
const until = (s: GameState, tick: number) => { while (s.tick < tick) step(s); };
const silo = (s: GameState, o: number, dx: number): Building => {
  const p = s.players[o];
  const b = placeBuilding(s, o, 'silo', p.startX + dx, p.startY + 8, true);
  step(s);
  p.nukes = { n: SILO.cap };
  return b;
};
const battery = (s: GameState, o: number, x: number, y: number): Building => placeBuilding(s, o, 'battery', x - 1, y - 1, true);
const fireAt = (s: GameState, from: Building, x: number, y: number): Launch => {
  step(s, [{ t: 'launch', p: 0, silo: from.id, x, y }]);
  return s.launches![s.launches!.length - 1];
};
const told = (s: GameState) => s.events.filter((e): e is Extract<GameEvent, { k: 'unguarded' }> => e.k === 'unguarded');
/** Steps to the moment the batteries would fire, and returns what that step told. */
const atFire = (s: GameState, l: Launch) => {
  until(s, l.at - secs(INTERCEPT.fire));
  step(s);
  return told(s);
};

describe('why no interceptor rose', () => {
  it('a battery too far from the ring says how far it stood, against its cover', () => {
    const s = game();
    const from = silo(s, 0, 8);
    const t = tc(s, 1);
    const l = fireAt(s, from, t.x, t.y);
    const g = ringOf(l, s.players[1].team, 0);
    battery(s, 1, Math.round(g.x) + INTERCEPT.reach + 6, Math.round(g.y));
    const e = atFire(s, l);
    expect(e).toHaveLength(1);
    expect(e[0].owner).toBe(1);
    expect(e[0].by).toBe(0);
    expect(e[0].bat?.why).toBe('reach');
    if (e[0].bat?.why === 'reach') {
      expect(e[0].bat.d).toBeGreaterThan(INTERCEPT.reach);
      expect(e[0].bat.reach).toBe(INTERCEPT.reach);
    }
    expect(e[0].res).toBeUndefined();
  });

  it('a battery in reach but spent says when it is ready', () => {
    const s = game();
    const from = silo(s, 0, 8);
    const t = tc(s, 1);
    const l = fireAt(s, from, t.x, t.y);
    const g = ringOf(l, s.players[1].team, 0);
    const b = battery(s, 1, Math.round(g.x) + 3, Math.round(g.y));
    b.reload = l.at + secs(30);
    const e = atFire(s, l);
    expect(e).toHaveLength(1);
    expect(e[0].bat).toEqual({ why: 'reload', wait: 30 + INTERCEPT.fire });
  });

  it('a silo held in Reserve that is still arming says so', () => {
    const s = game();
    const from = silo(s, 0, 8);
    const guard = silo(s, 1, 8);
    const t = tc(s, 1);
    const l = fireAt(s, from, t.x, t.y);
    until(s, l.at - secs(INTERCEPT.fire) - secs(INTERCEPT.arm) + secs(5));
    setReserve(s, guard, true);
    const e = atFire(s, l);
    expect(e).toHaveLength(1);
    expect(e[0].bat).toBeUndefined();
    expect(e[0].res?.why).toBe('arming');
  });

  it('a people with no guard is told nothing, and an answered warhead tells no one', () => {
    const s = game();
    const from = silo(s, 0, 8);
    const t = tc(s, 1);
    const l = fireAt(s, from, t.x, t.y);
    expect(atFire(s, l)).toHaveLength(0);
    const s2 = game();
    const from2 = silo(s2, 0, 8);
    const l2 = fireAt(s2, from2, tc(s2, 1).x, tc(s2, 1).y);
    const g = ringOf(l2, s2.players[1].team, 0);
    battery(s2, 1, Math.round(g.x) + 3, Math.round(g.y));
    expect(atFire(s2, l2)).toHaveLength(0);
    expect(s2.events.some((ev) => ev.k === 'intercept' && ev.what === 'fired')).toBe(true);
  });
});
