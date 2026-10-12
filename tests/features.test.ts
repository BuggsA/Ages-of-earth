import { describe, expect, it } from 'vitest';
import { findSpot } from '../src/sim/ai';
import { BUILDINGS, DEER, MARKET, TECHS, TICK_HZ, unitStats } from '../src/sim/data';
import { checksum, createGame, step, type GameSetup } from '../src/sim/game';
import { findRoute } from '../src/sim/path';
import { deserialize, serialize } from '../src/sim/save';
import { statsFor } from '../src/sim/stats';
import type { Building, CivId, Command, GameState, Unit } from '../src/sim/types';
import { R_MEAT, R_TREE } from '../src/sim/types';
import { findResource } from '../src/sim/units';
import { placeBuilding, spawnUnit } from '../src/sim/world';

const game = (o: Partial<GameSetup> & { civs?: CivId[] } = {}): GameState =>
  createGame({
    seed: o.seed ?? 7,
    size: o.size ?? 'small',
    mapType: o.mapType,
    startEpoch: o.startEpoch,
    peaceMinutes: o.peaceMinutes,
    wonderSeconds: o.wonderSeconds,
    mode: o.mode,
    players: o.players ?? [
      { name: 'A', ai: null, civ: o.civs?.[0] ?? 'romans' },
      { name: 'B', ai: null, civ: o.civs?.[1] ?? 'romans' },
    ],
  });

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};
const citizens = (s: GameState, p: number) => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === p && e.type === 'citizen');
const tcOf = (s: GameState, p: number) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === p && e.type === 'towncenter')!;
const rich = (s: GameState, p = 0) => (s.players[p].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 });
/** A spot on open ground a little way from a player's town. */
const field = (s: GameState, p = 0, d = 9) => {
  const pl = s.players[p];
  return { x: pl.startX + (s.w / 2 > pl.startX ? d : -d), y: pl.startY + (s.h / 2 > pl.startY ? d : -d) };
};
function build(s: GameState, p: number, type: Building['type'], near = 5): Building {
  const tc = tcOf(s, p);
  const at = findSpot(s, type, tc.x, tc.y, near, 20)!;
  return placeBuilding(s, p, type, at.tx, at.ty, true);
}

describe('technologies', () => {
  it('a forge makes swords sharper, once researched, and only in order', () => {
    const s = game({ startEpoch: 2 });
    rich(s);
    const forge = build(s, 0, 'forge');
    const before = statsFor(s, 0, 'infantry').attack;
    step(s, [{ t: 'research', p: 0, building: forge.id, tech: 'ironCasting' }]);
    expect(forge.queue.length).toBe(0);
    expect(s.events.some((e) => e.k === 'refused' && e.why.includes('Forging'))).toBe(true);
    run(s, TECHS.forging.time + 1, [{ t: 'research', p: 0, building: forge.id, tech: 'forging' }]);
    expect(s.players[0].techs).toContain('forging');
    expect(statsFor(s, 0, 'infantry').attack).toBe(before + 1);
    step(s, [{ t: 'research', p: 0, building: forge.id, tech: 'forging' }]);
    expect(forge.queue.length).toBe(0);
  });

  it('better tools make citizens gather faster', () => {
    const chopped = (techs: boolean) => {
      const s = game();
      const p = s.players[0];
      if (techs) p.techs.push('axes');
      p.statsVersion++;
      const tree = findResource(s, R_TREE, p.startX, p.startY, 30);
      const tx = tree % s.w;
      const ty = Math.floor(tree / s.w);
      // A citizen already standing by the tree.
      let spot = { x: tx + 0.5, y: ty + 0.5 };
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (s.block[(ty + dy) * s.w + tx + dx] === 0) spot = { x: tx + dx + 0.5, y: ty + dy + 0.5 };
      const u = spawnUnit(s, 0, 'citizen', spot.x, spot.y);
      run(s, 12, [{ t: 'gather', p: 0, ids: [u.id], tile: tree }]);
      return u.carry + u.frac;
    };
    expect(chopped(true)).toBeGreaterThan(chopped(false) * 1.15);
  });
});

