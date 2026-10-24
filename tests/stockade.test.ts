import { describe, expect, it } from 'vitest';
import { hurt } from '../src/sim/combat';
import { applyCommand } from '../src/sim/commands';
import { BUILDINGS, SPOILS, THRALL, TICK_HZ, secs } from '../src/sim/data';
import { enterAge, createGame, step } from '../src/sim/game';
import { markKeepsake } from '../src/sim/ages';
import { findSpot } from '../src/sim/ai';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import type { Building, GameState } from '../src/sim/types';

/** The Warband's Spoils Stockade (#727): a forward bank for plunder, and, kept, a pen for thralls on any road. */

const game = (): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 1e9;
  s.animals = [];
  s.players[0].epoch = 2;
  s.players[0].age = 'warband';
  s.players[0].cap = 200;
  s.players[0].res = { food: 2000, wood: 2000, stone: 1000, gold: 1000 };
  return s;
};
const stockade = (s: GameState, from = { x: s.players[0].startX, y: s.players[0].startY }): Building => {
  const spot = findSpot(s, 'stockade', from.x, from.y, 14, 24)!;
  return placeBuilding(s, 0, 'stockade', spot.tx, spot.ty, true);
};
const slayNear = (s: GameState, b: Building) => {
  const foe = spawnUnit(s, 1, 'citizen', b.x, b.y + 3);
  hurt(s, foe, foe.hp + 100, 0, null);
};
const thralls = (s: GameState) => s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.thrall && e.hp > 0).length;

describe('the Spoils Stockade (#727)', () => {
  it('is raised in the Warband only, one at a time', () => {
    const s = game();
    const builder = spawnUnit(s, 0, 'citizen', s.players[0].startX, s.players[0].startY + 3);
    const spot = findSpot(s, 'stockade', s.players[0].startX, s.players[0].startY, 8, 20)!;
    const mine = () => s.ents.filter((e) => e.kind === 'building' && e.owner === 0 && e.type === 'stockade').length;
    applyCommand(s, { t: 'build', p: 0, ids: [builder.id], type: 'stockade', tx: spot.tx, ty: spot.ty });
    expect(mine()).toBe(1);
    const again = findSpot(s, 'stockade', s.players[0].startX, s.players[0].startY, 12, 24)!;
    applyCommand(s, { t: 'build', p: 0, ids: [builder.id], type: 'stockade', tx: again.tx, ty: again.ty });
    expect(mine()).toBe(1);
    const m = game();
    m.players[0].age = 'middle';
    m.players[0].epoch = 3;
    const b2 = spawnUnit(m, 0, 'citizen', m.players[0].startX, m.players[0].startY + 3);
    const at = findSpot(m, 'stockade', m.players[0].startX, m.players[0].startY, 8, 20)!;
    applyCommand(m, { t: 'build', p: 0, ids: [b2.id], type: 'stockade', tx: at.tx, ty: at.ty });
    expect(m.ents.some((e) => e.kind === 'building' && e.type === 'stockade')).toBe(false);
  });

  it('banks a laden soldier\'s pack out in the field', () => {
    const s = game();
    const b = stockade(s);
    const u = spawnUnit(s, 0, 'infantry', b.x, b.y + SPOILS.bank - 1);
    u.spoils = 60;
    const before = s.players[0].res.gold;
    for (let i = 0; i < 2 * TICK_HZ; i++) step(s);
    expect(u.spoils).toBeUndefined();
    expect(s.players[0].res.gold).toBe(before + 60);
    const far = spawnUnit(s, 0, 'infantry', b.x, b.y + SPOILS.bank + 8);
    far.spoils = 60;
    for (let i = 0; i < 2 * TICK_HZ; i++) step(s);
    expect(far.spoils).toBe(60);
  });

  it('kept when the people leaves, its pen takes thralls near it; one still unbuilt keeps nothing', () => {
    const s = game();
    const b = stockade(s);
    markKeepsake(s, s.players[0], 'warband');
    expect(b.keep).toBe('warband');
    enterAge(s, s.players[0], 'middle');
    s.players[0].pop = 0;
    slayNear(s, b);
    expect(thralls(s)).toBe(1);
    const foe = spawnUnit(s, 1, 'citizen', b.x + THRALL.pen + 10, b.y);
    s.players[0].pop = 0;
    hurt(s, foe, foe.hp + 100, 0, null);
    expect(thralls(s)).toBe(1);

    const t = game();
    const c = stockade(t);
    c.built = false;
    enterAge(t, t.players[0], 'middle');
    t.players[0].pop = 0;
    slayNear(t, c);
    expect(thralls(t)).toBe(0);
  });

  it('is in the data as the Warband\'s keepsake', () => {
    expect(BUILDINGS.stockade.ages).toEqual(['warband']);
  });
});

describe('the computer and the Spoils Stockade (#727)', () => {
  it('raises one at the front in the Warband', () => {
    const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: null }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    p.epoch = 2;
    p.age = 'warband';
    p.res = { food: 3000, wood: 3000, stone: 600, gold: 800 };
    for (let i = 0; i < 20; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
    for (let i = 0; i < 6; i++) spawnUnit(s, 0, 'infantry', p.startX + 4, p.startY + 3 + i);
    s.tick = secs(300);
    s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: {} };
    const mine = () => s.ents.filter((e) => e.kind === 'building' && e.owner === 0 && e.type === 'stockade');
    for (let i = 0; i < secs(180) && !mine().some((b) => (b as Building).built); i++) step(s);
    expect(mine().length).toBe(1);
  });
});
