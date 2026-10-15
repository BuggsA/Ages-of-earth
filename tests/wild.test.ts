import { describe, expect, it } from 'vitest';
import { AMOUNT, MAMMOTH, TICK_HZ, WOLF, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { walkable } from '../src/sim/grid';
import { generateMap } from '../src/sim/mapgen';
import { spawnAnimal } from '../src/sim/animals';
import type { Animal, Command, GameState, Unit } from '../src/sim/types';
import { R_MEAT, R_NONE } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/** The wild (#171): mammoths that fight back, wolf packs by their dens. */

const game = (seed = 11, ai: 'normal' | null = null): GameState =>
  createGame({ seed, size: 'small', players: [{ name: 'A', ai, civ: 'romans' }, { name: 'B', ai, civ: 'romans' }] });

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < seconds * TICK_HZ && !s.over; i++) step(s);
};

/** An empty game with an open meadow far from both towns, the wild cleared away. */
function meadow(seed = 11): { s: GameState; x: number; y: number } {
  const s = game(seed);
  s.animals = [];
  for (let y = 8; y < s.h - 8; y++) {
    for (let x = 8; x < s.w - 8; x++) {
      if (s.players.some((p) => Math.hypot(x - p.startX, y - p.startY) < 18)) continue;
      let open = true;
      for (let dy = -4; dy <= 4 && open; dy++) for (let dx = -4; dx <= 4 && open; dx++) open = walkable(s, x + dx, y + dy) && s.res[(y + dy) * s.w + x + dx] === R_NONE;
      if (open) return { s, x: x + 0.5, y: y + 0.5 };
    }
  }
  throw new Error('no meadow');
}

const alive = (s: GameState, u: Unit) => s.byId.has(u.id) && u.hp > 0;
const beasts = (s: GameState, kind: Animal['kind']) => s.animals.filter((a) => a.kind === kind);

describe('the wild on the map', () => {
  it('puts a mammoth out from every town, nearer it than any other, and wolf dens well away', () => {
    for (const players of [2, 3, 4]) {
      for (const seed of [3, 8, 21]) {
        const m = generateMap(seed, 'medium', players);
        const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
        for (const st of m.starts) {
          const own = m.wild.filter((b) => b.kind === 'mammoth' && Math.abs(dist(b, st) - MAMMOTH.home) <= 2 && m.starts.every((o) => o === st || dist(b, o) > dist(b, st)));
          expect(own.length).toBeGreaterThanOrEqual(1);
        }
        const wolves = m.wild.filter((b) => b.kind === 'wolf');
        expect(wolves.length).toBeGreaterThan(0);
        expect(wolves.length % WOLF.pack).toBe(0);
        for (const w of wolves) for (const st of m.starts) expect(dist(w, st)).toBeGreaterThan(WOLF.home - 2);
      }
    }
  });

  it('is the same from the same seed, touches no tile, and stays out of campaign chapters', () => {
    const a = generateMap(5, 'medium', 3);
    const b = generateMap(5, 'medium', 3);
    expect(a.wild).toEqual(b.wild);
    expect(a.res).toEqual(b.res);
    expect(generateMap(5, 'medium', 3, 'continental', false).wild).toEqual([]);
    const s = createGame({ seed: 1, size: 'small', players: [{ name: 'A', ai: null, civ: 'romans' }], scenario: 'first-fires' });
    expect(s.animals.every((x) => x.kind === 'deer')).toBe(true);
    const g = game();
    expect(beasts(g, 'mammoth').length).toBeGreaterThanOrEqual(2);
    expect(beasts(g, 'wolf').length).toBeGreaterThanOrEqual(WOLF.pack);
  });
});