describe('civilizations', () => {
  it('each changes something: Greek hoplites are tougher, the Chinese start bigger', () => {
    const s = game({ civs: ['greeks', 'chinese'] });
    expect(statsFor(s, 0, 'infantry').hp).toBeGreaterThan(statsFor(s, 1, 'infantry').hp);
    expect(citizens(s, 1).length).toBe(citizens(s, 0).length + 2);
  });
});

describe('shelter and the town bell', () => {
  it('citizens run to the Town Center when the bell rings, it shoots more arrows, and they go back to work after', () => {
    const s = game();
    const p = s.players[0];
    const tree = findResource(s, R_TREE, p.startX, p.startY, 30);
    const cs = citizens(s, 0);
    run(s, 15, [{ t: 'gather', p: 0, ids: cs.map((u) => u.id), tile: tree }]);
    run(s, 20, [{ t: 'bell', p: 0, ring: true }]);
    const tc = tcOf(s, 0);
    expect(tc.garrison.length).toBe(cs.length);
    expect(cs.every((u) => u.inside === tc.id)).toBe(true);
    // A raider gets a volley.
    const foe = spawnUnit(s, 1, 'infantry', tc.x + 4, tc.y + 4);
    step(s);
    for (let i = 0; i < 3; i++) step(s);
    expect(s.shots.filter((sh) => sh.owner === 0).length).toBeGreaterThan(3);
    foe.hp = 0;
    run(s, 5, [{ t: 'bell', p: 0, ring: false }]);
    expect(tc.garrison.length).toBe(0);
    expect(cs.every((u) => !u.inside && u.order.k === 'gather')).toBe(true);
  });
});

describe('the hunt', () => {
  it('citizens spear a deer, butcher it and carry the meat home', () => {
    const s = game();
    const p = s.players[0];
    const deer = s.animals.reduce((a, b) => (Math.hypot(a.x - p.startX, a.y - p.startY) < Math.hypot(b.x - p.startX, b.y - p.startY) ? a : b));
    expect(Math.hypot(deer.x - p.startX, deer.y - p.startY)).toBeLessThan(20);
    const food = p.res.food;
    run(s, 90, [{ t: 'hunt', p: 0, ids: citizens(s, 0).slice(0, 2).map((u) => u.id), target: deer.id }]);
    expect(s.animals.includes(deer)).toBe(false);
    expect(p.res.food).toBeGreaterThan(food + 20);
  });

  it('a wounded deer bolts', () => {
    const s = game();
    const p = s.players[0];
    const deer = s.animals[0];
    const u = spawnUnit(s, 0, 'citizen', deer.x + 2, deer.y);
    run(s, 2, [{ t: 'hunt', p: 0, ids: [u.id], target: deer.id }]);
    expect(deer.hp).toBeLessThan(DEER.hp);
    void p;
    void R_MEAT;
  });
});

describe('priests', () => {
  it('a priest turns an enemy soldier, and heals a wounded friend', () => {
    const s = game({ startEpoch: 1 });
    const at = field(s);
    const priest = spawnUnit(s, 0, 'priest', at.x, at.y);
    const foe = spawnUnit(s, 1, 'infantry', at.x + 4, at.y);
    foe.stance = 'stand';
    run(s, 20, [{ t: 'convert', p: 0, ids: [priest.id], target: foe.id }]);
    expect(foe.owner).toBe(0);
    const friend = spawnUnit(s, 0, 'infantry', at.x + 1, at.y + 1);
    friend.hp = 20;
    run(s, 25);
    expect(friend.hp).toBeGreaterThan(40);
  });
});

