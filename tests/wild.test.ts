import { describe, expect, it } from 'vitest';
import { AGES, BUILDINGS, ROADS, SEASON, TAME, TICK_HZ } from '../src/sim/data';
import { createGame, enterAge, step } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { spawnAnimal } from '../src/sim/animals';
import { applyCommand } from '../src/sim/commands';
import { barred, buildBarred } from '../src/sim/ages';
import type { Animal, Command, GameState, Unit } from '../src/sim/types';
import { R_NONE } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** The Age of the Wild (`docs/wild-road.md`): citizens tame wild beasts, and a Beast Den breeds the kinds tamed. */

const game = (seed = 11): GameState =>
  createGame({ seed, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: null, civ: 'romans' }] });

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

/** An open meadow away from every town, with the wild cleared, and player 0 in the Age of the Wild. */
function meadow(seed = 11): { s: GameState; x: number; y: number } {
  const s = game(seed);
  s.animals = [];
  enterAge(s, s.players[0], 'wild');
  for (let y = 8; y < s.h - 8; y++) {
    for (let x = 8; x < s.w - 8; x++) {
      if (s.players.some((p) => Math.hypot(x - p.startX, y - p.startY) < 18)) continue;
      let open = true;
      for (let dy = -5; dy <= 5 && open; dy++) for (let dx = -5; dx <= 5 && open; dx++) open = walkable(s, x + dx, y + dy) && s.res[(y + dy) * s.w + x + dx] === R_NONE;
      if (open) return { s, x: x + 0.5, y: y + 0.5 };
    }
  }
  throw new Error('no meadow');
}

const mine = (s: GameState, type: Unit['type']) => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === type && e.hp > 0);

