import { describe, expect, it } from 'vitest';
import { CORE, LODE, LODES, SHAFT, STRATA, secs } from '../src/sim/data';
import { applyCommand } from '../src/sim/commands';
import { createGame, step } from '../src/sim/game';
import { clearResource, placeProblem } from '../src/sim/grid';
import { findSpot } from '../src/sim/ai';
import { deserialize, serialize } from '../src/sim/save';
import { coreProblem, coresOf, kindOf, lodeAt, lodeOfSite, oreOf } from '../src/sim/lodes';
import { digShare, fallOf, seamOf, seamProblem, seamsAt, shaftShare, veinFull, veinLeft } from '../src/sim/shafts';
import { placeBuilding, spawnUnit } from '../src/sim/world';
import { R_GOLD, R_STONE, T_ROCK } from '../src/sim/types';
import type { Building, GameState, MapSize, MapType } from '../src/sim/types';

/** The deep mine m3 (#924, #931): the ground below differs by seed and place; core samples; the computer reads them. */

const MAPS: MapType[] = ['continental', 'highlands', 'lakes', 'forest', 'plains', 'sea'];

const game = (seed = 3, mapType: MapType = 'continental', size: MapSize = 'small'): GameState => {
  const s = createGame({ seed, size, mapType, players: [{ name: 'A', ai: null, civ: 'greeks' }, { name: 'B', ai: null, civ: 'greeks' }] });
  const p = s.players[0];
  p.age = 'bronze';
  p.epoch = 1;
  p.res = { food: 5000, wood: 5000, stone: 0, gold: 0 };
  return s;
};

const run = (s: GameState, sec: number) => {
  for (let i = 0; i < secs(sec); i++) step(s);
};

/** A free 2×2 site by player 0's start on plain earth, with room for a Storehouse beside it. */
function site(s: GameState): { tx: number; ty: number } {
  const p = s.players[0];
  const clear = (tx: number, ty: number) => {
    for (let y = ty - SHAFT.near; y < ty + 2 + SHAFT.near; y++)
      for (let x = tx - SHAFT.near; x < tx + 2 + SHAFT.near; x++) {
        const i = y * s.w + x;
        if (x < 0 || y < 0 || x >= s.w || y >= s.h || s.terrain[i] === T_ROCK || s.res[i] === R_STONE || s.res[i] === R_GOLD) return false;
      }
    return true;
  };
  const spot = findSpot(s, 'shaft', p.startX, p.startY, 6, 30, 1, (tx, ty) => clear(tx, ty) && !placeProblem(s, 'storehouse', tx + 3, ty, true, 0));
  if (!spot) throw new Error('no site');
  return spot;
}

/** A finished shaft by home with a Storehouse beside it, on the ground `code` (the patch under it is set to that lode). */
function mine(s: GameState, code: number, n: number, seam?: 'stone' | 'gold'): { b: Building; us: number[] } {
  const at = site(s);
  const cw = Math.ceil(s.w / LODE.cell);
  s.lodes![Math.floor((at.ty + 1) / LODE.cell) * cw + Math.floor((at.tx + 1) / LODE.cell)] = code;
  const b = placeBuilding(s, 0, 'shaft', at.tx, at.ty, true);
  placeBuilding(s, 0, 'storehouse', at.tx + 3, at.ty, true);
  if (seam) b.seam = seam;
  const us: number[] = [];
  for (let i = 0; i < n; i++) us.push(spawnUnit(s, 0, 'citizen', at.tx - 0.6, at.ty + 0.5 + i * 0.3).id);
  if (us.length) applyCommand(s, { t: 'work', p: 0, ids: us, target: b.id });
  return { b, us };
}

const kind = (name: string) => LODES.findIndex((k) => k.name === name);

