import { describe, expect, it } from 'vitest';
import { ageOf } from '../src/sim/ages';
import { SEA_RAID, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import { T_WATER, type AgeId, type Building, type GameState } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer and the first crossing (#585): it walks one sibling, goes back, walks the other, goes back and turns Sea-Raider. */

/** A hard Briton town in the Middle Ages with a Dock and the catch landed, that has walked the Warband; every other turn passed by. */
const game = (seed = 2, walked: AgeId[] = ['warband']): GameState => {
  const s = createGame({ seed, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: 'hard', civ: 'britons' }, { name: 'B', ai: null, civ: 'britons' }] });
  s.peaceUntil = 1e9;
  const p = s.players[0];
  p.epoch = 2;
  p.walked = walked;
  p.res = { food: 3000, wood: 3000, stone: 100, gold: 1500 };
  p.stats.fished = 500;
  p.stats.slain = 10;
  for (let i = 0; i < 40; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
  for (let i = 0; i < 12; i++) spawnUnit(s, 0, 'infantry', p.startX + 4 + (i % 4), p.startY - 4 - Math.floor(i / 4));
  s.tick = secs(600);
  s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: { merchant: false, pilgrim: false, fair: false, reclaimer: false, alchemy: false } };
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

describe('the computer plans the crossing (#585)', () => {
  it('decides once, with one sibling walked and a Dock, and on some seeds says yes', () => {
    const said: boolean[] = [];
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = game(seed);
      run(s, 20, () => s.ai[0].roads?.searaider !== undefined);
      said.push(s.ai[0].roads!.searaider!);
      // Saying yes is the other sibling's road too.
      if (s.ai[0].roads!.searaider) expect(s.ai[0].roads!.sail, `seed ${seed}`).toBe(true);
    }
    expect(said).toContain(true);
  });

  it('walks the other sibling, comes back to the Middle Ages and turns Sea-Raider', () => {
    const s = game();
    s.ai[0].roads!.searaider = true;
    s.ai[0].roads!.sail = true;
    const seen: string[] = [];
    run(s, 400, () => {
      const a = ageOf(s.players[0]);
      if (seen[seen.length - 1] !== a) seen.push(a);
      return a === 'searaider';
    });
    expect(seen).toEqual(['middle', 'sail', 'middle', 'searaider']);
  });

  it('a town that said no climbs on as before', () => {
    const s = game();
    s.ai[0].roads!.searaider = false;
    s.ai[0].roads!.sail = false;
    run(s, 60, () => false);
    expect(ageOf(s.players[0])).not.toBe('sail');
  });
});

describe('the computer raids by ship (#585)', () => {
  const raider = (): GameState => {
    const s = game(2, ['warband', 'sail']);
    s.players[0].age = 'searaider';
    s.ai[0].roads!.searaider = true;
    // Room for a ship: fewer citizens than the town's houses hold.
    let n = 0;
    for (const e of s.ents) if (e.kind === 'unit' && e.owner === 0 && e.type === 'citizen' && n++ < 30) e.hp = 0;
    // Standing in the age from the start, so nothing queued before it was set aside on the way in, as `enterAge` does.
    for (const e of s.ents) if (e.kind === 'building' && e.owner === 0) e.queue = [];
    step(s);
    return s;
  };
  it('builds a transport to take the packs', () => {
    const s = raider();
    const ordered = () => s.ents.some((e) => e.owner === 0 && ((e.kind === 'unit' && e.type === 'transport') || (e.kind === 'building' && e.queue.some((q) => q.unit === 'transport'))));
    run(s, 40, ordered);
    expect(ordered()).toBe(true);
  });
  it('sails a laden ship home to a Dock and banks the hold', () => {
    const s = raider();
    const d = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'dock')!;
    // Out on the water, well away from the Dock.
    let at: { x: number; y: number } | null = null;
    for (let r = 10; r < 30 && !at; r++)
      for (let k = 0; k < 16 && !at; k++) {
        const tx = Math.floor(d.x + [r, -r, 0, 0, r, -r, r, -r][k % 8] * (k < 8 ? 1 : 0.7));
        const ty = Math.floor(d.y + [0, 0, r, -r, r, r, -r, -r][k % 8] * (k < 8 ? 1 : 0.7));
        if (tx > 1 && ty > 1 && tx < s.w - 1 && ty < s.h - 1 && s.terrain[ty * s.w + tx] === T_WATER) at = { x: tx + 0.5, y: ty + 0.5 };
      }
    const ship = spawnUnit(s, 0, 'transport', at!.x, at!.y);
    ship.spoils = SEA_RAID.home + 50;
    const plunder = s.players[0].stats.plunder ?? 0;
    run(s, 90, () => ship.spoils === undefined);
    expect(ship.spoils).toBeUndefined();
    expect(s.players[0].stats.plunder).toBe(plunder + SEA_RAID.home + 50);
  });
});
