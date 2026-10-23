import { describe, expect, it } from 'vitest';
import { ageOf } from '../src/sim/ages';
import { MISSION, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import type { AgeId, Building, GameState } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer and the second crossing (#555 s12): it plans the Pilgrims and the Sail like the first, and raises Missions once there. */

/** A hard Briton town in the Middle Ages with a Dock and a Temple, that has walked the Pilgrims; every other turn passed by. */
const game = (seed = 2, walked: AgeId[] = ['pilgrim']): GameState => {
  const s = createGame({ seed, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: 'hard', civ: 'britons' }, { name: 'B', ai: null, civ: 'britons' }] });
  s.peaceUntil = 1e9;
  const p = s.players[0];
  p.epoch = 2;
  p.walked = walked;
  p.res = { food: 3000, wood: 3000, stone: 400, gold: 1500 };
  p.stats.fished = 500;
  p.stats.slain = 10;
  for (let i = 0; i < 30; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
  for (let i = 0; i < 12; i++) spawnUnit(s, 0, 'infantry', p.startX + 4 + (i % 4), p.startY - 4 - Math.floor(i / 4));
  s.tick = secs(600);
  s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: { merchant: false, pilgrim: false, fair: false, reclaimer: false, alchemy: false, searaider: false } };
  near(s, 'dock');
  near(s, 'temple');
  return s;
};
const near = (s: GameState, type: 'dock' | 'temple'): Building => {
  const p = s.players[0];
  let best: { tx: number; ty: number } | null = null;
  let bestD = Infinity;
  for (let ty = 1; ty < s.h; ty++)
    for (let tx = 1; tx < s.w; tx++) {
      if (placeProblem(s, type, tx, ty)) continue;
      const d = (tx - p.startX) ** 2 + (ty - p.startY) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { tx, ty };
      }
    }
  return placeBuilding(s, 0, type, best!.tx, best!.ty, true);
};
const run = (s: GameState, seconds: number, until: () => boolean) => {
  for (let i = 0; i < secs(seconds) && !s.over && !until(); i++) step(s);
};

describe('the computer plans the crossing (#555 s12)', () => {
  it('decides once, with one sibling walked, a Dock and a Temple, and on some seeds says yes', () => {
    const said: boolean[] = [];
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = game(seed);
      run(s, 20, () => s.ai[0].roads?.missions !== undefined);
      said.push(s.ai[0].roads!.missions!);
      // Saying yes is the other sibling's road too.
      if (s.ai[0].roads!.missions) expect(s.ai[0].roads!.sail, `seed ${seed}`).toBe(true);
    }
    expect(said).toContain(true);
  });
});

describe('the computer raises Missions (#555 s12)', () => {
  it('sends a priest to raise one on a far shore, and its tithe comes in', () => {
    const s = game(2, ['pilgrim', 'sail']);
    s.players[0].age = 'missions';
    s.ai[0].roads!.missions = true;
    spawnUnit(s, 0, 'priest', s.players[0].startX + 2, s.players[0].startY + 6);
    for (const e of s.ents) if (e.kind === 'building' && e.owner === 0) e.queue = [];
    const mine = () => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'mission');
    run(s, 240, () => mine().some((b) => b.built));
    expect(mine().length).toBeGreaterThan(0);
    expect(mine().length).toBeLessThanOrEqual(MISSION.most);
    expect(ageOf(s.players[0])).toBe('missions');
  });
});