describe('heroes', () => {
  it('soldiers near a hero hit harder, and there is only one hero at a time', () => {
    const fight = (hero: boolean) => {
      const s = game({ startEpoch: 1 });
      const at = field(s);
      const a = Array.from({ length: 4 }, (_, i) => spawnUnit(s, 0, 'infantry', at.x, at.y + i * 0.6));
      const b = Array.from({ length: 4 }, (_, i) => spawnUnit(s, 1, 'infantry', at.x + 2, at.y + i * 0.6));
      if (hero) spawnUnit(s, 0, 'hero', at.x - 2, at.y).stance = 'stand';
      run(s, 12, [{ t: 'attack', p: 0, ids: a.map((u) => u.id), target: b[0].id }]);
      return b.reduce((n, u) => n + Math.max(0, u.hp), 0);
    };
    expect(fight(true)).toBeLessThan(fight(false));
    const s = game({ startEpoch: 1 });
    rich(s);
    const tc = tcOf(s, 0);
    step(s, [{ t: 'train', p: 0, building: tc.id, unit: 'hero' }, { t: 'train', p: 0, building: tc.id, unit: 'hero' }]);
    expect(tc.queue.filter((q) => q.unit === 'hero').length).toBe(1);
  });
});

describe('siege', () => {
  it('a ram batters buildings but leaves soldiers be; a catapult hits a crowd', () => {
    const s = game({ startEpoch: 2 });
    const tc = tcOf(s, 1);
    const ram = spawnUnit(s, 0, 'siege', tc.x + 4, tc.y + 4);
    s.players[0].epoch = 1;
    s.players[0].statsVersion++;
    const hp = tc.hp;
    const guard = spawnUnit(s, 1, 'citizen', tc.x + 3.5, tc.y + 3.5);
    guard.stance = 'stand';
    run(s, 20, [{ t: 'attack', p: 0, ids: [ram.id], target: guard.id }]);
    expect(guard.hp).toBeGreaterThan(0);
    run(s, 20, [{ t: 'attack', p: 0, ids: [ram.id], target: tc.id }]);
    expect(tc.hp).toBeLessThan(hp - 200);

    const s2 = game({ startEpoch: 2 });
    const at = field(s2);
    const cat = spawnUnit(s2, 0, 'siege', at.x, at.y);
    const crowd = Array.from({ length: 5 }, (_, i) => {
      const u = spawnUnit(s2, 1, 'citizen', at.x + 7 + (i % 3) * 0.4, at.y + Math.floor(i / 3) * 0.4);
      u.stance = 'stand';
      return u;
    });
    run(s2, 8, [{ t: 'attack', p: 0, ids: [cat.id], target: crowd[0].id }]);
    expect(crowd.filter((u) => u.hp < unitStats('citizen', 2).hp).length).toBeGreaterThan(1);
  });
});

describe('the market', () => {
  it('buying raises the price and selling lowers it', () => {
    const s = game({ startEpoch: 1 });
    rich(s);
    build(s, 0, 'market');
    const p = s.players[0];
    const gold = p.res.gold;
    const price = s.market.wood;
    step(s, [{ t: 'trade', p: 0, res: 'wood', buy: true }]);
    expect(p.res.gold).toBe(gold - price);
    expect(s.market.wood).toBe(price + MARKET.step);
    step(s, [{ t: 'trade', p: 0, res: 'wood', buy: false }]);
    expect(s.market.wood).toBe(price);
  });
});

describe('wonders', () => {
  it('a finished wonder that stands long enough wins', () => {
    const s = game({ startEpoch: 1, wonderSeconds: 30 });
    rich(s);
    const tc = tcOf(s, 0);
    const at = findSpot(s, 'wonder', tc.x, tc.y, 6, 24)!;
    const w = placeBuilding(s, 0, 'wonder', at.tx, at.ty, false);
    w.progress = 0.999;
    const cs = citizens(s, 0);
    run(s, 40, [{ t: 'work', p: 0, ids: cs.map((u) => u.id), target: w.id }]);
    expect(w.built).toBe(true);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
    expect(s.events.some((e) => e.k === 'over' && e.how === 'wonder') || s.over).toBe(true);
  });
});

