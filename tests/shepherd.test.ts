import { describe, expect, it } from 'vitest';
import { FLOCK, SHEPHERD, secs } from '../src/sim/data';
import { addSheep, flockCap, flockOf } from '../src/sim/flocks';
import { createGame, step } from '../src/sim/game';
import { restat } from '../src/sim/world';
import type { Building, GameState, Unit } from '../src/sim/types';

/** The self-managed flock: a person's herding people keeps its sheep without a click. */

const game = () => createGame({ seed: 11, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });
const tc = (s: GameState) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };
const steppe = (s: GameState) => { s.players[0].shepherd = true; s.animals = []; restat(s, s.players[0], () => { s.players[0].age = 'steppe'; s.players[0].epoch = 1; }); };
const mine = (s: GameState) => s.animals.filter((a) => a.kind === 'sheep' && a.owner === 0);

describe('the self-managed flock', () => {
  it('raises lambs on its own while food is spare, and keeps a reserve', () => {
    const s = game(); steppe(s);
    s.players[0].res.food = FLOCK.cost.food! + SHEPHERD.reserve - 1;
    run(s, SHEPHERD.every + 1);
    expect(mine(s).length).toBe(0);
    s.players[0].res.food = 5000;
    run(s, 20);
    expect(flockOf(s, 0)).toBeGreaterThan(1);
    run(s, 400);
    expect(flockOf(s, 0)).toBeLessThanOrEqual(flockCap(s, 0));
  });

  it('puts idle citizens by the camp to milk, a ewe each', () => {
    const s = game(); steppe(s); s.players[0].res.food = 0;
    const t = tc(s);
    for (let i = 0; i < 2; i++) addSheep(s, 0, t.x + 3 + i, t.y + 4, false).milk = 10;
    const units = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen');
    for (const u of units) { u.x = t.x + 2; u.y = t.y + 3; }
    run(s, SHEPHERD.every + 1);
    const milkers = units.filter((u) => u.order.k === 'milk');
    expect(milkers.length).toBeGreaterThanOrEqual(1);
    const targets = milkers.map((u) => (u.order.k === 'milk' ? u.order.target : -1));
    expect(new Set(targets).size).toBe(Math.min(targets.length, 2));
  });

  it('slaughters a sheep fattened past breeding once the flock is full', () => {
    const s = game(); steppe(s); s.players[0].res.food = 0;
    const t = tc(s);
    for (let i = 0; i < flockCap(s, 0); i++) addSheep(s, 0, t.x + 3, t.y + 4, false);
    mine(s)[0].fat = FLOCK.breed;
    for (const a of mine(s)) a.milk = 0;
    for (const e of s.ents) if (e.kind === 'unit' && e.owner === 0) e.order = { k: 'idle' };
    run(s, SHEPHERD.every + 1);
    const fat = mine(s)[0];
    const butchers = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.order.k === 'hunt' && e.order.target === fat.id);
    expect(butchers.length).toBe(1);
  });

  it('can be turned off: the flock is left alone', () => {
    const s = game(); steppe(s);
    s.players[0].res.food = 5000;
    step(s, [{ t: 'shepherd', p: 0, on: false }]);
    expect(s.players[0].shepherd).toBeUndefined();
    run(s, 30);
    expect(mine(s).length).toBe(0);
    step(s, [{ t: 'shepherd', p: 0, on: true }]);
    run(s, 10);
    expect(mine(s).length).toBeGreaterThan(0);
  });
});
