import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { ageOf, hasWalked, heirloomsOpened, roadTo } from '../src/sim/ages';
import { TECHS, TECH_IDS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { generateMap } from '../src/sim/mapgen';
import { deserialize, serialize } from '../src/sim/save';
import { modsOf, techProblem } from '../src/sim/stats';
import type { AgeId, Building, BuildingType, Command, GameState } from '../src/sim/types';
import { placeBuilding } from '../src/sim/world';

/** Heirlooms (#224): crafts only a people that has walked two particular ages can learn, kept for good. */

const game = (startEpoch = 0, seed = 11): GameState =>
  createGame({ seed, size: 'small', startEpoch, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < secs(seconds); i++) step(s);
};
const tc = (s: GameState) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
const raise = (s: GameState, type: BuildingType): Building => {
  const p = s.players[0];
  const spot = findSpot(s, type, p.startX, p.startY, 6, 24)!;
  return placeBuilding(s, 0, type, spot.tx, spot.ty, true);
};
const advance = (s: GameState, to?: AgeId) => {
  const road = roadTo(s.players[0], to)!;
  run(s, road.time + 1, [{ t: 'advance', p: 0, building: tc(s).id, to }]);
};

describe('heirlooms (#224)', () => {
  it('each names two different side ages and a building, and is never also a one-age craft', () => {
    const heirs = TECH_IDS.filter((t) => TECHS[t].walked);
    expect(heirs.sort()).toEqual(['bellFoundry', 'ironHulls', 'jointStock', 'masonsLodge', 'stElmo']);
    for (const t of heirs) {
      const [a, b] = TECHS[t].walked!;
      expect(a).not.toBe(b);
      expect(TECHS[t].only).toBeUndefined();
    }
  });

  it('stays shut until both ages are walked, in either order, and names what is missing', () => {
    const s = game(2);
    const p = s.players[0];
    expect(techProblem(s, 0, 'ironHulls')).toBe('An heirloom: walk the Iron Age and the Age of Sail first');
    p.walked = ['sail'];
    p.statsVersion++;
    expect(techProblem(s, 0, 'ironHulls')).toBe('An heirloom: walk the Iron Age first');
    p.walked = ['sail', 'iron'];
    expect(techProblem(s, 0, 'ironHulls')).toBeNull();
    // The age a people stands in counts as walked, so an older save without the list still opens it.
    p.walked = ['iron'];
    p.age = 'sail';
    expect(ageOf(p)).toBe('sail');
    expect(techProblem(s, 0, 'ironHulls')).toBeNull();
    expect(heirloomsOpened(p, 'sail')).toEqual(['ironHulls']);
    expect(heirloomsOpened(p, 'iron')).toEqual(['ironHulls']);
  });

  it('is kept for good once learned, on the trunk and after a step back', () => {
    const s = game(2);
    const p = s.players[0];
    p.walked = ['merchant', 'sail'];
    p.techs.push('jointStock');
    p.statsVersion++;
    expect(modsOf(s, 0).tradeGold).toBeCloseTo(1.15);
    expect(modsOf(s, 0).traderSpeed).toBeCloseTo(1.1);
    p.walked = [];
    p.statsVersion++;
    expect(modsOf(s, 0).tradeGold).toBeCloseTo(1.15);
  });

  it('walks Iron, then the Middle Ages, then the Pilgrims: the Bell Foundry opens, and rings on after leaving', () => {
    let seed = 1;
    while (!generateMap(seed, 'small', 2).bogIron) seed++;
    const s = game(0, seed);
    const p = s.players[0];
    p.res = { food: 20000, wood: 20000, stone: 20000, gold: 20000 };
    p.techs.push('survey');
    p.statsVersion++;
    p.stats.iron = 150;
    advance(s, 'iron');
    expect(ageOf(p)).toBe('iron');
    expect(p.walked).toEqual(['iron']);
    advance(s);
    expect(ageOf(p)).toBe('middle');
    // The trunk is everyone's and isn't kept.
    expect(p.walked).toEqual(['iron']);
    expect(hasWalked(p, 'iron')).toBe(true);
    expect(techProblem(s, 0, 'bellFoundry')).toBe('An heirloom: walk the Age of Pilgrims first');
    const temple = raise(s, 'temple');
    p.stats.relicGold = 120;
    advance(s, 'pilgrim');
    expect(ageOf(p)).toBe('pilgrim');
    expect(p.walked).toEqual(['iron', 'pilgrim']);
    expect(techProblem(s, 0, 'bellFoundry')).toBeNull();
    // Not the Sail heirloom: that road wasn't walked.
    expect(techProblem(s, 0, 'ironHulls')).toContain('Age of Sail');
    const relics = modsOf(s, 0).relicGold;
    run(s, TECHS.bellFoundry.time + 1, [{ t: 'research', p: 0, building: temple.id, tech: 'bellFoundry' }]);
    expect(p.techs).toContain('bellFoundry');
    expect(modsOf(s, 0).relicGold).toBeCloseTo(relics * 1.5);
    advance(s, 'middle');
    expect(ageOf(p)).toBe('middle');
    // Off the pilgrims' road its own gifts are gone, but the bells still ring.
    expect(modsOf(s, 0).priest).toBeCloseTo(1.2);
    expect(modsOf(s, 0).relicGold).toBeCloseTo(1.5);
    // The ages walked survive a save.
    const back = deserialize(serialize(s));
    expect(back.players[0].walked).toEqual(['iron', 'pilgrim']);
  });
});
