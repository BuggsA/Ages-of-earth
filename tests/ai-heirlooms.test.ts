import { describe, expect, it } from 'vitest';
import { heirloomAhead } from '../src/sim/ai';
import { ageOf } from '../src/sim/ages';
import { secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import type { Building, GameState, TechId } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer reaches for an heirloom (#232): a second road walked on purpose, and its craft bought first. */

/** A hard Briton town in the Middle Ages that has walked the Iron Age, its mind not yet made up about the Age of Sail. */
const game = (seed = 2): GameState => {
  const s = createGame({ seed, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: 'hard', civ: 'britons' }, { name: 'B', ai: null, civ: 'britons' }] });
  s.peaceUntil = 1e9;
  const p = s.players[0];
  p.epoch = 2;
  p.walked = ['iron'];
  // Enough for the turn, not for the Gunpowder Age (another way off the road).
  p.res = { food: 700, wood: 700, stone: 100, gold: 300 };
  for (let i = 0; i < 40; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
  for (let i = 0; i < 12; i++) spawnUnit(s, 0, 'infantry', p.startX + 4 + (i % 4), p.startY - 4 - Math.floor(i / 4));
  s.tick = secs(600);
  // Every other side road already passed by, so only the Age of Sail is left to decide.
  s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: { merchant: false, pilgrim: false, fair: false, reclaimer: false } };
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

describe('the computer reaches for an heirloom (#232)', () => {
  it('knows which heirloom a road would open, from the ages walked and the crafts not yet learned', () => {
    const p = game().players[0];
    p.walked = [];
    expect(heirloomAhead(p, 'sail')).toBeNull();
    p.walked = ['iron'];
    expect(heirloomAhead(p, 'sail')).toBe('ironHulls');
    expect(heirloomAhead(p, 'pilgrim')).toBe('bellFoundry');
    expect(heirloomAhead(p, 'merchant')).toBeNull();
    p.techs.push('ironHulls');
    expect(heirloomAhead(p, 'sail')).toBeNull();
    p.walked = ['merchant'];
    expect(heirloomAhead(p, 'sail')).toBe('jointStock');
  });

  it('takes the second road that opens one, on every seed', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = game(seed);
      dock(s);
      s.players[0].stats.fished = 500;
      run(s, 60, () => s.ai[0].roads?.sail !== undefined);
      expect(s.ai[0].roads?.sail, `seed ${seed}`).toBe(true);
    }
  });

  it('buys the heirloom first once the road has opened it, ahead of its usual list', () => {
    const s = game();
    const d = dock(s);
    s.players[0].stats.fished = 500;
    run(s, 90, () => ageOf(s.players[0]) === 'sail');
    expect(ageOf(s.players[0])).toBe('sail');
    // Rich now, so every Dock craft (Gillnets is first on its usual list) could be bought.
    s.players[0].res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
    let first: TechId | undefined;
    run(s, 60, () => (first = d.queue.find((q) => q.tech)?.tech ?? s.players[0].techs.find((t) => t === 'ironHulls' || t === 'gillnets')) !== undefined);
    expect(first).toBe('ironHulls');
  });
});

describe('the computer detours off a pilgrim town for an heirloom (#232)', () => {
  const pilgrim = (fished: number): GameState => {
    const s = game();
    const p = s.players[0];
    p.epoch = 2;
    p.walked = ['iron', 'middle'];
    p.age = 'pilgrim';
    p.res = { food: 900, wood: 900, stone: 300, gold: 400 };
    dock(s);
    // A relic kept in a Temple: the pilgrims' road holds, so only the heirloom could pull the town off it.
    const temple = placeBuilding(s, 0, 'temple', p.startX + 8, p.startY + 8, true);
    s.relics[0].temple = temple.id;
    p.stats.fished = fished;
    s.ai[0].roads!.pilgrim = true;
    return s;
  };
  it('steps back to the Middle Ages and on to Sail once the catch is landed', () => {
    const s = pilgrim(500);
    const seen: string[] = [];
    run(s, 150, () => {
      const a = ageOf(s.players[0]);
      if (seen[seen.length - 1] !== a) seen.push(a);
      return a === 'sail';
    });
    expect(seen).toEqual(['pilgrim', 'middle', 'sail']);
  });
  it('stays a pilgrim while the catch is short', () => {
    const s = pilgrim(100);
    run(s, 60, () => false);
    expect(ageOf(s.players[0])).toBe('pilgrim');
  });
});
