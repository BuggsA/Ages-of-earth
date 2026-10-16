import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { applyCommand, formation } from '../src/sim/commands';
import { BUILDINGS, EPOCHS, START_CITIZENS, TICK_HZ, unitStats } from '../src/sim/data';
import { checksum, createGame, step, type GameSetup } from '../src/sim/game';
import { findRoute } from '../src/sim/path';
import type { Building, Command, GameState, Unit } from '../src/sim/types';
import { R_BERRY, R_GOLD, R_STONE, R_TREE } from '../src/sim/types';
import { findResource } from '../src/sim/units';
import { spawnUnit } from '../src/sim/world';

const solo = (seed = 7, size: GameSetup['size'] = 'small'): GameState =>
  createGame({ seed, size, players: [{ name: 'You', ai: null }, { name: 'Rival', ai: null }] });

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

const mine = (s: GameState, p: number) => s.ents.filter((e) => e.owner === p);
const citizens = (s: GameState, p: number) => mine(s, p).filter((e): e is Unit => e.kind === 'unit' && e.type === 'citizen');
const tcOf = (s: GameState, p: number) => mine(s, p).find((e): e is Building => e.kind === 'building' && e.type === 'towncenter')!;

describe('the world', () => {
  it('gives every player the same start: a Town Center, citizens, and food, wood, stone and gold nearby', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = solo(seed, 'medium');
      for (const p of s.players) {
        expect(tcOf(s, p.id)).toBeTruthy();
        expect(citizens(s, p.id).length).toBe(START_CITIZENS + (p.civ === 'chinese' ? 2 : 0));
        for (const kind of [R_BERRY, R_GOLD, R_STONE]) expect(findResource(s, kind, p.startX, p.startY, 14), `seed ${seed} kind ${kind}`).toBeGreaterThanOrEqual(0);
        expect(findResource(s, R_TREE, p.startX, p.startY, 16)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('always leaves a way from one player to the other, around lakes, ridges and woods', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      for (const size of ['small', 'medium', 'large'] as const) {
        const s = solo(seed, size);
        const [a, b] = s.players;
        const tc = tcOf(s, 1);
        const r = findRoute(s, a.startX + 0.5, a.startY + 3.5, { x0: tc.tx - 1, y0: tc.ty - 1, x1: tc.tx + tc.size, y1: tc.ty + tc.size, px: b.startX, py: b.startY }, 20000);
        expect(r.complete, `seed ${seed} ${size}`).toBe(true);
      }
    }
  });

  it('is the same world for the same seed and a different one for another', () => {
    expect(checksum(solo(11))).toBe(checksum(solo(11)));
    expect(Array.from(solo(11).terrain)).toEqual(Array.from(solo(11).terrain));
    expect(Array.from(solo(11).res)).not.toEqual(Array.from(solo(12).res));
  });
});

describe('the economy', () => {
  it('citizens cut wood and carry it home', () => {
    const s = solo();
    const p = s.players[0];
    const tile = findResource(s, R_TREE, p.startX, p.startY, 30);
    const before = p.res.wood;
    run(s, 90, [{ t: 'gather', p: 0, ids: citizens(s, 0).map((u) => u.id), tile }]);
    expect(p.res.wood).toBeGreaterThan(before + 60);
    expect(p.stats.gathered).toBeGreaterThan(60);
  });

  it('citizens pick berries, mine gold and quarry stone', () => {
    const s = solo();
    const p = s.players[0];
    const [a, b, c] = citizens(s, 0);
    const start = { ...p.res };
    run(s, 120, []);
    applyCommand(s, { t: 'gather', p: 0, ids: [a.id], tile: findResource(s, R_BERRY, p.startX, p.startY, 20) });
    applyCommand(s, { t: 'gather', p: 0, ids: [b.id], tile: findResource(s, R_GOLD, p.startX, p.startY, 20) });
    applyCommand(s, { t: 'gather', p: 0, ids: [c.id], tile: findResource(s, R_STONE, p.startX, p.startY, 20) });
    run(s, 120);
    expect(p.res.food).toBeGreaterThan(start.food);
    expect(p.res.gold).toBeGreaterThan(start.gold);
    expect(p.res.stone).toBeGreaterThan(start.stone);
  });

  it('builds a house that makes room for five more', () => {
    const s = solo();
    const p = s.players[0];
    const tc = tcOf(s, 0);
    const cap = p.cap;
    const at = findSpot(s, 'house', tc.x, tc.y, 4, 12)!;
    run(s, 40, [{ t: 'build', p: 0, ids: citizens(s, 0).slice(0, 2).map((u) => u.id), type: 'house', tx: at.tx, ty: at.ty }]);
    const house = mine(s, 0).find((e) => e.kind === 'building' && e.type === 'house') as Building;
    expect(house).toBeTruthy();
    expect(house.built).toBe(true);
    expect(p.cap).toBe(cap + BUILDINGS.house.pop);
    expect(p.res.wood).toBe(250 - BUILDINGS.house.cost.wood!);
  });

  it('builders go back to the work they were pulled off', () => {
    const s = solo();
    const p = s.players[0];
    const tc = tcOf(s, 0);
    const [a, b] = citizens(s, 0);
    const tree = findResource(s, R_TREE, p.startX, p.startY, 30);
    run(s, 20, [{ t: 'gather', p: 0, ids: [a.id, b.id], tile: tree }]);
    const at = findSpot(s, 'house', tc.x, tc.y, 4, 12)!;
    run(s, 40, [{ t: 'build', p: 0, ids: [a.id], type: 'house', tx: at.tx, ty: at.ty }]);
    expect(mine(s, 0).some((e) => e.kind === 'building' && e.type === 'house' && e.built)).toBe(true);
    expect(a.order.k).toBe('gather');
    expect(a.order.k === 'gather' && a.order.res).toBe('wood');
  });

  it('a farm feeds whoever works it, without running out', () => {
    const s = solo();
    const p = s.players[0];
    const tc = tcOf(s, 0);
    const u = citizens(s, 0)[0];
    const at = findSpot(s, 'farm', tc.x, tc.y, 3, 12)!;
    run(s, 30, [{ t: 'build', p: 0, ids: [u.id], type: 'farm', tx: at.tx, ty: at.ty }]);
    const food = p.res.food;
    run(s, 200);
    expect(u.order.k).toBe('farm');
    expect(p.res.food).toBeGreaterThan(food + 50);
  });

  it('trains citizens until the houses are full, and says so', () => {
    const s = solo();
    const p = s.players[0];
    const tc = tcOf(s, 0);
    p.res.food = 1000;
    const cmds: Command[] = Array.from({ length: 6 }, () => ({ t: 'train', p: 0, building: tc.id, unit: 'citizen' }) as Command);
    let refused = false;
    step(s, cmds);
    for (let i = 0; i < 90 * TICK_HZ; i++) {
      step(s);
      if (s.events.some((e) => e.k === 'refused' && e.why.includes('houses'))) refused = true;
    }
    expect(citizens(s, 0).length).toBe(10);
    expect(p.pop).toBe(p.cap);
    expect(refused).toBe(true);
    expect(tc.queue.length).toBe(1);
  });

  it('refuses what cannot be paid for or is not yours, and refunds what is cancelled', () => {
    const s = solo();
    const p = s.players[0];
    const tc = tcOf(s, 0);
    p.res.food = 20;
    step(s, [{ t: 'train', p: 0, building: tc.id, unit: 'citizen' }]);
    expect(tc.queue.length).toBe(0);
    expect(s.events.some((e) => e.k === 'refused' && e.owner === 0)).toBe(true);
    // Player 1 can't move player 0's citizens.
    const u = citizens(s, 0)[0];
    const x = u.x;
    run(s, 3, [{ t: 'move', p: 1, ids: [u.id], x: u.x + 10, y: u.y }]);
    expect(u.x).toBeCloseTo(x, 1);
    p.res.food = 200;
    step(s, [{ t: 'train', p: 0, building: tc.id, unit: 'citizen' }]);
    expect(p.res.food).toBe(150);
    step(s, [{ t: 'cancel', p: 0, building: tc.id, index: 0 }]);
    expect(p.res.food).toBe(200);
  });
});

describe('epochs', () => {
  it('advances through all four epochs, and units and buildings grow sturdier with each', () => {
    const s = solo();
    const p = s.players[0];
    const tc = tcOf(s, 0);
    const u = citizens(s, 0)[0];
    for (let e = 1; e < EPOCHS.length; e++) {
      p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
      const hp = u.hp;
      step(s, [{ t: 'advance', p: 0, building: tc.id }]);
      expect(tc.advance).toBeGreaterThanOrEqual(0);
      run(s, EPOCHS[e].time + 1);
      expect(p.epoch).toBe(e);
      expect(u.hp).toBeGreaterThan(hp);
      expect(u.hp).toBeCloseTo(unitStats('citizen', e).hp, 5);
    }
  });

  it('keeps cavalry, stables and towers for the Bronze Age', () => {
    const s = solo();
    const p = s.players[0];
    const tc = tcOf(s, 0);
    p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
    const at = findSpot(s, 'stable', tc.x, tc.y, 4, 14)!;
    step(s, [{ t: 'build', p: 0, ids: [citizens(s, 0)[0].id], type: 'stable', tx: at.tx, ty: at.ty }]);
    expect(mine(s, 0).some((e) => e.kind === 'building' && e.type === 'stable')).toBe(false);
    expect(s.events.some((e) => e.k === 'refused' && e.why.includes('Bronze'))).toBe(true);
  });
});

describe('combat', () => {
  /** Two units face off on open ground; returns who is left standing. */
  function duel(epoch: number, a: Unit['type'], b: Unit['type'], gap = 6): 'a' | 'b' | 'both' | 'none' {
    const s = solo(3);
    for (const e of s.ents) if (e.kind === 'unit') e.hp = 0;
    step(s);
    s.players[0].epoch = epoch;
    s.players[1].epoch = epoch;
    const p = s.players[0];
    const x = p.startX + (s.w / 2 > p.startX ? 8 : -8);
    const y = p.startY + (s.h / 2 > p.startY ? 8 : -8);
    const ua = spawnUnit(s, 0, a, x, y);
    const ub = spawnUnit(s, 1, b, x + gap, y);
    run(s, 60, [{ t: 'attack', p: 0, ids: [ua.id], target: ub.id }, { t: 'attack', p: 1, ids: [ub.id], target: ua.id }]);
    const la = ua.hp > 0;
    const lb = ub.hp > 0;
    return la && lb ? 'both' : la ? 'a' : lb ? 'b' : 'none';
  }

  it('spears beat horses', () => {
    for (const e of [1, 2, 3]) expect(duel(e, 'infantry', 'cavalry'), `epoch ${e}`).toBe('a');
  });

  it('archers beat foot soldiers', () => {
    for (const e of [0, 1, 2, 3]) expect(duel(e, 'ranged', 'infantry', 7), `epoch ${e}`).toBe('a');
  });

  it('horses beat archers', () => {
    for (const e of [1, 2, 3]) expect(duel(e, 'cavalry', 'ranged'), `epoch ${e}`).toBe('a');
  });

  it('Town Centers shoot at enemies who come close', () => {
    const s = solo();
    const tc = tcOf(s, 0);
    const foe = spawnUnit(s, 1, 'infantry', tc.x + 4, tc.y + 4);
    const hp = foe.hp;
    run(s, 5);
    expect(foe.hp).toBeLessThan(hp);
  });

  it('a soldier on attack-move fights what it meets and razes buildings', () => {
    const s = solo();
    const p0 = s.players[0];
    const tc = tcOf(s, 1);
    s.players[0].epoch = 3;
    const army = Array.from({ length: 14 }, (_, i) => spawnUnit(s, 0, 'infantry', tc.x + 9 + (i % 4) * 0.6, tc.y + 9 + Math.floor(i / 4) * 0.6));
    run(s, 240, [{ t: 'move', p: 0, ids: army.map((u) => u.id), x: tc.x, y: tc.y, amove: true }]);
    expect(p0.stats.kills).toBeGreaterThan(0);
    expect(tc.hp <= 0 || s.players[1].stats.losses > 3).toBe(true);
  });
});

describe('movement', () => {
  it('a group walks to a spot in formation without piling onto one tile', () => {
    const s = solo();
    const p = s.players[0];
    const us = Array.from({ length: 12 }, (_, i) => spawnUnit(s, 0, 'infantry', p.startX + 6 + (i % 4) * 0.6, p.startY + 6 + Math.floor(i / 4) * 0.6));
    const tx = p.startX + (s.w / 2 > p.startX ? 20 : -20);
    const ty = p.startY + (s.h / 2 > p.startY ? 14 : -14);
    run(s, 30, [{ t: 'move', p: 0, ids: us.map((u) => u.id), x: tx, y: ty }]);
    const near = us.filter((u) => Math.hypot(u.x - tx, u.y - ty) < 4).length;
    expect(near).toBeGreaterThanOrEqual(10);
    // Nobody stands inside anybody else.
    for (const a of us) for (const b of us) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.25);
    const spots = formation(s, us, tx, ty);
    expect(new Set(spots.map((f) => `${f.x.toFixed(2)},${f.y.toFixed(2)}`)).size).toBe(us.length);
  });

  it('walks the long way round to reach the other side of the map', () => {
    const s = solo(4, 'medium');
    const p = s.players[0];
    const other = s.players[1];
    const u = spawnUnit(s, 0, 'cavalry', p.startX + 3, p.startY + 3);
    s.players[0].epoch = 1;
    run(s, 120, [{ t: 'move', p: 0, ids: [u.id], x: other.startX + 4, y: other.startY + 4 }]);
    expect(Math.hypot(u.x - (other.startX + 4), u.y - (other.startY + 4))).toBeLessThan(3);
  });
});