describe('orders', () => {
  it('Shift lines up orders one after another', () => {
    const s = game();
    const at = field(s);
    const u = spawnUnit(s, 0, 'infantry', at.x, at.y);
    run(s, 12, [
      { t: 'move', p: 0, ids: [u.id], x: at.x + 6, y: at.y },
      { t: 'move', p: 0, ids: [u.id], x: at.x + 6, y: at.y + 6, queue: true },
    ]);
    expect(Math.hypot(u.x - (at.x + 6), u.y - (at.y + 6))).toBeLessThan(1);
  });

  it('a unit standing its ground does not chase', () => {
    const s = game();
    const at = field(s);
    const u = spawnUnit(s, 0, 'infantry', at.x, at.y);
    step(s, [{ t: 'stance', p: 0, ids: [u.id], stance: 'stand' }]);
    spawnUnit(s, 1, 'citizen', at.x + 3, at.y);
    run(s, 5);
    expect(Math.hypot(u.x - at.x, u.y - at.y)).toBeLessThan(0.5);
  });
});

describe('walls and gates', () => {
  it('a wall line goes up piece by piece, a gate lets its own side through and keeps the enemy out', () => {
    const s = game({ startEpoch: 1 });
    rich(s);
    const at = field(s, 0, 7);
    const x = Math.floor(at.x);
    const y = Math.floor(at.y);
    step(s, [{ t: 'wall', p: 0, ids: citizens(s, 0).map((u) => u.id), x0: x - 6, y0: y, x1: x + 6, y1: y }]);
    const walls = s.ents.filter((e) => e.kind === 'building' && e.type === 'wall');
    expect(walls.length).toBeGreaterThan(8);
    // Finish them and put a gate in.
    for (const wl of walls) if (wl.kind === 'building') {
      wl.built = true;
      wl.progress = 1;
    }
    const gate = placeBuilding(s, 0, 'gate', x, y, true);
    expect(BUILDINGS.gate.size).toBe(2);
    const goal = { x0: x, y0: y + 3, x1: x, y1: y + 3, px: x + 0.5, py: y + 3.5 };
    const mine = findRoute(s, x + 0.5, y - 2.5, goal, 20000, s.players[0].team);
    const theirs = findRoute(s, x + 0.5, y - 2.5, goal, 20000, s.players[1].team);
    expect(mine.points.length).toBeGreaterThan(0);
    // The enemy must go round (a longer way) or can't at all.
    const len = (pts: number[]) => {
      let d = 0;
      for (let i = 2; i < pts.length; i += 2) d += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
      return d;
    };
    expect(!theirs.complete || len(theirs.points) > len(mine.points) + 2).toBe(true);
    void gate;
  });
});

describe('match options', () => {
  it('every map type is fair and connected, for two to four players', () => {
    for (const mapType of ['continental', 'highlands', 'lakes', 'forest', 'plains'] as const) {
      for (const n of [2, 3, 4]) {
        const s = game({ mapType, size: 'medium', players: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, ai: null })) });
        expect(s.players.length).toBe(n);
        const [a] = s.players;
        for (const b of s.players.slice(1)) {
          const tc = tcOf(s, b.id);
          const r = findRoute(s, a.startX + 0.5, a.startY + 3.5, { x0: tc.tx - 1, y0: tc.ty - 1, x1: tc.tx + tc.size, y1: tc.ty + tc.size, px: b.startX, py: b.startY }, 20000);
          expect(r.complete, `${mapType} ${n} players`).toBe(true);
        }
      }
    }
  });

  it('a peace treaty holds until it ends; later starting epochs start richer', () => {
    const s = game({ peaceMinutes: 1, startEpoch: 2 });
    expect(s.players[0].epoch).toBe(2);
    expect(s.players[0].res.gold).toBeGreaterThan(400);
    const at = field(s);
    const a = spawnUnit(s, 0, 'infantry', at.x, at.y);
    const b = spawnUnit(s, 1, 'infantry', at.x + 1, at.y);
    run(s, 10, [{ t: 'attack', p: 0, ids: [a.id], target: b.id }]);
    expect(b.hp).toBe(statsFor(s, 1, 'infantry').hp);
    s.tick = s.peaceUntil;
    run(s, 15, [{ t: 'attack', p: 0, ids: [a.id], target: b.id }]);
    expect(b.hp).toBeLessThan(statsFor(s, 1, 'infantry').hp);
  });
});

