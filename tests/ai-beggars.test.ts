import { describe, expect, it } from 'vitest';
import { ageOf } from '../src/sim/ages';
import { secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import { coastHeld } from '../src/sim/water';
import type { AgeId, Building, GameState } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer and the fourth crossing (#783): it plans the Dykes and the Sail as it plans the others, and turns Sea Beggar. */

/** A hard town in the Middle Ages on a lakes map with a Dock, that has walked `walked`; every other turn passed by. */
const game = (seed: number, walked: AgeId[]): GameState => {
  const s = createGame({ seed, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: 'hard', civ: 'britons' }, { name: 'B', ai: null, civ: 'britons' }] });
  s.peaceUntil = 1e9;
  const p = s.players[0];
  p.epoch = 2;
  p.walked = walked;
  p.res = { food: 3000, wood: 3000, stone: 400, gold: 1500 };
  p.stats.fished = 500;
  for (let i = 0; i < 30; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
  for (let i = 0; i < 12; i++) spawnUnit(s, 0, 'infantry', p.startX + 4 + (i % 4), p.startY - 4 - Math.floor(i / 4));
  s.tick = secs(600);
  s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: { merchant: false, pilgrim: false, fair: false, reclaimer: false, alchemy: false, searaider: false, missions: false, warband: false } };
  dock(s);
  return s;
};
const dock = (s: GameState): Building => {
  const p = s.players[0];
  let best: { tx: number; ty: number } | null = null;
  let bestD = Infinity;
  for (let ty = 1; ty < s.h; ty++)
    for (let tx = 1; tx < s.w; tx++) {
      if (placeProblem(s, 'dock', tx, ty)) continue;
      const d = (tx - p.startX) ** 2 + (ty - p.startY) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { tx, ty };
      }
    }
  return placeBuilding(s, 0, 'dock', best!.tx, best!.ty, true);
};
const run = (s: GameState, seconds: number, until: () => boolean) => {
  for (let i = 0; i < secs(seconds) && !s.over && !until(); i++) step(s);
};

describe('the computer plans the Sea Beggars (#783)', () => {
  it('decides once, with the Sail walked, a Dock and shallows by home, and on some seeds says yes', () => {
    const said: boolean[] = [];
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = game(seed, ['sail']);
      if (!coastHeld(s, s.players[0])) continue;
      run(s, 20, () => s.ai[0].roads?.beggars !== undefined);
      said.push(s.ai[0].roads!.beggars!);
      // Saying yes is the other sibling's road too.
      if (s.ai[0].roads!.beggars) expect(s.ai[0].roads!.dykes, `seed ${seed}`).toBe(true);
    }
    expect(said.length).toBeGreaterThan(0);
    expect(said).toContain(true);
  });

  it('never plans it for a town with no shallows to dyke: the Dykes would be shut to it', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = game(seed, ['sail']);
      if (coastHeld(s, s.players[0])) continue;
      run(s, 20, () => s.ai[0].roads?.beggars !== undefined);
      expect(s.ai[0].roads!.beggars ?? false, `seed ${seed}`).toBe(false);
    }
  });

  it('with both siblings walked and the plan made, it turns from the Middle Ages into the age', () => {
    const s = game(2, ['sail', 'dykes']);
    s.ai[0].roads!.beggars = true;
    run(s, 120, () => ageOf(s.players[0]) === 'beggars');
    expect(ageOf(s.players[0])).toBe('beggars');
  });
});
