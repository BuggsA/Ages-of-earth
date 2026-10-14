import { describe, expect, it } from 'vitest';
import { progress, scenarioById } from '../src/sim/campaign';
import { TICK_HZ } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { Building, GameState } from '../src/sim/types';

const make = (id: string): GameState => createGame({ ...scenarioById(id)!.setup, scenario: id });
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ && !s.over; i++) step(s);
};
const townCenters = (s: GameState, owner: number) => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter');

describe('campaign goals: burning a Town Center', () => {
  it('counts a rival once its Town Center has burned, even if it raises another', () => {
    const s = make('wings');
    const sc = scenarioById('wings')!;
    const goal = sc.objectives.find((o) => o.kind === 'destroy')!;
    run(s, 2);
    expect(progress(s, goal)).toEqual([0, 2]);
    for (const tc of townCenters(s, 1)) tc.hp = 0;
    run(s, 2);
    expect(s.scenario!.burned).toEqual([1]);
    expect(progress(s, goal)).toEqual([1, 2]);
    // A new Town Center for the Tsar doesn't undo it.
    const old = townCenters(s, 2)[0];
    const copy: Building = { ...old, id: 99999, owner: 1, garrison: [], queue: [] };
    s.ents.push(copy);
    s.byId.set(copy.id, copy);
    expect(progress(s, goal)).toEqual([1, 2]);
  });

  it('wins the chapter when every rival Town Center has burned', () => {
    const s = make('iron-and-gold');
    run(s, 2);
    const sc = scenarioById('iron-and-gold')!;
    s.players[0].stats.kills = 50;
    for (const tc of townCenters(s, 1)) tc.hp = 0;
    run(s, 3);
    const destroy = sc.objectives.findIndex((o) => o.kind === 'destroy');
    expect(s.scenario!.done[destroy]).toBe(true);
  });

  it('ticks the goals met when a conquest ends the chapter', () => {
    const s = make('iron-and-gold');
    run(s, 2);
    for (const e of s.ents) if (e.owner === 1) e.hp = 0;
    run(s, 3);
    expect(s.over).toBe(true);
    expect(s.scenario!.result).toBe('win');
    const destroy = scenarioById('iron-and-gold')!.objectives.findIndex((o) => o.kind === 'destroy');
    expect(s.scenario!.done[destroy]).toBe(true);
  });
});