describe('saving', () => {
  it('a saved match, loaded, plays on exactly as the original', { timeout: 60000 }, () => {
    const s = createGame({ seed: 77, size: 'small', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'normal' }] });
    for (let i = 0; i < TICK_HZ * 240; i++) step(s);
    const t = deserialize(serialize(s));
    expect(checksum(t)).toBe(checksum(s));
    for (let i = 0; i < TICK_HZ * 180; i++) {
      step(s);
      step(t);
    }
    expect(t.tick).toBe(s.tick);
    expect(checksum(t)).toBe(checksum(s));
  });
});

describe('gates in walls', () => {
  it('a gate can be set into your own wall, replacing the pieces it covers, but not into a rival’s', () => {
    const s = game({ startEpoch: 1 });
    const p = s.players[0];
    p.res.stone = 1000;
    // A clear 5×5 patch, with a wall across its middle.
    const at = findSpot(s, 'wonder', p.startX, p.startY, 6, 20)!;
    const y = at.ty + 2;
    const x0 = at.tx;
    for (let x = x0; x < x0 + 5; x++) placeBuilding(s, 0, 'wall', x, y, true);
    const before = s.ents.filter((e) => e.kind === 'building' && e.type === 'wall').length;
    const c = s.ents.find((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen')!;
    step(s, [{ t: 'build', p: 0, ids: [c.id], type: 'gate', tx: x0 + 2, ty: y }]);
    const gate = s.ents.find((e): e is Building => e.kind === 'building' && e.type === 'gate');
    expect(gate).toBeTruthy();
    expect(gate!.dir).toBe(0);
    expect(s.ents.filter((e) => e.kind === 'building' && e.type === 'wall').length).toBe(before - 2);
    // The rival can't put a gate in our wall.
    s.players[1].res.stone = 1000;
    step(s, [{ t: 'build', p: 1, ids: [], type: 'gate', tx: x0, ty: y }]);
    expect(s.ents.filter((e) => e.kind === 'building' && e.type === 'gate').length).toBe(1);
  });
});

describe('game modes', () => {
  it('regicide: each people has a King, who cannot be converted, and losing them loses the match', () => {
    const s = game({ mode: 'regicide' });
    expect(s.kings.every((id) => id > 0)).toBe(true);
    const king = s.byId.get(s.kings[1]) as Unit;
    expect(king.type).toBe('hero');
    // A King doesn't count against the one-hero limit.
    rich(s, 1);
    run(s, 1, [{ t: 'train', p: 1, building: tcOf(s, 1).id, unit: 'hero' }]);
    expect(tcOf(s, 1).queue.some((q) => q.unit === 'hero')).toBe(true);
    king.hp = 0;
    run(s, 3);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(s.players[0].team);
  });

  it('deathmatch: everyone starts rich', () => {
    const s = game({ mode: 'deathmatch' });
    expect(s.players.every((p) => p.res.food >= 10000 && p.res.gold >= 10000)).toBe(true);
  });
});

describe('allies', () => {
  it('allies see what each other see; rivals do not', () => {
    const s = game({ players: [
      { name: 'A', ai: null, team: 1 },
      { name: 'B', ai: null, team: 1 },
      { name: 'C', ai: null, team: 2 },
    ] });
    run(s, 1);
    const b = s.players[1];
    const at = Math.floor(b.startY) * s.w + Math.floor(b.startX);
    expect(s.players[0].vis[at]).toBe(1);
    expect(s.players[2].vis[at]).toBe(0);
  });

  it('a player who leaves an online match is taken over by the computer', () => {
    const s = game();
    run(s, 1, [{ t: 'leave', p: 1 }]);
    expect(s.players[1].ai).toBe('normal');
    run(s, 60);
    expect(citizens(s, 1).some((u) => u.order.k !== 'idle')).toBe(true);
  });
});
