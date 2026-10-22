import { describe, expect, it } from 'vitest';
import { BUILDINGS, ROADS, TECHS, secs } from '../src/sim/data';
import { findsOf, holds, keyOf, lacking, opensOf, prospected, roadKnown, roadProblem } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';
import { generateMap } from '../src/sim/mapgen';
import { findSpot } from '../src/sim/ai';
import { deserialize, serialize } from '../src/sim/save';
import { techProblem } from '../src/sim/stats';
import type { Building, GameEvent, GameState, Unit } from '../src/sim/types';
import { KEYS } from '../src/sim/types';

// The age road s1 (#562, docs/age-roads.md spine §4): the Prospector's Lodge, level 1, in place of Survey the Land.
const setup = (seed: number) => ({ seed, size: 'small' as const, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
const seeds = (() => {
  const yes: number[] = [];
  const no: number[] = [];
  for (let seed = 1; yes.length < 2 || no.length < 2; seed++) (generateMap(seed, 'small', 2).bogIron ? yes : no).push(seed);
  return { yes, no };
})();
const ironRoad = ROADS.find((r) => r.to === 'iron')!;
const mine = (s: GameState, type: Building['type']) => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === type);

/** Citizens raise a lodge by the Town Center, the way a player orders it; returns the events seen. */
const raise = (s: GameState): GameEvent[] => {
  const p = s.players[0];
  p.res = { food: 500, wood: 500, stone: 0, gold: 0 };
  const spot = findSpot(s, 'prospector', p.startX, p.startY, 4, 14)!;
  const ids = s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen').map((u) => u.id);
  const seen: GameEvent[] = [];
  const had = mine(s, 'prospector').length;
  step(s, [{ t: 'build', p: 0, ids, type: 'prospector', tx: spot.tx, ty: spot.ty }]);
  for (let i = 0; i < secs(BUILDINGS.prospector.time + 40) && mine(s, 'prospector').filter((b) => b.built).length <= had; i++) {
    step(s);
    seen.push(...s.events);
  }
  for (let i = 0; i < 2; i++) {
    step(s);
    seen.push(...s.events);
  }
  return seen;
};

describe("the Prospector's Lodge (#562)", () => {
  it('is raised in the Stone Age for food and wood, from the economy menu', () => {
    const b = BUILDINGS.prospector;
    expect(b.epoch).toBe(0);
    expect(b.cost).toEqual({ food: 50, wood: 75 });
    expect(b.menu).toBe('eco');
    const keys = (Object.keys(BUILDINGS) as Building['type'][]).filter((t) => BUILDINGS[t].menu === 'eco' && t !== 'prospector').map((t) => BUILDINGS[t].key);
    expect(keys).not.toContain(b.key);
  });

  it('answers yes or no for every key resource once it stands, and opens the iron road on a bog world', () => {
    const s = createGame(setup(seeds.yes[0]));
    const p = s.players[0];
    expect(prospected(p)).toBe(false);
    expect(roadKnown(s, p, ironRoad)).toBe(false);
    const seen = raise(s);
    expect(mine(s, 'prospector').some((b) => b.built)).toBe(true);
    const told = seen.filter((e) => e.k === 'prospect' && e.owner === 0);
    expect(told).toHaveLength(1);
    expect(told[0]).toMatchObject({ finds: findsOf(s) });
    expect(findsOf(s)).toContain('bogIron');
    expect(prospected(p)).toBe(true);
    expect(roadKnown(s, p, ironRoad)).toBe(true);
    expect(roadProblem(s, p, ironRoad)).toContain(`0/${ironRoad.deed!.n}`);
    // Only its owner learns: the rival still knows nothing.
    expect(prospected(s.players[1])).toBe(false);
  });

  it('on a world with no bog iron keeps the iron road shut, and says so for the age', () => {
    const s = createGame(setup(seeds.no[0]));
    const p = s.players[0];
    expect(lacking(s, p, 'iron')).toEqual([]);
    raise(s);
    expect(roadKnown(s, p, ironRoad)).toBe(false);
    expect(roadProblem(s, p, ironRoad)).toBe('There is none in this world');
    expect(lacking(s, p, 'iron')).toEqual([{ key: 'bogIron', only: true }]);
  });

  it('reports each key resource by the seed: bog iron, the rare ores, and ruins', () => {
    for (const seed of [...seeds.yes, ...seeds.no]) {
      const s = createGame(setup(seed));
      expect(holds(s, 'bogIron')).toBe(s.bogIron === true);
      for (const ore of ['salt', 'saltpetre', 'bloodiron'] as const) expect(holds(s, ore)).toBe(!!s.rares?.includes(ore));
      expect(holds(s, 'ruin')).toBe(!!s.ruins?.length);
      expect(findsOf(s)).toEqual(KEYS.filter((k) => holds(s, k)));
    }
  });

  it('names what each key resource opens: the only roads, the shortcuts and the crafts', () => {
    expect(opensOf('bogIron').only).toContain('iron');
    expect(opensOf('ruin').only).toContain('reclaimer');
    expect(opensOf('salt').shortcut).toContain('merchant');
    expect(keyOf(ironRoad)).toEqual({ key: 'bogIron', only: true });
    for (const k of KEYS) {
      const o = opensOf(k);
      expect(o.only.length + o.shortcut.length + o.techs.length, `${k} opens nothing`).toBeGreaterThan(0);
    }
  });

  it('marks a shortcut lost, not a road shut, where the world lacks a shortcut ore', () => {
    let seed = 1;
    while (createGame(setup(seed)).rares?.includes('salt')) seed++;
    const s = createGame(setup(seed));
    const p = s.players[0];
    p.techs.push('survey');
    expect(lacking(s, p, 'merchant')).toEqual([{ key: 'salt', only: false }]);
  });

  it('tells once: a second lodge adds nothing', () => {
    const s = createGame(setup(seeds.yes[0]));
    raise(s);
    const seen = raise(s);
    expect(mine(s, 'prospector').filter((b) => b.built)).toHaveLength(2);
    expect(seen.filter((e) => e.k === 'prospect')).toHaveLength(0);
    expect(s.players[0].techs.filter((t) => t === 'survey')).toHaveLength(1);
  });

  it('retires Survey the Land from the Storehouse, while a save that holds it still knows', () => {
    expect(TECHS.survey.legacy).toBe(true);
    const s = createGame(setup(seeds.yes[0]));
    s.players[0].techs.push('survey');
    const back = deserialize(serialize(s));
    expect(prospected(back.players[0])).toBe(true);
    expect(roadKnown(back, back.players[0], ironRoad)).toBe(true);
    expect(techProblem(back, 0, 'survey')).toBe('Already researched');
  });
});
