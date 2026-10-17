import { describe, expect, it } from 'vitest';
import { hurt } from '../src/sim/combat';
import { BUILDINGS, HEART, TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { Building, GameState } from '../src/sim/types';
import { placeBuilding } from '../src/sim/world';

const game = (): GameState => createGame({ seed: 4, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
const centers = (s: GameState, o: number) => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === o && e.type === 'towncenter');
const run = (s: GameState, secs: number) => { for (let i = 0; i < TICK_HZ * secs && !s.over; i++) step(s); };

describe('the heart (#452)', () => {
  it('a people with citizens but no Town Center is lost once the grace runs out', () => {
    const s = game();
    for (const tc of centers(s, 1)) tc.hp = 0;
    run(s, 2);
    expect(s.players[1].defeated).toBe(false);
    expect(s.players[1].heartless).toBeDefined();
    run(s, HEART.grace + 2);
    expect(s.players[1].defeated).toBe(true);
    expect(s.winner).toBe(0);
  });

  it('a new foundation laid within the grace saves them, and the clock resets', () => {
    const s = game();
    const old = centers(s, 1)[0];
    for (const tc of centers(s, 1)) tc.hp = 0;
    run(s, 5);
    expect(s.players[1].heartless).toBeDefined();
    const at = { x: old.x, y: old.y };
    run(s, 1);
    placeBuilding(s, 1, 'towncenter', Math.round(at.x - 2), Math.round(at.y - 2), false);
    run(s, HEART.grace + 5);
    expect(s.players[1].defeated).toBe(false);
    expect(s.players[1].heartless).toBeUndefined();
  });

  it('a second Town Center keeps a people standing when the first falls', () => {
    const s = game();
    const first = centers(s, 1)[0];
    placeBuilding(s, 1, 'towncenter', Math.round(first.x - 2) + 8, Math.round(first.y - 2) + 8, true);
    first.hp = 0;
    run(s, HEART.grace + 5);
    expect(s.players[1].defeated).toBe(false);
  });

  it('striking a Town Center raises its own alert, even just after another alert', () => {
    const s = game();
    const tc = centers(s, 1)[0];
    s.players[1].alert = s.tick;
    hurt(s, tc, 10, 0, null);
    expect(s.events.some((e) => e.k === 'alert' && e.owner === 1 && e.heart)).toBe(true);
    s.events.length = 0;
    hurt(s, tc, 10, 0, null);
    expect(s.events.some((e) => e.k === 'alert')).toBe(false);
  });

  it('the Town Center is sturdier than before', () => {
    expect(BUILDINGS.towncenter.hp).toBe(2800);
  });
});
