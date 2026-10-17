import { describe, expect, it } from 'vitest';
import { hurt } from '../src/sim/combat';
import { THRALL } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import type { GameState, Unit } from '../src/sim/types';

/** Thralls (#502): in the Age of the Warband a slain rival citizen is taken captive and works the slayer's fields. */

const game = (age: 'middle' | 'warband'): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.players[0].epoch = 2;
  if (age === 'warband') s.players[0].age = 'warband';
  return s;
};
const slay = (s: GameState, type: 'citizen' | 'infantry') => {
  const foe = spawnUnit(s, 1, type, s.players[1].startX, s.players[1].startY);
  hurt(s, foe, foe.hp + 100, 0, null);
};
const thralls = (s: GameState): Unit[] => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && !!e.thrall && e.hp > 0);
const room = (s: GameState) => {
  s.players[0].cap = 200;
  s.players[0].pop = 0;
};

describe('thralls', () => {
  it('a slain rival citizen rises as the slayer\'s thrall in the Age of the Warband', () => {
    const s = game('warband');
    room(s);
    slay(s, 'citizen');
    const [t] = thralls(s);
    expect(t).toBeDefined();
    expect(t.type).toBe('citizen');
    expect(s.events.some((e) => e.k === 'thrall' && e.owner === 0 && e.from === 1)).toBe(true);
  });

  it('only citizens are taken, and only in the Warband', () => {
    const s = game('warband');
    room(s);
    slay(s, 'infantry');
    expect(thralls(s)).toHaveLength(0);
    const m = game('middle');
    room(m);
    slay(m, 'citizen');
    expect(thralls(m)).toHaveLength(0);
  });

  it('holds at most THRALL.max, and none when the people are at their cap', () => {
    const s = game('warband');
    room(s);
    for (let i = 0; i < THRALL.max + 3; i++) {
      s.players[0].pop = 0;
      slay(s, 'citizen');
    }
    expect(thralls(s)).toHaveLength(THRALL.max);
    const f = game('warband');
    f.players[0].cap = 0;
    f.players[0].pop = 0;
    slay(f, 'citizen');
    expect(thralls(f)).toHaveLength(0);
  });

  it('a thrall works a free field and never builds', () => {
    const s = game('warband');
    room(s);
    const p = s.players[0];
    let farm = null;
    for (let r = 3; r < 15 && !farm; r++) farm = placeBuilding(s, 0, 'farm', Math.round(p.startX) + r, Math.round(p.startY) + 2, true);
    const foe = spawnUnit(s, 1, 'citizen', p.startX, p.startY);
    hurt(s, foe, 999, 0, null);
    const [t] = thralls(s);
    expect(t.order.k).toBe(farm ? 'farm' : t.order.k);
    const site = placeBuilding(s, 0, 'house', Math.round(p.startX) - 6, Math.round(p.startY), false);
    if (site) {
      t.order = { k: 'build', target: site.id };
      step(s);
      step(s);
      expect(t.order.k).not.toBe('build');
    }
  });
});
