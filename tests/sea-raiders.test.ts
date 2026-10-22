import { describe, expect, it } from 'vitest';
import { AGES, ROADS, SEA_RAID, SPOILS, TICK_HZ } from '../src/sim/data';
import { ageOf, crossingsAhead, roadKnown, roadProblem } from '../src/sim/ages';
import { hurt } from '../src/sim/combat';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import { holdFor } from '../src/sim/spoils';
import { T_WATER, type AgeId, type Building, type GameState, type Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The first crossing age (#585, the age road s12): the Age of Sea-Raiders, open only to a people that walked the Warband and the Sail. */

const road = ROADS.find((r) => r.to === 'searaider')!;
const game = (age: AgeId = 'middle', walked: AgeId[] = []): GameState => {
  const s = createGame({ seed: 2, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 1e9;
  s.animals = [];
  const p = s.players[0];
  p.epoch = 2;
  p.age = age;
  p.walked = walked;
  p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
  return s;
};
const tc = (s: GameState) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
/** A finished Dock of player 0, as near its start as the shore allows. */
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
/** A water tile at least `far` tiles from every Dock and Town Center (player 0's ship out at sea), nearest the start. */
const sea = (s: GameState, far: number): { x: number; y: number } => {
  const p = s.players[0];
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  const homes = s.ents.filter((e): e is Building => e.kind === 'building' && (e.type === 'dock' || e.type === 'towncenter'));
  for (let ty = 2; ty < s.h - 2; ty++)
    for (let tx = 2; tx < s.w - 2; tx++) {
      if (s.terrain[ty * s.w + tx] !== T_WATER) continue;
      if (homes.some((b) => (b.x - tx) ** 2 + (b.y - ty) ** 2 < far * far)) continue;
      const d = (tx - p.startX) ** 2 + (ty - p.startY) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { x: tx + 0.5, y: ty + 0.5 };
      }
    }
  return best!;
};
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < seconds * TICK_HZ && !s.over; i++) step(s);
};
/** A soldier of player 0 far from home fells a rival spearman. */
const killAbroad = (s: GameState): Unit => {
  const home = tc(s);
  const me = spawnUnit(s, 0, 'infantry', home.x + 30, home.y + 30);
  const foe = spawnUnit(s, 1, 'infantry', me.x + 1, me.y);
  hurt(s, foe, foe.hp + 100, 0, me);
  return me;
};

describe('the crossing road (#585)', () => {
  it('turns off the Middle Ages, where its two siblings both leave from, behind a hard gate', () => {
    expect(road.from).toBe('middle');
    expect(road.crossing).toEqual(['warband', 'sail']);
    for (const a of road.crossing!) expect(ROADS.some((r) => r.from === 'middle' && r.to === a)).toBe(true);
    expect(road.gate).toBe('hard');
    expect(ROADS.filter((r) => r.from === 'searaider').map((r) => r.to).sort()).toEqual(['gunpowder', 'middle']);
    // No crossing age sits on a basic route.
    expect(AGES.searaider.routes).toEqual([]);
    expect(AGES.searaider.tier).toBe(AGES.middle.tier);
  });

  it('is hidden until one sibling is walked, then names both, and opens only with both', () => {
    const s = game();
    dock(s);
    const p = s.players[0];
    expect(roadKnown(s, p, road)).toBe(false);
    p.walked = ['warband'];
    expect(roadKnown(s, p, road)).toBe(true);
    const why = roadProblem(s, p, road)!;
    expect(why).toContain(AGES.warband.name);
    expect(why).toContain(AGES.sail.name);
    expect(why).toContain('walk the Age of Sail');
    p.walked = ['sail'];
    expect(roadProblem(s, p, road)).toContain('walk the Age of the Warband');
    p.walked = ['sail', 'warband'];
    expect(roadProblem(s, p, road)).toBeNull();
  });

  it('wants a Dock as its clue, as the Sail does', () => {
    const s = game('middle', ['warband', 'sail']);
    expect(roadKnown(s, s.players[0], road)).toBe(false);
    dock(s);
    expect(roadKnown(s, s.players[0], road)).toBe(true);
  });

  it('says which road on would complete it', () => {
    const s = game('middle', ['warband']);
    const p = s.players[0];
    expect(crossingsAhead(p, 'sail')).toEqual([road]);
    expect(crossingsAhead(p, 'pilgrim')).toEqual([]);
    p.walked = [];
    expect(crossingsAhead(p, 'sail')).toEqual([]);
    p.walked = ['warband', 'sail', 'searaider'];
    expect(crossingsAhead(p, 'sail')).toEqual([]);
  });

  it('is taken at the Town Center once both siblings are walked', () => {
    const s = game('middle', ['warband', 'sail']);
    dock(s);
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'searaider' }]);
    run(s, road.time + 2);
    expect(ageOf(s.players[0])).toBe('searaider');
  });

  it('refuses the journey with one sibling walked', () => {
    const s = game('middle', ['warband']);
    dock(s);
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'searaider' }]);
    run(s, road.time + 2);
    expect(ageOf(s.players[0])).toBe('middle');
  });
});