describe('mammoths', () => {
  it('turn on whoever spears them, gore, and calm down once left alone', () => {
    const { s, x, y } = meadow();
    const m = spawnAnimal(s, x, y, 'mammoth');
    const u = spawnUnit(s, 0, 'citizen', x + 3, y);
    run(s, 2, [{ t: 'hunt', p: 0, ids: [u.id], target: m.id }]);
    expect(m.hp).toBeLessThan(MAMMOTH.hp);
    expect(m.state).toBe('fight');
    expect(m.foe).toBe(u.id);
    // Run for it: the mammoth chases and gores.
    const full = u.hp;
    let gored = 0;
    step(s, [{ t: 'move', p: 0, ids: [u.id], x: x + 8, y }]);
    for (let i = 0; i < secs(6); i++) {
      step(s);
      gored += s.events.filter((e) => e.k === 'wildStrike' && e.target === u.id).length;
    }
    expect(gored).toBeGreaterThan(0);
    expect(!alive(s, u) || u.hp < full).toBe(true);
    run(s, MAMMOTH.rage + 25);
    expect(m.state).not.toBe('fight');
  });

  it('kill a lone hunter, but fall to a party of five and leave a great carcass', () => {
    const { s, x, y } = meadow();
    const m = spawnAnimal(s, x, y, 'mammoth');
    const lone = spawnUnit(s, 0, 'citizen', x + 3, y);
    run(s, 40, [{ t: 'hunt', p: 0, ids: [lone.id], target: m.id }]);
    expect(alive(s, lone)).toBe(false);

    const t = meadow();
    const m2 = spawnAnimal(t.s, t.x, t.y, 'mammoth');
    const party = [0, 1, 2, 3, 4].map((k) => spawnUnit(t.s, 0, 'citizen', t.x + 3, t.y - 2 + k));
    run(t.s, 30, [{ t: 'hunt', p: 0, ids: party.map((u) => u.id), target: m2.id }]);
    expect(t.s.animals.includes(m2)).toBe(false);
    expect(party.filter((u) => alive(t.s, u)).length).toBeGreaterThanOrEqual(4);
    const meat = t.s.amount.reduce((best, a, i) => (t.s.res[i] === R_MEAT ? Math.max(best, a) : best), 0);
    expect(meat).toBeGreaterThan(AMOUNT.meat * 2);
    expect(party.some((u) => u.order.k === 'gather')).toBe(true);
  });
});

describe('wolves', () => {
  it('fall on a citizen who wanders near the den, as a pack, and kill them', () => {
    const { s, x, y } = meadow();
    const pack = [0, 1, 2].map((k) => spawnAnimal(s, x + k * 0.6, y, 'wolf'));
    const u = spawnUnit(s, 0, 'citizen', x + 4, y + 2);
    run(s, 2);
    expect(pack.every((w) => w.state === 'fight' && w.foe === u.id)).toBe(true);
    run(s, 25);
    expect(alive(s, u)).toBe(false);
    // And then they go home.
    run(s, 25);
    for (const w of s.animals) expect(Math.hypot(w.x - w.homeX, w.y - w.homeY)).toBeLessThan(WOLF.roam + 1);
  });

  it('chase no further than their leash', () => {
    const { s, x, y } = meadow();
    const w = spawnAnimal(s, x, y, 'wolf');
    const scout = spawnUnit(s, 0, 'cavalry', x + 4, y);
    run(s, 1);
    expect(w.state).toBe('fight');
    let far = 0;
    run(s, 0.05, [{ t: 'move', p: 0, ids: [scout.id], x: x + 30, y }]);
    for (let i = 0; i < secs(20); i++) {
      step(s);
      far = Math.max(far, Math.hypot(w.x - w.homeX, w.y - w.homeY));
    }
    expect(far).toBeLessThanOrEqual(WOLF.leash + 1);
    expect(w.state).not.toBe('fight');
  });

  it('are cleared by a couple of soldiers sent after them, and leave nothing to eat', () => {
    const { s, x, y } = meadow();
    const pack = [0, 1, 2].map((k) => spawnAnimal(s, x + k * 0.6, y, 'wolf'));
    const men = [0, 1].map((k) => spawnUnit(s, 0, 'infantry', x + 8, y + k));
    const cmds: Command[] = [{ t: 'hunt', p: 0, ids: men.map((u) => u.id), target: pack[0].id }];
    for (let k = 0; k < 6 && beasts(s, 'wolf').length; k++) {
      run(s, 8, beasts(s, 'wolf').length ? cmds : []);
      const next = beasts(s, 'wolf')[0];
      if (next) cmds[0] = { t: 'hunt', p: 0, ids: men.filter((u) => alive(s, u)).map((u) => u.id), target: next.id };
    }
    expect(beasts(s, 'wolf')).toEqual([]);
    expect(men.every((u) => alive(s, u))).toBe(true);
    expect(s.res.some((r) => r === R_MEAT)).toBe(false);
  });

  it('a bitten citizen at work fights back, then goes back to work', () => {
    const { s, x, y } = meadow();
    const w = spawnAnimal(s, x, y, 'wolf');
    w.hp = 4;
    const band = [0, 1, 2].map((k) => spawnUnit(s, 0, 'citizen', x + 3, y + k - 1));
    // Put them to work somewhere (a far tree): they walk past the den.
    const tree = s.res.findIndex((r, i) => r !== R_NONE && Math.hypot((i % s.w) - x, Math.floor(i / s.w) - y) < 40);
    expect(tree).toBeGreaterThanOrEqual(0);
    run(s, 0.05, [{ t: 'gather', p: 0, ids: band.map((u) => u.id), tile: tree }]);
    let fought = false;
    for (let i = 0; i < secs(15) && s.animals.includes(w); i++) {
      step(s);
      if (band.some((u) => u.order.k === 'hunt')) fought = true;
    }
    expect(fought).toBe(true);
    expect(s.animals.includes(w)).toBe(false);
    run(s, 2);
    expect(band.filter((u) => alive(s, u)).every((u) => u.order.k === 'gather')).toBe(true);
  });
});

