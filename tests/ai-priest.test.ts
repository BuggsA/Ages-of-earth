import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { Building, GameState, Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/**
 * The computer's priests between jobs: an idle priest takes up healing by itself within a few ticks of seeing anyone hurt, so the
 * computer must count a healing priest as free, or in any fight it never fetches a relic or turns an enemy.
 */

const tc = (s: GameState, owner = 0) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;

/** A hard computer in the Middle Ages with one priest beside a citizen it is mending, which stays hurt so the healing never ends. */
const setup = () => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: 'hard', civ: 'romans' }, { name: 'B', ai: null }] });
  s.rares = [];
  s.peaceUntil = 0;
  s.relics = [];
  const p = s.players[0];
  p.epoch = 2;
  p.statsVersion++;
  for (const e of s.ents) if (e.kind === 'unit' && e.owner === 1) ((e.x = 1.5), (e.y = 1.5));
  const home = tc(s);
  const priest = spawnUnit(s, 0, 'priest', home.x + 6, home.y);
  const hurt = spawnUnit(s, 0, 'citizen', home.x + 6.5, home.y + 0.5);
  hurt.hp = 1;
  hurt.stance = 'stand';
  const wounded = (): void => void (hurt.hp = 1);
  return { s, priest, hurt, wounded, home };
};

/** Steps `seconds`, keeping the citizen hurt; returns whether the priest was ever seen healing. */
const runHurt = (s: GameState, priest: Unit, wounded: () => void, seconds: number, until: () => boolean = () => false): boolean => {
  let healed = false;
  for (let i = 0; i < secs(seconds) && !until(); i++) {
    wounded();
    step(s);
    if (priest.order.k === 'heal') healed = true;
  }
  return healed;
};

describe('the computer\'s priests while someone is hurt', () => {
  it('turns a dear enemy rider that comes close, though its priest was healing', () => {
    const { s, priest, wounded, home } = setup();
    expect(runHurt(s, priest, wounded, 3)).toBe(true);
    const rider = spawnUnit(s, 1, 'cavalry', home.x + 10, home.y);
    rider.stance = 'stand';
    runHurt(s, priest, wounded, 40, () => rider.owner === 0);
    expect(rider.owner).toBe(0);
  });

  it('goes for a loose relic, though its priest was healing', () => {
    const { s, priest, wounded, home } = setup();
    // A Temple at home, so a relic has somewhere to go.
    const spot = findSpot(s, 'temple', home.x, home.y, 6, 24)!;
    placeBuilding(s, 0, 'temple', spot.tx, spot.ty, true);
    expect(runHurt(s, priest, wounded, 3)).toBe(true);
    s.relics.push({ id: 900, x: home.x + 14, y: home.y, carrier: 0, temple: 0 });
    runHurt(s, priest, wounded, 10, () => priest.order.k === 'relic');
    expect(priest.order.k).toBe('relic');
  });
});

