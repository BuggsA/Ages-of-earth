import { describe, expect, it } from 'vitest';
import { ageOf, roadKnown, roadProblem, roadsFrom } from '../src/sim/ages';
import { board, boardsAt } from '../src/sim/beggars';
import { damageOf, hurt } from '../src/sim/combat';
import { AGES, BEGGARS, ROADS, ROUTES, type RouteId } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { sails } from '../src/sim/grid';
import { trainCostFor } from '../src/sim/stats';
import type { AgeId, Building, GameState, Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit, statsOf } from '../src/sim/world';

/** The Age of the Sea Beggars (#783): the Dykes and the Sail's crossing. Ships boarded and taken, and dykes cut from the sea. */

const ROAD = ROADS.find((r) => r.to === 'beggars')!;

/** Two people at war on a sea map, player 0 in `age` (the Middle Ages' tier), nobody's computer. */
const game = (age: AgeId = 'beggars', walked: AgeId[] = ['dykes', 'sail']): GameState => {
  const s = createGame({ seed: 4, size: 'small', mapType: 'sea', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 0;
  for (const p of s.players) p.epoch = 2;
  s.players[0].age = age;
  s.players[0].walked = walked;
  return s;
};
/** A ship of `owner`'s on the open water nearest a point (its people's start, by default). */
const ship = (s: GameState, owner: number, type: Unit['type'], near?: { x: number; y: number }): Unit => {
  const at = near ?? { x: s.players[owner].startX, y: s.players[owner].startY };
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < s.w * s.h; i++) {
    if (!sails(s, i)) continue;
    const dx = (i % s.w) + 0.5 - at.x;
    const dy = Math.floor(i / s.w) + 0.5 - at.y;
    if (dx * dx + dy * dy < bestD) {
      bestD = dx * dx + dy * dy;
      best = i;
    }
  }
  return spawnUnit(s, owner, type, (best % s.w) + 0.5, Math.floor(best / s.w) + 0.5);
};

describe('the crossing in the data (#783)', () => {
  it('turns off the Middle Ages for a people that walked the Dykes and the Sail, a Dock its clue, a hard gate', () => {
    expect(ROAD.from).toBe('middle');
    expect(ROAD.crossing).toEqual(['dykes', 'sail']);
    expect(ROAD.clue).toBe('dock');
    expect(ROAD.gate).toBe('hard');
    // Both siblings leave from the Middle Ages, as a crossing's must.
    for (const a of ROAD.crossing!) expect(ROADS.some((r) => r.from === 'middle' && r.to === a)).toBe(true);
    expect(ROADS.filter((r) => r.from === 'beggars').map((r) => r.to).sort()).toEqual(['gunpowder', 'middle']);
  });

  it('stands on no basic route, keeps a Dock, and names what it does and shuts', () => {
    const a = AGES.beggars;
    for (const r of Object.keys(ROUTES) as RouteId[]) expect(a.routes).not.toContain(r);
    expect(a.tier).toBe(2);
    expect(a.keepsake!.building).toBe('dock');
    expect(a.verb && a.door && a.good).toBeTruthy();
    expect(a.noBuild!.buildings).toEqual(['wall', 'gate']);
    expect(a.no!.units).toEqual(['fisher']);
  });

  it('is seen once either sibling is walked, and names the one still to walk', () => {
    const s = game('middle', []);
    placeBuilding(s, 0, 'dock', 1, 1, true);
    const p = s.players[0];
    expect(roadKnown(s, p, ROAD)).toBe(false);
    p.walked = ['sail'];
    expect(roadKnown(s, p, ROAD)).toBe(true);
    expect(roadProblem(s, p, ROAD)).toContain(AGES.dykes.name);
    p.walked = ['sail', 'dykes'];
    p.res = { food: 9999, wood: 9999, stone: 9999, gold: 9999 };
    expect(roadProblem(s, p, ROAD)).toBeNull();
    expect(roadsFrom(p).some((r) => r.to === 'beggars')).toBe(true);
  });

  it('makes every ship a fifth dearer and launches no fishing boats', () => {
    const s = game();
    const dock = placeBuilding(s, 0, 'dock', 1, 1, true);
    const was = game('middle');
    const dock0 = placeBuilding(was, 0, 'dock', 1, 1, true);
    expect(trainCostFor(s, 0, 'warship', 'dock', dock).wood!).toBeCloseTo(trainCostFor(was, 0, 'warship', 'dock', dock0).wood! * 1.2, 5);
  });
});

describe('boarding (#783)', () => {
  it('a rival ship beaten down by a Beggars warship is taken, with a third of its timbers and its hold', () => {
    const s = game();
    const mine = ship(s, 0, 'warship');
    const cog = ship(s, 1, 'cog', mine);
    cog.carry = 40;
    cog.carryRes = 'gold';
    hurt(s, cog, cog.hp + 5, 0, null, mine);
    expect(cog.owner).toBe(0);
    expect(cog.hp).toBeCloseTo(statsOf(s, cog).hp * BEGGARS.left, 5);
    expect(cog.carry).toBe(40);
    expect(cog.order.k).toBe('idle');
    expect(s.players[0].stats.boarded).toBe(1);
    expect(s.events.some((e) => e.k === 'boarded' && e.id === cog.id && e.from === 1 && e.to === 0)).toBe(true);
    // It is not counted as a kill: it sails on.
    step(s);
    expect(s.byId.get(cog.id)).toBe(cog);
  });

  it('sinks as ever outside the age, by a land blow, or with soldiers aboard', () => {
    const plain = game('middle');
    const a = ship(plain, 0, 'warship');
    const b = ship(plain, 1, 'warship', a);
    hurt(plain, b, b.hp + 5, 0, null, a);
    expect(b.owner).toBe(1);
    expect(b.hp).toBeLessThanOrEqual(0);

    const s = game();
    const mine = ship(s, 0, 'warship');
    const boat = ship(s, 1, 'fisher', mine);
    const archer = spawnUnit(s, 0, 'ranged', s.players[0].startX, s.players[0].startY);
    expect(board(s, { ...boat, hp: 0 } as Unit, 0, archer)).toBe(false);
    const transport = ship(s, 1, 'transport', mine);
    transport.cargo = [spawnUnit(s, 1, 'infantry', transport.x, transport.y).id];
    hurt(s, transport, transport.hp + 5, 0, null, mine);
    expect(transport.owner).toBe(1);
    expect(transport.hp).toBeLessThanOrEqual(0);
  });

  it('a Dock kept from the age boards ships beaten down near it on any road, and only there', () => {
    const s = game('gunpowder');
    s.players[0].epoch = 3;
    const dock = placeBuilding(s, 0, 'dock', 10, 10, true) as Building;
    expect(boardsAt(s, 0, dock.x + 4, dock.y)).toBe(false);
    dock.keep = 'beggars';
    expect(boardsAt(s, 0, dock.x + 4, dock.y)).toBe(true);
    expect(boardsAt(s, 0, dock.x + BEGGARS.haven + 2, dock.y)).toBe(false);
    expect(ageOf(s.players[0])).toBe('gunpowder');
  });
});

describe('cutting the dykes from the sea (#783)', () => {
  it('a Beggars warship strikes a dyke as siege does, eight times what another people\'s ship does', () => {
    const s = game();
    const plain = game('sail', ['sail']);
    const dyke = placeBuilding(s, 1, 'dyke', 12, 12, true);
    const dyke2 = placeBuilding(plain, 1, 'dyke', 12, 12, true);
    const a = ship(s, 0, 'warship');
    const b = ship(plain, 0, 'warship');
    const cut = damageOf(s, a, statsOf(s, a), dyke, true);
    const usual = damageOf(plain, b, statsOf(plain, b), dyke2, true);
    expect(cut / usual).toBeGreaterThan(BEGGARS.cut / 0.15 / 1.5);
    // Stone walls stay as hard to a ship as ever.
    const wall = placeBuilding(s, 1, 'wall', 14, 14, true);
    const wall2 = placeBuilding(plain, 1, 'wall', 14, 14, true);
    expect(damageOf(s, a, statsOf(s, a), wall, true) / damageOf(plain, b, statsOf(plain, b), wall2, true)).toBeLessThan(1.5);
  });
});