describe('the ground below differs by seed and place (#924 m3)', () => {
  it('is laid from the match seed: the same seed lays the same ground, another seed other ground', () => {
    const a = game(5, 'continental', 'medium');
    const b = game(5, 'continental', 'medium');
    const c = game(6, 'continental', 'medium');
    expect(a.lodes).toBeInstanceOf(Uint8Array);
    expect([...a.lodes!]).toEqual([...b.lodes!]);
    expect([...a.lodes!]).not.toEqual([...c.lodes!]);
    expect(a.lodes!.length).toBe(Math.ceil(a.w / LODE.cell) * Math.ceil(a.h / LODE.cell));
  });

  it('never starved: every kind of ground holds stone and gold in layers 1 to 3 (rule 1)', () => {
    for (let k = 0; k < LODES.length; k++) {
      const stone = STRATA.slice(0, 3).some((_, l) => veinFull({ lode: k }, l, 'stone') > 0);
      const gold = STRATA.slice(0, 3).some((_, l) => veinFull({ lode: k }, l, 'gold') > 0);
      expect(stone && gold, LODES[k].name).toBe(true);
      expect(LODES[k].stone).toBeGreaterThan(0);
      expect(LODES[k].gold).toBeGreaterThan(0);
    }
  });

  it("never starved: every town's land is common ground, stone and gold below it, on every map type and seed (rule 1)", () => {
    // Small maps here; every size over more seeds in `tests/slow/deep-mine-strata-sweep.test.ts`.
    for (const size of ['small'] as MapSize[]) {
      for (const map of MAPS) {
        for (const seed of [1, 2, 3]) {
          const s = game(seed, map, size);
          expect(s.lodes, `${size} ${map} ${seed}`).toBeDefined();
          for (const p of s.players) {
            // Every tile within `LODE.home` of the start: common ground, with no rare seam either.
            for (let y = Math.floor(p.startY - LODE.home); y <= p.startY + LODE.home; y++) {
              for (let x = Math.floor(p.startX - LODE.home); x <= p.startX + LODE.home; x++) {
                if (x < 0 || y < 0 || x >= s.w || y >= s.h || (x + 0.5 - p.startX) * (x + 0.5 - p.startX) + (y + 0.5 - p.startY) * (y + 0.5 - p.startY) > LODE.home * LODE.home) continue;
                expect(lodeAt(s, x + 0.5, y + 0.5), `${size} ${map} ${seed} town ${p.id} at ${x},${y}`).toBe(0);
              }
            }
            // A shaft by the town digs both, and its layers hold both as the plain layers do.
            const spot = findSpot(s, 'shaft', p.startX, p.startY, 4, 12, 1, (tx, ty) => !placeProblem(s, 'shaft', tx, ty, true, p.id));
            expect(spot, `${size} ${map} ${seed} ${p.id}`).toBeTruthy();
            const b = placeBuilding(s, p.id, 'shaft', spot!.tx, spot!.ty, true);
            expect(b.lode).toBe(0);
            expect(seamsAt(s, b)).toEqual(expect.arrayContaining(['stone', 'gold']));
            for (let l = 0; l < 3; l++) for (const m of ['stone', 'gold'] as const) expect(veinFull(b, l, m)).toBe(STRATA[l].veins[m] ?? 0);
          }
        }
      }
    }
  });

  it('lays rich and poor ground out on the map, and rare seams only of ores the world holds', () => {
    const kinds = new Set<number>();
    let ores = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = game(seed, 'continental', 'medium');
      for (const code of s.lodes!) {
        kinds.add(kindOf(code));
        const ore = oreOf(code);
        if (!ore) continue;
        ores++;
        expect(s.rares).toContain(ore);
        expect(ore).not.toBe('glowcap');
      }
    }
    expect(kinds.size).toBeGreaterThanOrEqual(5);
    expect(kinds.has(kind('A gold reef'))).toBe(true);
    expect(kinds.has(kind('Poor ground'))).toBe(true);
    expect(ores).toBeGreaterThan(0);
  });

  it('a shaft keeps the lode under it; a gold reef holds more gold and digs it faster, poor ground less', () => {
    const s = game();
    const reef = kind('A gold reef');
    const { b } = mine(s, reef, 0);
    expect(b.lode).toBe(reef);
    expect(lodeOfSite(s, b)).toBe(reef);
    expect(veinFull(b, 2, 'gold')).toBe(Math.round((STRATA[2].veins.gold ?? 0) * LODES[reef].gold));
    expect(veinFull(b, 2, 'gold')).toBeGreaterThan(STRATA[2].veins.gold!);
    b.depth = 2;
    b.propped = [false, true, true];
    expect(digShare(s, b, 'gold', 2)).toBeCloseTo(SHAFT.grade.open + STRATA[2].add + LODES[reef].add);
    const poor = { ...b, lode: kind('Poor ground') };
    expect(veinFull(poor, 2, 'gold')).toBeLessThan(STRATA[2].veins.gold!);
  });

  it('a spent layer of poor ground still digs at the plain grade (rule 1)', () => {
    const s = game();
    const { b } = mine(s, kind('Poor ground'), 2, 'stone');
    const full = veinFull(b, 0, 'stone');
    expect(full).toBeLessThan(STRATA[0].veins.stone!);
    b.worked = [{ stone: full }];
    expect(veinLeft(b, 0, 'stone')).toBe(0);
    expect(digShare(s, b, 'stone', 0)).toBe(shaftShare(s, b, 'stone'));
    expect(digShare(s, b, 'stone', 0)).toBeGreaterThanOrEqual(SHAFT.grade.open);
    const stone0 = s.players[0].res.stone;
    run(s, 120);
    expect(s.players[0].res.stone - stone0).toBeGreaterThan(5);
  });

  it('sound rock holds its roof better than common ground, shattered ground worse', () => {
    const at = (name: string) => fallOf({ lode: kind(name) }, 1);
    expect(at('Common ground')).toBe(STRATA[1].fall);
    expect(at('Sound rock')).toBeLessThan(STRATA[1].fall);
    expect(at('Shattered ground')).toBeGreaterThan(STRATA[1].fall);
    expect(fallOf({ lode: kind('Sound rock') }, 0)).toBe(0);
  });

  it('a rare seam the ground holds is dug in its one layer, once the shaft reaches it, and only while it lasts', () => {
    const s = game();
    s.rares = ['salt'];
    const salt = 0 + 16 * 1;
    expect(oreOf(salt)).toBe('salt');
    const { b, us } = mine(s, salt, 1, 'stone');
    expect(seamsAt(s, b)).toContain('salt');
    // Not yet sunk to its layer: refused, and the shaft digs stone meanwhile.
    expect(seamProblem(s, b, 'salt')).toMatch(/sink/);
    applyCommand(s, { t: 'seam', p: 0, building: b.id, seam: 'salt' });
    expect(seamOf(s, b)).toBe('stone');
    b.depth = LODE.oreLayer;
    b.propped = [false, true, true];
    expect(seamProblem(s, b, 'salt')).toBeNull();
    applyCommand(s, { t: 'seam', p: 0, building: b.id, seam: 'salt' });
    expect(seamOf(s, b)).toBe('salt');
    expect(veinFull(b, LODE.oreLayer, 'salt')).toBe(LODE.oreVein);
    expect(digShare(s, b, 'salt', 0)).toBe(0);
    expect(digShare(s, b, 'salt', LODE.oreLayer)).toBeGreaterThan(0);
    run(s, 90);
    const u = s.byId.get(us[0])!;
    expect(u.kind === 'unit' && u.order.k === 'shaft' && u.order.layer).toBe(LODE.oreLayer);
    expect(veinLeft(b, LODE.oreLayer, 'salt')).toBeLessThan(LODE.oreVein);
    // Dug out: the shaft goes back to the best of its own ground.
    b.worked![LODE.oreLayer].salt = LODE.oreVein;
    expect(seamOf(s, b)).not.toBe('salt');
    expect(seamProblem(s, b, 'salt')).toMatch(/dug out/);
  });
});