describe('determinism (the basis for online play)', () => {
  it('plays out identically from the same seed and the same commands', () => {
    const play = () => {
      const s = createGame({ seed: 99, size: 'small', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'normal' }] });
      const sums: number[] = [];
      for (let i = 0; i < 8 * 60 * TICK_HZ; i++) {
        step(s);
        if (i % 600 === 0) sums.push(checksum(s));
      }
      return sums;
    };
    expect(play()).toEqual(play());
  }, 60000);

  it('uses no browser-dependent math, clocks or Math.random in the rules', () => {
    const dir = join(__dirname, '../src/sim');
    for (const f of readdirSync(dir)) {
      const code = readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      for (const bad of ['Math.sin', 'Math.cos', 'Math.tan', 'Math.atan', 'Math.pow', 'Math.exp', 'Math.log', 'Math.random', 'Date.now', 'performance.now', 'Math.hypot', '**']) {
        expect(code.includes(bad), `${f} uses ${bad}`).toBe(false);
      }
    }
  });
});

describe('the computer opponent', () => {
  it('comes for a player who does nothing', () => {
    const s = createGame({ seed: 5, size: 'small', players: [{ name: 'You', ai: null }, { name: 'Rival', ai: 'normal' }] });
    let hit = -1;
    for (let i = 0; i < 25 * 60 * TICK_HZ && !s.over; i++) {
      step(s);
      if (hit < 0 && s.events.some((e) => e.k === 'alert' && e.owner === 0)) hit = s.tick;
    }
    expect(hit).toBeGreaterThan(0);
    expect(hit / TICK_HZ / 60).toBeGreaterThan(4);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(1);
  }, 120000);
});