describe('plunder hauled to the ships (#585)', () => {
  it('a kill packs plunder, and a Town Center banks none of it', () => {
    const s = game('searaider', ['warband', 'sail']);
    const me = killAbroad(s);
    expect(me.spoils).toBeGreaterThan(0);
    const gold = s.players[0].res.gold;
    me.x = tc(s).x + 3;
    me.y = tc(s).y + 3;
    run(s, 2);
    expect(me.spoils).toBeGreaterThan(0);
    expect(s.players[0].res.gold).toBe(gold);
  });

  it('a soldier by a ship hands its pack into the hold, and the hold banks at a Dock', () => {
    const s = game('searaider', ['warband', 'sail']);
    const d = dock(s);
    const at = sea(s, SEA_RAID.dock + 4);
    const ship = spawnUnit(s, 0, 'transport', at.x, at.y);
    const me = killAbroad(s);
    const pack = me.spoils!;
    me.x = ship.x;
    me.y = ship.y + 2;
    me.order = { k: 'idle' };
    expect(holdFor(s, me)).toBe(ship);
    const gold = s.players[0].res.gold;
    run(s, 1.1);
    expect(me.spoils).toBeUndefined();
    expect(ship.spoils).toBe(pack);
    expect(s.players[0].res.gold).toBe(gold);
    // Out at sea it banks nothing; by a Dock it banks the whole hold.
    ship.x = d.x + 2;
    ship.y = d.y + 2;
    run(s, 1.1);
    expect(ship.spoils).toBeUndefined();
    expect(s.players[0].res.gold).toBe(gold + pack);
    expect(s.players[0].stats.plunder).toBe(pack);
  });

  it('a soldier aboard hands its pack in wherever the ship is', () => {
    const s = game('searaider', ['warband', 'sail']);
    const at = sea(s, 12);
    const ship = spawnUnit(s, 0, 'transport', at.x, at.y);
    const me = killAbroad(s);
    me.inside = ship.id;
    ship.cargo.push(me.id);
    me.x = ship.x;
    me.y = ship.y;
    const pack = me.spoils!;
    run(s, 1.1);
    expect(ship.spoils).toBe(pack);
  });

  it('a hold takes only so much; the rest stays in the pack', () => {
    const s = game('searaider', ['warband', 'sail']);
    const at = sea(s, 12);
    const ship = spawnUnit(s, 0, 'transport', at.x, at.y);
    ship.spoils = SEA_RAID.hold - 10;
    const me = killAbroad(s);
    me.spoils = SPOILS.cap;
    me.inside = ship.id;
    ship.cargo.push(me.id);
    run(s, 1.1);
    expect(ship.spoils).toBe(SEA_RAID.hold);
    expect(me.spoils).toBe(SPOILS.cap - 10);
  });

  it('a rival who sinks a laden ship takes its hold', () => {
    const s = game('searaider', ['warband', 'sail']);
    const at = sea(s, 12);
    const ship = spawnUnit(s, 0, 'transport', at.x, at.y);
    ship.spoils = 300;
    const rival = s.players[1];
    const gold = rival.res.gold;
    const killer = spawnUnit(s, 1, 'warship', at.x, at.y);
    hurt(s, ship, ship.hp + 100, 1, killer);
    expect(rival.res.gold).toBe(gold + 300);
    expect(rival.stats.plunder).toBe(300);
  });

  it('leaving the age banks every pack and hold where it stands', () => {
    const s = game('searaider', ['warband', 'sail']);
    const at = sea(s, 12);
    const ship = spawnUnit(s, 0, 'transport', at.x, at.y);
    ship.spoils = 200;
    const me = killAbroad(s);
    const want = 200 + me.spoils!;
    step(s, [{ t: 'advance', p: 0, building: tc(s).id, to: 'middle' }]);
    run(s, 27);
    expect(ageOf(s.players[0])).toBe('middle');
    expect(ship.spoils).toBeUndefined();
    expect(me.spoils).toBeUndefined();
    expect(s.players[0].stats.plunder).toBe(want);
  });

  it('a raiding people sends no traders', () => {
    expect(AGES.searaider.no!.units).toEqual(['trader', 'cog']);
  });
});