describe('core samples (#924 m3)', () => {
  function lodge(s: GameState): Building {
    const p = s.players[0];
    const spot = findSpot(s, 'prospector', p.startX, p.startY, 4, 14, 1)!;
    return placeBuilding(s, 0, 'prospector', spot.tx, spot.ty, true);
  }

  it('a Lodge drills a core at seen ground, paid, ready after a while, and it reads the lode there', () => {
    const s = game(4, 'continental', 'medium');
    const p = s.players[0];
    const l = lodge(s);
    // A spot out on the map, seen, off home ground.
    const cw = Math.ceil(s.w / LODE.cell);
    let x = -1;
    let y = -1;
    for (let i = 0; i < s.lodes!.length && x < 0; i++) {
      if (!s.lodes![i]) continue;
      x = (i % cw) * LODE.cell + 1.5;
      y = Math.floor(i / cw) * LODE.cell + 1.5;
    }
    expect(x).toBeGreaterThan(0);
    // Unseen ground is refused, and costs nothing.
    const wood0 = p.res.wood;
    applyCommand(s, { t: 'core', p: 0, building: l.id, x, y });
    expect(p.cores ?? []).toHaveLength(0);
    expect(p.res.wood).toBe(wood0);
    p.seen[Math.floor(y) * s.w + Math.floor(x)] = 1;
    applyCommand(s, { t: 'core', p: 0, building: l.id, x, y });
    expect(p.cores).toHaveLength(1);
    expect(p.res.wood).toBe(wood0 - (CORE.cost.wood ?? 0));
    expect(p.res.food).toBe(5000 - (CORE.cost.food ?? 0));
    expect(p.cores![0].lode).toBe(lodeAt(s, x, y));
    expect(p.cores![0].lode).not.toBe(0);
    // One at a time: a second order while it drills is refused.
    expect(coreProblem(s, 0, l, p.startX, p.startY)).toMatch(/drilling/);
    expect(coresOf(s, 0)).toHaveLength(0);
    run(s, CORE.time + 1);
    expect(coresOf(s, 0)).toHaveLength(1);
    // Not twice in the same spot; another people's lodge, or no lodge, draws nothing.
    expect(coreProblem(s, 0, l, x, y)).toMatch(/already/);
    expect(coreProblem(s, 1, l, p.startX, p.startY)).toMatch(/Lodge/);
    const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter');
    expect(coreProblem(s, 0, tc, p.startX, p.startY)).toMatch(/Lodge/);
  });

  it('a people keeps its latest cores, and they and the ground below come through a save', () => {
    const s = game();
    const p = s.players[0];
    const l = lodge(s);
    p.seen.fill(1);
    for (let k = 0; k < CORE.most + 2; k++) {
      applyCommand(s, { t: 'core', p: 0, building: l.id, x: 2.5 + (k % 8) * 5, y: 2.5 + Math.floor(k / 8) * 5 });
      run(s, CORE.time + 1);
    }
    expect(p.cores).toHaveLength(CORE.most);
    expect(p.cores![0].tile).toBe(Math.floor(2.5 + 0 * 5) * s.w + Math.floor(2.5 + 2 * 5));
    const { b } = mine(s, kind('Building stone'), 0);
    const t = deserialize(serialize(s));
    expect([...t.lodes!]).toEqual([...s.lodes!]);
    expect(t.players[0].cores).toEqual(p.cores);
    expect((t.byId.get(b.id) as Building).lode).toBe(kind('Building stone'));
  });

  it('an older save, with no ground below and no lode on its shafts, digs as common ground', () => {
    const s = game();
    const { b } = mine(s, kind('A gold reef'), 1, 'stone');
    delete s.lodes;
    delete b.lode;
    const t = deserialize(serialize(s));
    const b2 = t.byId.get(b.id) as Building;
    expect(lodeAt(t, b2.x, b2.y)).toBe(0);
    for (let l = 0; l < STRATA.length; l++) expect(veinFull(b2, l, 'gold')).toBe(STRATA[l].veins.gold ?? 0);
    const stone0 = t.players[0].res.stone;
    for (let i = 0; i < secs(60); i++) step(t);
    expect(t.players[0].res.stone - stone0).toBeGreaterThan(5);
  });
});

