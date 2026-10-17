import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { ageOf } from '../src/sim/ages';
import { ROADS, secs } from '../src/sim/data';
import { checksum, createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import type { AgeId, Building, BuildingType, CivId, GameState, Unit, UnitType } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer walks the web of ages (#50): it takes side roads, uses them, and reads its rivals' roads. */

const game = (civ: CivId, startEpoch = 0, seed = 11): GameState => {
  const s = createGame({ seed, size: 'small', startEpoch, players: [{ name: 'A', ai: 'hard', civ }, { name: 'B', ai: null, civ: 'britons' }] });
  s.rares = []; // the deeds are the road here (#356)
  // No waves: the army stays home, so nothing but the town's own choices is tested.
  s.peaceUntil = 1e9;
  return s;
};
const run = (s: GameState, seconds: number, until?: () => boolean) => {
  for (let i = 0; i < secs(seconds) && !s.over && !until?.(); i++) step(s);
};
const rich = (s: GameState) => (s.players[0].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 });
const raise = (s: GameState, type: BuildingType, owner = 0): Building => {
  const p = s.players[owner];
  const spot = findSpot(s, type, p.startX, p.startY, 6, 24)!;
  return placeBuilding(s, owner, type, spot.tx, spot.ty, true);
};
/**
 * A full town (a Town Center busy training citizens never sets out on a road) and a standing army, so
 * soldiers don't come first.
 */
const ready = (s: GameState, citizens = 40, soldiers = 12) => {
  const p = s.players[0];
  for (let i = 0; i < citizens; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
  for (let i = 0; i < soldiers; i++) spawnUnit(s, 0, 'infantry', p.startX + 4 + (i % 4), p.startY - 4 - Math.floor(i / 4));
  s.tick = secs(600);
};
/** The computer's mind made up about a road before the match starts (before its first turn, which might set out on another). */
const decided = (s: GameState, roads: Partial<Record<AgeId, boolean>>) => {
  s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads };
};
const units = (s: GameState, owner: number, type: UnitType) => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === owner && e.type === type && e.hp > 0);
const bogSeed = (() => {
  for (let seed = 1; seed < 60; seed++) if (createGame({ seed, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] }).bogIron) return seed;
  throw new Error('no bog world');
})();

