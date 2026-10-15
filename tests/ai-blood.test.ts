import { describe, expect, it } from 'vitest';
import { ageOf } from '../src/sim/ages';
import { AI_BLOOD, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { placeProblem } from '../src/sim/grid';
import type { Building, CivId, GameState, Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer on the Path of Blood (#307): turns, holds, War Camps, and the answer to a rival's camp. */

const game = (civ: CivId = 'romans', epoch = 2): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: 'hard', civ }, { name: 'B', ai: null }] });
  const p = s.players[0];
  p.epoch = epoch;
  p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
  // A full town, so the Town Center's queue is free for the road.
  const home = tc(s);
  for (let i = 0; i < 60; i++) spawnUnit(s, 0, 'citizen', home.x + 3 + (i % 10) * 0.5, home.y + 3 + (i >> 4) * 0.5);
  return s;
};
function tc(s: GameState, owner = 0): Building {
  return tcOf(s, owner);
}
const tcOf = (s: GameState, owner = 0) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;
const spot = (s: GameState, type: 'barracks' | 'warcamp', x: number, y: number, lo: number, hi: number, owner = 0) => {
  for (let r = lo; r <= hi; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = Math.round(x) + dx;
        const ty = Math.round(y) + dy;
        if (!placeProblem(s, type, tx, ty, true, owner)) return { tx, ty };
      }
  throw new Error('no room');
};
const barracks = (s: GameState) => {
  const at = spot(s, 'barracks', s.players[0].startX, s.players[0].startY, 4, 20);
  return placeBuilding(s, 0, 'barracks', at.tx, at.ty, true);
};
const run = (s: GameState, seconds: number) => {
  for (let i = 0; i < secs(seconds); i++) step(s);
};
const camps = (s: GameState, owner = 0) => s.ents.filter((e): e is Building => e.kind === 'building' && e.type === 'warcamp' && e.owner === owner);
const seeAll = (s: GameState) => s.players.forEach((p) => p.seen.fill(1));

describe('the computer walks the Path of Blood', () => {
  it('a war-people with a Barracks and the slain counted turns Warband', () => {
    const s = game();
    barracks(s);
    step(s);
    s.ai[0].roads = { warband: true };
    s.players[0].stats.slain = 25;
    run(s, 90);
    expect(ageOf(s.players[0])).toBe('warband');
  });

  it('a people of priests never rolls for the path', () => {
    const s = game('egyptians');
    barracks(s);
    s.players[0].stats.slain = 25;
    run(s, 120);
    expect(s.ai[0].roads?.warband).toBe(false);
    expect(ageOf(s.players[0])).not.toBe('warband');
  });

  it('a people that walked the Warband and took its plunder turns Iron and Blood from Gunpowder', () => {
    const s = game('romans', 3);
    barracks(s);
    step(s);
    s.players[0].walked = ['warband'];
    s.players[0].stats.plunder = 600;
    run(s, 90);
    expect(ageOf(s.players[0])).toBe('ironblood');
  });

  it('holds the climb out of the Warband for the plunder, then gives the road up', () => {
    const s = game('romans', 2);
    barracks(s);
    s.players[0].stats.slain = 25;
    step(s);
    s.ai[0].roads = { warband: true };
    s.tick = secs(500); // late enough for the climb to be wanted
    s.peaceUntil = secs(5000); // and the army stays home
    for (let i = 0; i < 40; i++) spawnUnit(s, 0, 'infantry', tcOf(s).x - 6 + (i % 10) * 0.5, tcOf(s).y + 6 + (i >> 4) * 0.5);
    run(s, 80);
    expect(ageOf(s.players[0])).toBe('warband');
    s.players[0].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
    run(s, 60);
    expect(s.ai[0].blood?.hold).toBeDefined();
    expect(ageOf(s.players[0])).toBe('warband');
    // Out of patience: the same hold, begun long ago.
    s.ai[0].blood!.hold! -= secs(AI_BLOOD.patience);
    run(s, 30);
    
    expect(s.ai[0].roads?.ironblood).toBe(false);
  });
});

describe('War Camps for the computer', () => {
  /** Player 0 in Iron and Blood, a wave of foot soldiers marching on player 1, `reach` tiles short of its Town Center. */
  const march = (distance: number) => {
    const s = game('romans', 3);
    s.players[0].walked = ['warband'];
    const ent = tc(s, 1);
    step(s);
    const foot: Unit[] = [];
    const dx = tc(s, 0).x - ent.x;
    const dy = tc(s, 0).y - ent.y;
    const dl = Math.sqrt(dx * dx + dy * dy);
    for (let i = 0; i < 8; i++) foot.push(spawnUnit(s, 0, 'infantry', ent.x + (dx / dl) * distance + (i % 3) * 0.5, ent.y + (dy / dl) * distance + (i >> 2) * 0.5));
    return { s, foot, enemy: ent };
  };
  it('a wave near the rival pitches a camp out of the Town Center\'s arrows', () => {
    const { s, foot, enemy } = march(24);
    s.players[0].epoch = 3;
    // The Path of Blood needs the age itself.
    s.players[0].age = 'ironblood';
    s.ai[0].attacking = true;
    for (const u of foot) u.order = { k: 'move', x: enemy.x, y: enemy.y, amove: true } as Unit['order'];
    run(s, 12);
    const made = camps(s);
    expect(made.length).toBe(1);
    const b = made[0];
    expect(Math.hypot(b.x - enemy.x, b.y - enemy.y)).toBeGreaterThan(AI_BLOOD.clear - 2);
  });

  it('pitches no camp while the wave is still far from the rival', () => {
    const { s, foot, enemy } = march(AI_BLOOD.reach + 25);
    s.players[0].epoch = 3;
    s.players[0].age = 'ironblood';
    s.ai[0].attacking = true;
    for (const u of foot) u.order = { k: 'move', x: enemy.x, y: enemy.y, amove: true } as Unit['order'];
    run(s, 12);
    expect(camps(s).length).toBe(0);
  });

  it('soldiers stay by a finished camp, and a burnt one is not pitched again at once', () => {
    const { s, enemy } = march(24);
    s.players[0].epoch = 3;
    s.players[0].age = 'ironblood';
    const at = spot(s, 'warcamp', enemy.x, enemy.y, 14, 18, 0);
    const camp = placeBuilding(s, 0, 'warcamp', at.tx, at.ty, true);
    const guards: Unit[] = [];
    for (let i = 0; i < 6; i++) guards.push(spawnUnit(s, 0, 'infantry', camp.x + 1 + i * 0.3, camp.y + 2));
    run(s, 40);
    expect(camp.hp).toBeGreaterThan(0);
    const near = guards.filter((u) => u.hp > 0 && Math.hypot(u.x - camp.x, u.y - camp.y) <= 8);
    expect(near.length).toBeGreaterThanOrEqual(AI_BLOOD.keep);
    expect(camp.alone ?? 0).toBe(0);
  });
});