describe('the computer reads the ground below (#924 m3)', () => {
  it('drills cores from its Lodge, and sinks its shaft on the rich ground a core showed', () => {
    const s = createGame({ seed: 2, size: 'medium', players: [{ name: 'A', ai: 'hard', civ: 'greeks' }, { name: 'B', ai: null, civ: 'greeks' }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    p.age = 'bronze';
    p.epoch = 1;
    p.res = { food: 3000, wood: 3000, stone: 0, gold: 0 };
    p.seen.fill(1);
    for (let i = 0; i < 24; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
    placeBuilding(s, 0, 'storehouse', p.startX + 5, p.startY + 5, true);
    const home = findSpot(s, 'prospector', p.startX, p.startY, 5, 14, 1)!;
    const l = placeBuilding(s, 0, 'prospector', home.tx, home.ty, true);
    for (let i = 0; i < s.res.length; i++) if (s.res[i] === R_STONE || s.res[i] === R_GOLD) clearResource(s, i);
    // A gold reef out past home ground, already cored.
    const reef = kind('A gold reef');
    const out = findSpot(s, 'shaft', p.startX, p.startY, LODE.home + 6, CORE.aiReach - 6, 1, (tx, ty) => !placeProblem(s, 'shaft', tx, ty, true, 0))!;
    expect(out).toBeTruthy();
    const cw = Math.ceil(s.w / LODE.cell);
    s.lodes![Math.floor((out.ty + 1) / LODE.cell) * cw + Math.floor((out.tx + 1) / LODE.cell)] = reef;
    p.cores = [{ tile: (out.ty + 1) * s.w + out.tx + 1, lode: reef, by: l.id, at: 0 }];
    s.tick = secs(600);
    s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: {} };
    const shaft = () => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'shaft');
    for (let i = 0; i < secs(300) && !s.over && !shaft(); i++) step(s);
    expect(shaft()).toBeTruthy();
    expect(shaft()!.lode).toBe(reef);
    // And it drills more cores of its own round home.
    for (let i = 0; i < secs(120); i++) step(s);
    expect(p.cores!.length).toBeGreaterThan(1);
  });
});
