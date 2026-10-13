import { describe, expect, it } from 'vitest';
import { SCENARIOS, progress, scenarioById, starsFor } from '../src/sim/campaign';
import { TICK_HZ } from '../src/sim/data';
import { checksum, createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import type { Building, GameState, Unit } from '../src/sim/types';
import { findSpot } from '../src/sim/ai';
import { placeBuilding, spawnUnit } from '../src/sim/world';

const make = (id: string): GameState => createGame({ ...scenarioById(id)!.setup, scenario: id });
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

describe('campaign', () => {
  it('has a scenario for every epoch, each with a goal that wins', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(6);
    for (const sc of SCENARIOS) {
      expect(sc.objectives.some((o) => !o.bonus)).toBe(true);
      const s = make(sc.id);
      expect(s.scenario?.done.length).toBe(sc.objectives.length);
      expect(s.players.length).toBe(sc.setup.players.length);
    }
  });

  it('completes objectives as they are met and wins when all required ones are done', () => {
    const s = make('first-fires');
    const sc = scenarioById('first-fires')!;
    run(s, 2);
    expect(s.scenario!.done.some(Boolean)).toBe(false);
    const tc0 = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0)!;
    s.players[0].stats.gathered = 9000;
    s.players[0].epoch = 1;
    for (let i = 0; i < 18; i++) spawnUnit(s, 0, 'citizen', tc0.x + 3 + (i % 5) * 0.5, tc0.y + 3 + Math.floor(i / 5) * 0.5);
    for (let i = 0; i < 3; i++) {
      const at = findSpot(s, 'house', tc0.x, tc0.y, 5, 20)!;
      placeBuilding(s, 0, 'house', at.tx, at.ty, true);
    }
    run(s, 2);
    expect(s.over).toBe(true);
    expect(s.scenario!.result).toBe('win');
    expect(s.winner).toBe(0);
    expect(s.scenario!.done.every(Boolean)).toBe(true);
    expect(starsFor(s)).toBeGreaterThanOrEqual(2);
    void sc;
  });

  it('a bonus goal with a deadline is missed when it is late', () => {
    const s = make('first-fires');
    for (let i = 0; i < 13 * 60 * TICK_HZ; i += 600) {
      s.tick = i;
      step(s);
      if (s.over) break;
    }
    s.tick = 13 * 60 * TICK_HZ;
    s.players[0].epoch = 1;
    run(s, 2);
    expect(s.scenario!.done[3]).toBe(true);
    expect(s.scenario!.done[4]).toBe(false);
  });

  it('sends scripted raids and gifts on time', () => {
    const s = make('river-of-kings');
    const food = s.players[0].res.food;
    run(s, 125);
    expect(s.scenario!.gifts).toBe(1);
    expect(s.players[0].res.food).toBeGreaterThan(food + 150);
    const foes = () => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 1 && e.type === 'infantry').length;
    const before = foes();
    run(s, 125);
    expect(s.scenario!.raids).toBe(1);
    expect(foes()).toBeGreaterThanOrEqual(before + 4);
  });

  it('loses when the time limit runs out, or the people fall', () => {
    const s = make('iron-and-gold');
    s.tick = 1500 * TICK_HZ - 20;
    run(s, 3);
    expect(s.over).toBe(true);
    expect(s.scenario!.result).toBe('lose');
    const t = make('the-wall');
    for (const e of t.ents) if (e.owner === 0) e.hp = 0;
    run(t, 2);
    expect(t.scenario!.result).toBe('lose');
  });

  it('saves and replays the same', () => {
    const s = make('river-of-kings');
    run(s, 130);
    const copy = deserialize(serialize(s));
    run(s, 140);
    run(copy, 140);
    expect(checksum(copy)).toBe(checksum(s));
    expect(copy.scenario).toEqual(s.scenario);
    expect(progress(s, scenarioById('river-of-kings')!.objectives[3])[0]).toBeGreaterThan(200);
  });
});
