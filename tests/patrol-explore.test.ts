import { describe, expect, it } from 'vitest';
import { EXPLORE, PATROL } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { createGame, step } from '../src/sim/game';
import { exploreTarget } from '../src/sim/units';
import { spawnUnit } from '../src/sim/world';
import { AIR, NAVAL, walkable } from '../src/sim/grid';
import type { GameState, Order, Unit } from '../src/sim/types';

/** Patrol and explore (#454): the player gives the intent once and the units carry it out. */
const game = (): GameState => createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const order = (u: Unit): Order => u.order as Order;
const run = (s: GameState, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(s);
};
const seenCount = (s: GameState, p: number) => s.players[p].seen.reduce((n, v) => n + (v ? 1 : 0), 0);

/** A cavalryman on open ground near player 0's start, and a point `d` tiles east of it that he can walk to. */
function rider(s: GameState, d = 8): { u: Unit; x: number; y: number } {
  const p = s.players[0];
  let x0 = Math.floor(p.startX) + 4;
  const y0 = Math.floor(p.startY) + 4;
  while (!walkable(s, x0, y0, 0) || !walkable(s, x0 + d, y0, 0)) x0++;
  const u = spawnUnit(s, 0, 'cavalry', x0 + 0.5, y0 + 0.5);
  return { u, x: x0 + d + 0.5, y: y0 + 0.5 };
}

describe('patrol (#454)', () => {
  it('walks to the point and back again, round and round', () => {
    const s = game();
    const { u, x, y } = rider(s);
    const home = u.x;
    applyCommand(s, { t: 'patrol', p: 0, ids: [u.id], x, y });
    expect(order(u).k).toBe('patrol');
    let far = home;
    let backAgain = false;
    for (let i = 0; i < 1200 && !backAgain; i++) {
      step(s);
      far = Math.max(far, u.x);
      if (far > x - 1.5 && u.x < home + 1.5) backAgain = true;
    }
    expect(far).toBeGreaterThan(x - 1.5);
    expect(backAgain).toBe(true);
    expect(order(u).k).toBe('patrol');
  });

  it('Shift-click adds a waypoint to the round, up to the cap', () => {
    const s = game();
    const { u, x, y } = rider(s);
    applyCommand(s, { t: 'patrol', p: 0, ids: [u.id], x, y });
    applyCommand(s, { t: 'patrol', p: 0, ids: [u.id], x, y: y + 3, queue: true });
    const o = order(u);
    expect(o.k === 'patrol' && o.pts.length).toBe(3);
    for (let i = 0; i < 20; i++) applyCommand(s, { t: 'patrol', p: 0, ids: [u.id], x, y: y + 4, queue: true });
    expect(o.k === 'patrol' && o.pts.length).toBe(PATROL.points);
  });

  it('an aggressive soldier falls on a foe that comes by, then takes up the round again', () => {
    const s = game();
    const { u, x, y } = rider(s);
    applyCommand(s, { t: 'patrol', p: 0, ids: [u.id], x, y });
    const foe = spawnUnit(s, 1, 'citizen', x - 2, y);
    let fought = false;
    for (let i = 0; i < 1500 && foe.hp > 0; i++) {
      step(s);
      const o = order(u);
      if (o.k === 'attack' && o.target === foe.id) {
        fought = true;
        expect(o.back?.k).toBe('patrol');
      }
    }
    expect(fought).toBe(true);
    expect(foe.hp).toBeLessThanOrEqual(0);
    run(s, 40);
    expect(order(u).k).toBe('patrol');
  });

  it('ignores a point that is not a number (the room is public)', () => {
    const s = game();
    const { u } = rider(s);
    applyCommand(s, { t: 'patrol', p: 0, ids: [u.id], x: NaN, y: 3 });
    expect(order(u).k).toBe('idle');
  });
});

describe('explore (#454)', () => {
  it('sees far more of the map than a unit left standing', () => {
    const a = game();
    const b = game();
    const ua = rider(a).u;
    rider(b);
    applyCommand(a, { t: 'explore', p: 0, ids: [ua.id] });
    run(a, 1800);
    run(b, 1800);
    expect(seenCount(a, 0)).toBeGreaterThan(seenCount(b, 0) * 1.3);
    expect(order(ua).k).toBe('explore');
  });

  it('heads for ground never seen, and two scouts head for different places', () => {
    const s = game();
    const { u } = rider(s);
    const v = spawnUnit(s, 0, 'cavalry', u.x, u.y);
    applyCommand(s, { t: 'explore', p: 0, ids: [u.id, v.id] });
    run(s, 2);
    const ou = order(u);
    const ov = order(v);
    expect(ou.k === 'explore' && ov.k === 'explore').toBe(true);
    if (ou.k !== 'explore' || ov.k !== 'explore') return;
    expect(s.players[0].seen[ou.y * s.w + ou.x]).toBe(0);
    const dx = ou.x - ov.x;
    const dy = ou.y - ov.y;
    expect(dx * dx + dy * dy).toBeGreaterThanOrEqual(EXPLORE.apart * EXPLORE.apart);
  });

  it('a ship heads for water and an aircraft anywhere', () => {
    const s = createGame({ seed: 3, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    const p = s.players[0];
    const ship = spawnUnit(s, 0, 'warship', p.startX, p.startY);
    const t = exploreTarget(s, ship);
    if (t >= 0) expect(walkable(s, t % s.w, Math.floor(t / s.w), NAVAL)).toBe(true);
    const plane = spawnUnit(s, 0, 'fighter', p.startX, p.startY);
    const tp = exploreTarget(s, plane);
    expect(tp).toBeGreaterThanOrEqual(0);
    expect(walkable(s, tp % s.w, Math.floor(tp / s.w), AIR)).toBe(true);
  });

  it('stops when the whole map has been seen', () => {
    const s = game();
    const { u } = rider(s);
    s.players[0].seen.fill(1);
    applyCommand(s, { t: 'explore', p: 0, ids: [u.id] });
    run(s, 3);
    expect(order(u).k).toBe('idle');
  });
});
