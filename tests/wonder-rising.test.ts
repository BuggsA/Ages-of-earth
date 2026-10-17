import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { createGame, step } from '../src/sim/game';
import type { Building, GameState, Unit } from '../src/sim/types';

// #361: a Wonder's whole build is contestable, so every player hears when its foundation is laid.
const game = (): GameState =>
  createGame({
    seed: 7,
    size: 'small',
    startEpoch: 1,
    players: [
      { name: 'A', ai: null, civ: 'romans' },
      { name: 'B', ai: null, civ: 'romans' },
    ],
  });
const citizens = (s: GameState, p: number) => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === p && e.type === 'citizen');
const spot = (s: GameState, type: Building['type']) => findSpot(s, type, s.players[0].startX, s.players[0].startY, 6, 20)!;

describe('a wonder rising (#361)', () => {
  it('laying a Wonder foundation tells everyone where it stands', () => {
    const s = game();
    s.players[0].res = { food: 0, wood: 3000, stone: 3000, gold: 3000 };
    const at = spot(s, 'wonder');
    step(s, [{ t: 'build', p: 0, ids: citizens(s, 0).slice(0, 2).map((u) => u.id), type: 'wonder', tx: at.tx, ty: at.ty }]);
    const ev = s.events.find((e) => e.k === 'wonderRising');
    expect(ev).toBeDefined();
    const w = s.ents.find((e): e is Building => e.kind === 'building' && e.type === 'wonder')!;
    expect(w.built).toBe(false);
    expect(ev).toMatchObject({ owner: 0, id: w.id, x: w.x, y: w.y });
    // It is said once, not every tick of the build.
    step(s);
    expect(s.events.some((e) => e.k === 'wonderRising')).toBe(false);
  });

  it('other buildings and refused Wonders say nothing', () => {
    const s = game();
    s.players[0].res = { food: 0, wood: 3000, stone: 0, gold: 0 };
    const ids = citizens(s, 0).slice(0, 2).map((u) => u.id);
    const w = spot(s, 'wonder');
    step(s, [{ t: 'build', p: 0, ids, type: 'wonder', tx: w.tx, ty: w.ty }]);
    expect(s.events.some((e) => e.k === 'refused')).toBe(true);
    expect(s.events.some((e) => e.k === 'wonderRising')).toBe(false);
    const b = spot(s, 'barracks');
    step(s, [{ t: 'build', p: 0, ids, type: 'barracks', tx: b.tx, ty: b.ty }]);
    expect(s.events.some((e) => e.k === 'placed')).toBe(true);
    expect(s.events.some((e) => e.k === 'wonderRising')).toBe(false);
  });
});