describe('the computer and the wild', () => {
  it('sends a hunting party after its mammoth', () => {
    const s = game(4, 'normal');
    const near = (p: number) => beasts(s, 'mammoth').find((m) => Math.hypot(m.x - s.players[p].startX, m.y - s.players[p].startY) < MAMMOTH.home + 3)!;
    const mine = near(0);
    expect(mine).toBeDefined();
    let party = 0;
    for (let i = 0; i < secs(150) && s.animals.includes(mine); i++) {
      step(s);
      party = Math.max(party, s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.order.k === 'hunt' && e.order.target === mine.id).length);
    }
    expect(party).toBeGreaterThanOrEqual(3);
    expect(s.animals.includes(mine)).toBe(false);
  });
});

describe('the computer and a far mammoth', () => {
  it('hunts a far mammoth with soldiers along, but not with a rival by it or no soldiers to spare', () => {
    let id = 0;
    const mk = (soldiers: number) => {
      const s = game(4, 'normal');
      for (const a of s.animals) if (a.kind === 'mammoth') a.hp = 0;
      s.animals = s.animals.filter((a) => a.hp > 0);
      const b = s.players[1];
      s.peaceUntil = 0;
      for (let i = 0; i < 12; i++) spawnUnit(s, 1, 'citizen', b.startX + 3, b.startY - 3 - i * 0.4);
      const at = { x: b.startX + (s.players[0].startX > b.startX ? 30 : -30), y: b.startY };
      id = spawnAnimal(s, at.x, at.y, 'mammoth').id;
      for (let i = 0; i < soldiers; i++) spawnUnit(s, 1, 'infantry', b.startX + 2, b.startY + 2 + i * 0.5);
      return { s, at };
    };
    const hunters = (s: GameState) => s.ents.filter((e) => e.kind === 'unit' && e.owner === 1 && e.order.k === 'hunt' && e.order.target === id);
    const a = mk(6);
    let escorted = false;
    for (let i = 0; i < secs(120); i++) {
      step(a.s);
      if (hunters(a.s).some((u) => u.kind === 'unit' && u.type === 'infantry')) escorted = true;
    }
    expect(escorted).toBe(true);
    const b = mk(1);
    let went = false;
    for (let i = 0; i < secs(120); i++) {
      step(b.s);
      if (hunters(b.s).length) went = true;
    }
    expect(went).toBe(false);
  });
});