describe('answering a rival camp', () => {
  it('a band of soldiers falls on a War Camp it has seen near home', () => {
    const s = game('romans', 3);
    
    step(s);
    const home = tc(s, 0);
    const at = spot(s, 'warcamp', home.x, home.y, 14, 20, 1);
    const camp = placeBuilding(s, 1, 'warcamp', at.tx, at.ty, true);
    seeAll(s);
    const band: Unit[] = [];
    for (let i = 0; i < AI_BLOOD.strike + 1; i++) band.push(spawnUnit(s, 0, 'infantry', home.x + 5 + i * 0.4, home.y + 5));
    s.peaceUntil = 0;
    run(s, 6);
    const going = band.filter((u) => u.order.k === 'move' && (u.order as { amove?: boolean }).amove);
    expect(going.length).toBeGreaterThanOrEqual(AI_BLOOD.strike);
    void camp;
  });
});

describe('the computer walks Total War (#315)', () => {
  it('in Iron and Blood a people that walked it pitches a muster camp at home, which trains the deed', () => {
    const s = game('romans', 3);
    s.players[0].walked = ['warband'];
    s.players[0].age = 'ironblood';
    step(s);
    const home = tc(s, 0);
    for (let i = 0; i < 6; i++) spawnUnit(s, 0, 'infantry', home.x + 4 + i * 0.4, home.y + 4);
    run(s, 60);
    const made = camps(s);
    expect(made.length).toBe(1);
    expect(Math.hypot(made[0].x - home.x, made[0].y - home.y)).toBeLessThan(AI_BLOOD.home + 10);
    run(s, 120);
    expect(s.players[0].stats.campTrained ?? 0).toBeGreaterThan(0);
  });

  it('holds Iron and Blood past the stay while the camp deed is undone, then goes', () => {
    const s = game('romans', 3);
    s.players[0].walked = ['warband'];
    s.players[0].age = 'ironblood';
    step(s);
    s.ai[0].blood = { since: s.tick - secs(AI_BLOOD.stay + 10) };
    run(s, 5);
    expect(s.ai[0].roads?.totalwar).toBe(true);
    expect(ageOf(s.players[0])).toBe('ironblood');
  });

  it('turns Total War from the Industrial Age once the deed is done', () => {
    const s = game('romans', 4);
    barracks(s);
    s.players[0].walked = ['warband', 'ironblood'];
    s.players[0].stats.campTrained = 12;
    run(s, 90);
    expect(ageOf(s.players[0])).toBe('totalwar');
  });

  it('calls citizens to arms at the camp nearest foes at the gates, keeping some at work', () => {
    const s = game('romans', 4);
    s.players[0].walked = ['warband', 'ironblood'];
    s.players[0].age = 'totalwar';
    step(s);
    const home = tc(s, 0);
    const at = spot(s, 'warcamp', home.x, home.y, 7, 12, 0);
    const camp = placeBuilding(s, 0, 'warcamp', at.tx, at.ty, true);
    for (let i = 0; i < 5; i++) spawnUnit(s, 1, 'infantry', home.x + 10 + i * 0.4, home.y + 10);
    for (let i = 0; i < 12; i++) spawnUnit(s, 0, 'citizen', camp.x + 1 + (i % 4) * 0.4, camp.y + 3 + (i >> 2) * 0.4);
    const before = s.players[0].stats.calledUp ?? 0;
    run(s, 4);
    expect((s.players[0].stats.calledUp ?? 0) - before).toBeGreaterThan(0);
    expect(s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen').length).toBeGreaterThanOrEqual(AI_BLOOD.held);
  });

  it('calls up none in peace', () => {
    const s = game('romans', 4);
    s.players[0].walked = ['warband', 'ironblood'];
    s.players[0].age = 'totalwar';
    step(s);
    const home = tc(s, 0);
    const at = spot(s, 'warcamp', home.x, home.y, 7, 12, 0);
    placeBuilding(s, 0, 'warcamp', at.tx, at.ty, true);
    run(s, 10);
    expect(s.players[0].stats.calledUp ?? 0).toBe(0);
  });
});
