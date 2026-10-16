import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { WAYS, WAY_IDS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { modsOf } from '../src/sim/stats';
import { wayFor, wayProblem } from '../src/sim/ways';
import type { GameState } from '../src/sim/types';

function game(ai: 'hard' | null = null): GameState {
  return createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai, civ: 'egyptians' }, { name: 'B', ai: null }] });
}

describe('Ways (#336)', () => {
  it('each Way changes the people it is taken by and nobody else', () => {
    for (const way of WAY_IDS) {
      const s = game();
      const before = { ...modsOf(s, 0) };
      const other = { ...modsOf(s, 1) };
      applyCommand(s, { t: 'way', p: 0, way });
      expect(s.players[0].way).toBe(way);
      expect(s.events.some((e) => e.k === 'way' && e.way === way)).toBe(true);
      const m = modsOf(s, 0);
      expect((Object.keys(before) as (keyof typeof before)[]).filter((k) => before[k] !== m[k]).length, way).toBeGreaterThan(1);
      expect(modsOf(s, 1)).toEqual(other);
      expect(WAYS[way].blurb.length).toBeGreaterThan(30);
    }
  });

  it('the Hunters hunt better and berry worse; the Hearth the other way round', () => {
    const base = modsOf(game(), 0);
    const h = game();
    applyCommand(h, { t: 'way', p: 0, way: 'hunt' });
    expect(modsOf(h, 0).hunt).toBeGreaterThan(base.hunt);
    expect(modsOf(h, 0).forage).toBeLessThan(base.forage);
    expect(modsOf(h, 0).beastWard).toBeLessThan(base.beastWard);
    const f = game();
    applyCommand(f, { t: 'way', p: 0, way: 'hearth' });
    expect(modsOf(f, 0).forage).toBeGreaterThan(base.forage);
    expect(modsOf(f, 0).hunt).toBeLessThan(base.hunt);
    expect(modsOf(f, 0).beastWard).toBeGreaterThan(base.beastWard);
  });

  it('is taken once, and only in the Stone Age', () => {
    const s = game();
    applyCommand(s, { t: 'way', p: 0, way: 'hunt' });
    applyCommand(s, { t: 'way', p: 0, way: 'warband' });
    expect(s.players[0].way).toBe('hunt');
    expect(wayProblem(s, s.players[0], 'hearth')).toMatch(/already live/);
    const late = game();
    late.players[0].epoch = 1;
    late.players[0].statsVersion++;
    applyCommand(late, { t: 'way', p: 0, way: 'hunt' });
    expect(late.players[0].way).toBeUndefined();
    expect(late.events.some((e) => e.k === 'refused')).toBe(true);
  });

  it('the Way stays after the people climb out of the Stone Age', () => {
    const s = game();
    applyCommand(s, { t: 'way', p: 0, way: 'warband' });
    s.players[0].epoch = 1;
    s.players[0].statsVersion++;
    expect(modsOf(s, 0).militaryTrain).toBeLessThan(1);
  });

  it('a clever computer takes one after its first moments, and an easy one does not', () => {
    const s = game('hard');
    for (let i = 0; i < secs(20); i++) step(s);
    expect(s.players[0].way).toBeUndefined();
    for (let i = 0; i < secs(30); i++) step(s);
    expect(s.players[0].way).toBeDefined();
    const e = createGame({ seed: 5, size: 'small', players: [{ name: 'A', ai: 'easy', civ: 'egyptians' }, { name: 'B', ai: null }] });
    for (let i = 0; i < secs(60); i++) step(e);
    expect(e.players[0].way).toBeUndefined();
  });

  it('the computer picks by the land: more deer than berries near home means the Hunters', () => {
    const s = game();
    const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    s.animals = s.animals.filter((a) => (a.x - tc.x) ** 2 + (a.y - tc.y) ** 2 > 400);
    for (let i = 0; i < 12; i++) s.animals.push({ ...(s.animals[0] ?? ({} as never)), id: 9000 + i, kind: 'deer', x: tc.x + 4 + (i % 4), y: tc.y + 4 + Math.floor(i / 4), hp: 8 } as never);
    expect(wayFor(s, s.players[0])).toBe('hunt');
  });
});
