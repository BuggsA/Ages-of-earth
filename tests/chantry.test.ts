import { describe, expect, it } from 'vitest';
import { CHANTRY, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { chantShare } from '../src/sim/consecrate';
import { canRaise } from '../src/sim/ages';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';
import type { Building, GameState } from '../src/sim/types';

/** The Pilgrims' Wayside Chantry (#727): priests by it sing louder and are mended; it sleeps outside the age; only priests raise it. */

const run = (s: GameState, seconds: number) => { for (let i = 0; i < secs(seconds); i++) step(s); };

function setup(dist = 2) {
  const s = createGame({ seed: 7, size: 'small', players: [{ name: 'A', ai: null, civ: 'greeks' }, { name: 'B', ai: null, civ: 'romans' }] });
  s.peaceUntil = 1e9;
  for (const p of s.players) restat(s, p, () => { p.epoch = 2; });
  restat(s, s.players[0], () => { s.players[0].age = 'pilgrim'; });
  const home = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
  const chantry = placeBuilding(s, 0, 'chantry', Math.floor(home.x) + 8, Math.floor(home.y), true);
  chantry.built = true;
  const tower = placeBuilding(s, 1, 'tower', Math.floor(home.x) + 14, Math.floor(home.y), true) as Building;
  const priest = spawnUnit(s, 0, 'priest', chantry.x + dist, chantry.y);
  priest.hp = 10;
  return { s, home, chantry, tower, priest };
}

describe('the Wayside Chantry (#727)', () => {
  it('mends a priest standing by it', () => {
    const { s, priest } = setup();
    run(s, 5);
    expect(priest.hp).toBeGreaterThanOrEqual(10 + CHANTRY.mend * 4);
  });
  it('mends nothing out of reach', () => {
    const { s, priest } = setup(CHANTRY.reach + 2);
    run(s, 5);
    expect(priest.hp).toBe(10);
  });
  it('makes a priest\'s chant louder by `voice`, only within reach', () => {
    const { s, tower, priest } = setup();
    const far = spawnUnit(s, 0, 'priest', priest.x + CHANTRY.reach + 4, priest.y);
    expect(chantShare(s, priest, tower)).toBeCloseTo(chantShare(s, far, tower) * (1 + CHANTRY.voice), 8);
  });
  it('sleeps when the people leaves the age', () => {
    const { s, tower, priest } = setup();
    const loud = chantShare(s, priest, tower);
    restat(s, s.players[0], () => { s.players[0].age = 'bronze'; s.players[0].epoch = 1; });
    const hp = priest.hp;
    run(s, 5);
    expect(priest.hp).toBe(hp);
    expect(chantShare(s, priest, tower)).toBeLessThan(loud);
  });
  it('is silenced when it is destroyed', () => {
    const { s, chantry, priest } = setup();
    chantry.hp = 0;
    run(s, 3);
    expect(priest.hp).toBe(10);
  });
  it('is raised by priests alone', () => {
    expect(canRaise('priest', 'chantry', 'greeks')).toBe(true);
    expect(canRaise('citizen', 'chantry', 'greeks')).toBe(false);
  });
});
