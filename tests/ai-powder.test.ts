import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { AGES, AI_KEG, ROADS, secs } from '../src/sim/data';
import { ageOf } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';
import type { AgeId, Building, GameState } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The computer on the first gateway (#577): it turns into Alchemy where saltpetre lies, grinds, climbs to the Sappers and lays kegs. */

const tcOf = (s: GameState, o: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === o && e.type === 'towncenter')!;
const run = (s: GameState, sec: number, until?: () => boolean) => { for (let i = 0; i < secs(sec) && !s.over && !until?.(); i++) step(s); };

/** A Hard computer (player 0) in `age` (with a peace, so it climbs rather than overruns an idle rival), prospected, with a Siege Workshop and a Storehouse, in a world that holds saltpetre. */
function computer(age: AgeId, peaceMinutes = 0): GameState {
  let s: GameState | null = null;
  for (let seed = 1; !s; seed++) {
    const g = createGame({ seed, size: 'small', mapType: 'plains', peaceMinutes, players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: null }] });
    if (g.rares?.includes('saltpetre')) s = g;
  }
  const p = s.players[0];
  restat(s, p, () => { p.epoch = AGES[age].tier; p.age = age; });
  p.techs.push('survey');
  for (const r of ['food', 'wood', 'gold', 'stone'] as const) p.res[r] = 5000;
  const home = tcOf(s, 0);
  for (const [type, dx] of [['workshop', 8], ['storehouse', -8]] as const) {
    const spot = findSpot(s, type, home.x + dx, home.y + 4, 1, 12)!;
    placeBuilding(s, 0, type, spot.tx, spot.ty, true);
  }
  // A full town: the Town Center trains no more citizens, so it is free to take a road.
  for (let i = 0; i < 40; i++) spawnUnit(s, 0, 'citizen', home.x - 3 + (i % 8) * 0.7, home.y + 4 + Math.floor(i / 8) * 0.7);
  step(s);
  s.ai[0].roads = { ...s.ai[0].roads, alchemy: true };
  return s;
}

describe('the computer on the gateway (#577)', () => {
  it('turns into Alchemy once its saltpetre door is open and the store holds enough to grind', () => {
    const s = computer('middle', 60);
    const p = s.players[0];
    p.stats.mined = { saltpetre: AI_KEG.ore };
    p.rare = { saltpetre: AI_KEG.ore };
    const road = ROADS.find((r) => r.to === 'alchemy')!;
    run(s, road.time + 20, () => ageOf(p) === 'alchemy');
    expect(ageOf(p)).toBe('alchemy');
    // It kept its saltpetre for the mills rather than selling it.
    expect(p.rare!.saltpetre! + (p.stats.ground ?? 0) * 20).toBeGreaterThanOrEqual(AI_KEG.ore);
  });

  it('grinds in Alchemy and climbs to the Sappers once the deed is done', () => {
    const s = computer('alchemy', 60);
    const p = s.players[0];
    p.stats.mined = { saltpetre: 200 };
    p.rare = { saltpetre: 200 };
    // Late enough in the match for the computer to think of its next age at all.
    s.tick = secs(600);
    const road = ROADS.find((r) => r.to === 'sapper')!;
    run(s, 320, () => ageOf(p) === 'sapper');
    expect(p.stats.ground ?? 0).toBeGreaterThanOrEqual(road.deed!.n);
    expect(ageOf(p)).toBe('sapper');
  });

  it('in the Sappers, sends foot soldiers on campaign to lay kegs at a rival building', () => {
    const s = computer('sapper');
    const p = s.players[0];
    p.kegs = 3;
    const foe = tcOf(s, 1);
    const spot = findSpot(s, 'house', foe.x - 12, foe.y, 1, 10)!;
    const house = placeBuilding(s, 1, 'house', spot.tx, spot.ty, true);
    for (let i = 0; i < 4; i++) spawnUnit(s, 0, 'infantry', house.x - 4, house.y + i * 0.6);
    run(s, 30, () => (p.stats.blown ?? 0) > 0);
    expect(p.kegs).toBeLessThan(3);
    expect(p.stats.blown ?? 0).toBeGreaterThan(0);
  });
});