describe('the Age of the Wild', () => {
  it('is a third road out of the Stone Age, on its own route, with a verb and a door', () => {
    const road = ROADS.find((r) => r.from === 'stone' && r.to === 'wild');
    expect(road?.deed?.stat).toBe('foraged');
    expect(AGES.wild.routes).toEqual(['wild']);
    expect(AGES.wild.verb).toBeTruthy();
    expect(AGES.wild.noBuild?.buildings).toEqual(expect.arrayContaining(['stable', 'workshop']));
    expect(ROADS.some((r) => r.from === 'wild' && r.to === 'middle')).toBe(true);
    expect(ROADS.some((r) => r.from === 'wild' && r.to === 'bronze')).toBe(true);
  });

  it('shuts the Stable and the Siege Workshop while the people stays', () => {
    const { s } = meadow();
    expect(buildBarred(s.players[0], 'stable')).toBeTruthy();
    expect(buildBarred(s.players[0], 'workshop')).toBeTruthy();
    expect(buildBarred(s.players[1], 'stable')).toBeNull();
  });

  for (const kind of ['wolf', 'boar', 'mammoth'] as const) {
    it(`tames a ${kind} into a beast of war: a lone citizen can, for the beast stands calm`, () => {
      const { s, x, y } = meadow();
      const a = spawnAnimal(s, x, y, kind);
      const u = spawnUnit(s, 0, 'citizen', x - 3, y);
      run(s, TAME.secs[kind] + 6, [{ t: 'tame', p: 0, ids: [u.id], target: a.id }]);
      expect(s.animals.includes(a)).toBe(false);
      expect(mine(s, TAME.unit[kind]).length).toBe(1);
      expect(s.players[0].tamed).toEqual([kind]);
      expect(s.players[0].stats.tamed).toBe(1);
    });
  }

  it('the pack still bites: the wolf being tamed stands calm, its packmate does not', () => {
    const { s, x, y } = meadow();
    const a = spawnAnimal(s, x, y, 'wolf');
    const b = spawnAnimal(s, x + 1, y, 'wolf');
    const u = spawnUnit(s, 0, 'citizen', x - 3, y);
    let bitten = false;
    step(s, [{ t: 'tame', p: 0, ids: [u.id], target: a.id }]);
    for (let i = 0; i < 3 * TICK_HZ; i++) {
      step(s);
      if (u.hp < 40) bitten = true;
      expect(a.state).not.toBe('fight');
    }
    expect(bitten).toBe(true);
    expect(b.state).toBe('fight');
  });

  it('a wound breaks the song, and a beast just hurt will not take the hand', () => {
    const { s, x, y } = meadow();
    const a: Animal = spawnAnimal(s, x, y, 'mammoth');
    const u = spawnUnit(s, 0, 'citizen', x - 2, y);
    run(s, 4, [{ t: 'tame', p: 0, ids: [u.id], target: a.id }]);
    expect(u.order.k).toBe('tame');
    a.hurt = s.tick;
    run(s, 1);
    expect(u.order.k).not.toBe('tame');
    expect(s.animals.includes(a)).toBe(true);
  });

  it('only a Wild people tames, and never a deer or a flock', () => {
    const { s, x, y } = meadow();
    const deer = spawnAnimal(s, x, y, 'deer');
    const wolf = spawnAnimal(s, x + 4, y, 'wolf');
    const u = spawnUnit(s, 0, 'citizen', x - 3, y);
    const v = spawnUnit(s, 1, 'citizen', x + 7, y);
    applyCommand(s, { t: 'tame', p: 0, ids: [u.id], target: deer.id });
    applyCommand(s, { t: 'tame', p: 1, ids: [v.id], target: wolf.id });
    expect(u.order.k).toBe('idle');
    expect(v.order.k).toBe('idle');
  });

  it('the Den is raised only once a beast is tamed, and breeds only the kinds tamed, in any age after', () => {
    const { s, x, y } = meadow();
    const p = s.players[0];
    expect(buildBarred(p, 'den')).toBeTruthy();
    expect(barred(p, 'warwolf')).toBeTruthy();
    const a = spawnAnimal(s, x, y, 'wolf');
    const u = spawnUnit(s, 0, 'citizen', x - 3, y);
    run(s, TAME.secs.wolf + 6, [{ t: 'tame', p: 0, ids: [u.id], target: a.id }]);
    expect(buildBarred(p, 'den')).toBeNull();
    expect(barred(p, 'warwolf')).toBeNull();
    expect(barred(p, 'tusker')).toBeTruthy();
    expect(barred(p, 'warmammoth')).toBeTruthy();
    expect(BUILDINGS.den.trains).toEqual(['warwolf', 'tusker', 'warmammoth']);
    // Leaving the Wild keeps the Den's breeding, but shuts the song.
    enterAge(s, p, 'middle');
    expect(buildBarred(p, 'den')).toBeNull();
    expect(barred(p, 'warwolf')).toBeNull();
    expect(buildBarred(p, 'stable')).toBeNull();
    const b = spawnAnimal(s, x + 3, y + 3, 'boar');
    applyCommand(s, { t: 'tame', p: 0, ids: [u.id], target: b.id });
    expect(u.order.k).not.toBe('tame');
  });

  it('a Den trains a bred wolf for food', () => {
    const { s, x, y } = meadow();
    const p = s.players[0];
    p.tamed = ['wolf'];
    p.res.food = 1000;
    p.res.wood = 1000;
    const cit = spawnUnit(s, 0, 'citizen', x, y);
    run(s, 1, [{ t: 'build', p: 0, ids: [cit.id], type: 'den', tx: Math.floor(x) + 1, ty: Math.floor(y) + 1 }]);
    run(s, BUILDINGS.den.time + 10);
    const built = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'den');
    expect(built && built.kind === 'building' && built.built).toBe(true);
    run(s, 25, [{ t: 'train', p: 0, building: built!.id, unit: 'warwolf' }]);
    expect(mine(s, 'warwolf').length).toBe(1);
  });

  it('the call of the wild: a Wild people\'s Hunting Camp draws a beast to it each season, up to a cap', () => {
    const { s, x, y } = meadow();
    const cit = spawnUnit(s, 0, 'citizen', x, y);
    s.players[0].res.wood = 500;
    run(s, 1, [{ t: 'build', p: 0, ids: [cit.id], type: 'huntcamp', tx: Math.floor(x), ty: Math.floor(y) }]);
    run(s, 40);
    const camp = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'huntcamp');
    expect(camp && camp.kind === 'building' && camp.built).toBe(true);
    // The builder leaves the field, so nothing near the camp fights what comes.
    cit.hp = 0;
    const near = () => s.animals.filter((a) => (a.kind === 'boar' || a.kind === 'wolf') && Math.hypot(a.x - camp!.x, a.y - camp!.y) <= TAME.callNear).length;
    expect(near()).toBe(0);
    while (s.tick % (SEASON.len * TICK_HZ) !== TAME.callAt * TICK_HZ + 1 || s.tick < SEASON.len * TICK_HZ) step(s);
    expect(near()).toBe(1);
    for (let i = 0; i < 4; i++) run(s, SEASON.len);
    expect(near()).toBe(TAME.callCap);
    // A camp of a people that does not tame calls nothing.
    const t = meadow();
    const c2 = spawnUnit(t.s, 1, 'citizen', t.x, t.y);
    t.s.players[1].res.wood = 500;
    run(t.s, 1, [{ t: 'build', p: 1, ids: [c2.id], type: 'huntcamp', tx: Math.floor(t.x), ty: Math.floor(t.y) }]);
    run(t.s, 40 + SEASON.len * 2);
    expect(t.s.animals.filter((a) => a.kind === 'boar' || a.kind === 'wolf').length).toBe(0);
  });
});
