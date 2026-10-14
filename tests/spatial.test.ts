import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { CELL, Spatial } from '../src/sim/spatial';
import type { GameState, Unit } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

const game = (): GameState =>
  createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'greeks' }] });

const near = (sp: Spatial, x: number, y: number, r: number): Unit[] => {
  const out: Unit[] = [];
  sp.near(x, y, r, (u) => out.push(u));
  return out;
};

describe('the spatial grid', () => {
  it('finds every living unit within reach, each once, in id order per bucket', () => {
    const s = game();
    s.ents = s.ents.filter((e) => e.kind !== 'unit');
    const x = 20.5;
    const y = 20.5;
    const us = [spawnUnit(s, 0, 'citizen', x, y), spawnUnit(s, 1, 'citizen', x + 1, y), spawnUnit(s, 0, 'citizen', x + 2.5, y + 0.5)];
    const far = spawnUnit(s, 1, 'citizen', x + 30, y + 30);
    const sp = new Spatial();
    sp.rebuild(s);
    const found = near(sp, x, y, 3);
    for (const u of us) expect(found.filter((f) => f === u)).toHaveLength(1);
    expect(found).not.toContain(far);
    const sameBucket = found.filter((u) => Math.floor(u.x / CELL) === Math.floor(x / CELL) && Math.floor(u.y / CELL) === Math.floor(y / CELL));
    expect(sameBucket.map((u) => u.id)).toEqual([...sameBucket.map((u) => u.id)].sort((a, b) => a - b));
    // Every unit the whole map holds turns up when asked about the whole map, once.
    const all = near(sp, s.w / 2, s.h / 2, s.w + s.h);
    expect(all.map((u) => u.id).sort((a, b) => a - b)).toEqual([...us, far].map((u) => u.id));
  });

  it('leaves out the dead and those sheltering inside', () => {
    const s = game();
    s.ents = s.ents.filter((e) => e.kind !== 'unit');
    const alive = spawnUnit(s, 0, 'citizen', 10.5, 10.5);
    const dead = spawnUnit(s, 0, 'citizen', 10.5, 11.5);
    dead.hp = 0;
    const sheltered = spawnUnit(s, 0, 'citizen', 11.5, 10.5);
    sheltered.inside = 1;
    const sp = new Spatial();
    sp.rebuild(s);
    expect(near(sp, 10.5, 10.5, 3)).toEqual([alive]);
  });

  it('keeps answering after units move and the grid is rebuilt', () => {
    const s = game();
    s.ents = s.ents.filter((e) => e.kind !== 'unit');
    const u = spawnUnit(s, 0, 'citizen', 5.5, 5.5);
    const sp = new Spatial();
    sp.rebuild(s);
    expect(near(sp, 5.5, 5.5, 1)).toEqual([u]);
    u.x = s.w - 1.5;
    u.y = s.h - 1.5;
    sp.rebuild(s);
    expect(near(sp, 5.5, 5.5, 1)).toEqual([]);
    expect(near(sp, s.w - 1.5, s.h - 1.5, 1)).toEqual([u]);
    // Asking about somewhere wholly off the map finds no one.
    expect(near(sp, s.w + 50, s.h + 50, 2)).toEqual([]);
    expect(near(sp, -50, -50, 2)).toEqual([]);
  });
});