describe('the computer walks the web of ages (#50)', () => {
  it('surveys a bog world, digs bog iron and takes the iron road, when its people fight on foot', () => {
    const s = game('romans', 0, bogSeed);
    run(s, 900, () => ageOf(s.players[0]) !== 'stone');
    const p = s.players[0];
    expect(p.techs).toContain('survey');
    expect(p.stats.iron).toBeGreaterThanOrEqual(ROADS.find((r) => r.to === 'iron')!.deed!.n);
    expect(ageOf(p)).toBe('iron');
  });

  it('never takes a road that bars its people’s strength: Mongol riders keep the horse', () => {
    const s = game('mongols', 0, bogSeed);
    run(s, 600, () => ageOf(s.players[0]) !== 'stone');
    expect(s.players[0].techs).not.toContain('survey');
    expect(ageOf(s.players[0])).not.toBe('iron');
  });

  it('takes the merchant road once its traders have paid the deed, then hires soldiers at the Market', () => {
    const s = game('greeks', 1);
    rich(s);
    ready(s);
    decided(s, { merchant: true });
    const market = raise(s, 'market');
    s.players[0].stats.traded = 400;
    run(s, 120, () => ageOf(s.players[0]) === 'merchant');
    expect(ageOf(s.players[0])).toBe('merchant');
    let hired = false;
    run(s, 120, () => (hired = market.queue.some((q) => q.unit === 'infantry' || q.unit === 'ranged' || q.unit === 'cavalry')));
    expect(hired).toBe(true);
  });

  it('keeps to the trunk when it has passed a road by', () => {
    const s = game('greeks', 1);
    rich(s);
    ready(s);
    decided(s, { merchant: false });
    raise(s, 'market');
    s.players[0].stats.traded = 400;
    run(s, 120, () => ageOf(s.players[0]) !== 'bronze');
    expect(ageOf(s.players[0])).toBe('middle');
  });

  it('turns pilgrim when its Temples keep relics, and turns back when they are lost', () => {
    const s = game('egyptians', 2);
    // Enough for the turn and the way back, not for the Gunpowder Age (another way off the road).
    s.players[0].res = { food: 700, wood: 200, stone: 200, gold: 200 };
    ready(s);
    const temple = raise(s, 'temple');
    for (const r of s.relics.slice(0, 2)) Object.assign(r, { carrier: 0, temple: temple.id, x: temple.x, y: temple.y });
    s.players[0].stats.relicGold = ROADS.find((r) => r.to === 'pilgrim')!.deed!.n;
    run(s, 90, () => ageOf(s.players[0]) === 'pilgrim');
    expect(ageOf(s.players[0])).toBe('pilgrim');
    // Robbed: the relics now lie in a rival's Temple, and the pilgrims' road has nothing left to give.
    const theirs = raise(s, 'temple', 1);
    for (const r of s.relics) if (r.temple === temple.id) Object.assign(r, { temple: theirs.id, x: theirs.x, y: theirs.y });
    run(s, 90, () => ageOf(s.players[0]) !== 'pilgrim');
    expect(ageOf(s.players[0])).toBe('middle');
  });

  it('reads a rival on the iron road and masses archers against its foot', () => {
    const archers = (rivalAge: AgeId) => {
      const s = game('greeks', 1);
      // On what its own citizens gather: with gold to burn, every building trains all the time.
      ready(s, 40, 0);
      for (const type of ['barracks', 'range', 'stable'] as const) raise(s, type);
      // The rival takes the iron road; its age is on the scoreboard for all to read.
      s.players[1].age = rivalAge;
      run(s, 150);
      return units(s, 0, 'ranged').length / Math.max(1, units(s, 0, 'infantry').length + units(s, 0, 'cavalry').length);
    };
    expect(archers('iron')).toBeGreaterThan(archers('bronze') * 1.5);
  });

  it('lies in wait on a merchant rival’s trade road and cuts down the traders it sees', () => {
    const raid = (rivalAge: AgeId) => {
      const s = game('mongols', 2);
      ready(s, 40, 0);
      s.peaceUntil = 0;
      const p = s.players[0];
      const q = s.players[1];
      q.age = rivalAge;
      const riders = [0, 1, 2].map((i) => spawnUnit(s, 0, 'cavalry', p.startX + 3 + i, p.startY + 3));
      // A trader resting by the trading post nearest the rival's town, far from the riders' home.
      const post = [...s.posts].sort((a, b) => (a.x - q.startX) ** 2 + (a.y - q.startY) ** 2 - ((b.x - q.startX) ** 2 + (b.y - q.startY) ** 2))[0];
      const trader = spawnUnit(s, 1, 'trader', post.x + 2, post.y + 2);
      run(s, 120, () => trader.hp <= 0);
      return { cut: trader.hp <= 0, farthest: Math.max(...riders.map((u) => Math.sqrt((u.x - p.startX) ** 2 + (u.y - p.startY) ** 2))) };
    };
    expect(raid('merchant').cut).toBe(true);
    const calm = raid('middle');
    expect(calm.cut).toBe(false);
    expect(calm.farthest).toBeLessThan(16);
  });

  it('keeps its mind through a save: a match saved while it digs plays on exactly the same', () => {
    const s = game('romans', 0, bogSeed);
    run(s, 300);
    expect(s.ai[0].roads?.iron).toBe(true);
    const t = deserialize(serialize(s));
    for (let i = 0; i < secs(150); i++) {
      step(s);
      step(t);
    }
    expect(checksum(t)).toBe(checksum(s));
    expect(t.ai[0].roads).toEqual(s.ai[0].roads);
  });
});
