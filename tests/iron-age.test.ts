import { describe, expect, it } from 'vitest';
import { ageOf, barred, mainRoad, roadKnown, roadProblem, roadTo, roadsFrom } from '../src/sim/ages';
import { AMOUNT, BOG_IRON, EPOCHS, ROADS, TECHS, secs, unitStats } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { generateMap } from '../src/sim/mapgen';
import { deserialize, serialize } from '../src/sim/save';
import { statsFor, trainCostFor } from '../src/sim/stats';
import type { AgeId, Building, Command, GameState, Unit } from '../src/sim/types';
import { R_BOG, R_NONE } from '../src/sim/types';
import { findSpot } from '../src/sim/ai';
import { placeBuilding } from '../src/sim/world';

/** The Iron Age (#39): bog iron on some seeds, a survey that answers yes or no, and a side age from the Stone Age. */

const setup = (seed: number) => ({ seed, size: 'small' as const, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
const game = (seed: number): GameState => createGame(setup(seed));
/** The first seeds whose small two-player worlds hold bog iron, and hold none. */
const seeds = (() => {
  const yes: number[] = [];
  const no: number[] = [];
  for (let seed = 1; yes.length < 3 || no.length < 3; seed++) (generateMap(seed, 'small', 2).bogIron ? yes : no).push(seed);
  return { yes, no };
})();

const run = (s: GameState, seconds: number, cmds: Command[] = []) => {
  step(s, cmds);
  for (let i = 1; i < secs(seconds); i++) step(s);
};
const rich = (s: GameState) => (s.players[0].res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 });
const mine = <T extends Building['type']>(s: GameState, type: T) =>
  s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === type);
const tc = (s: GameState) => mine(s, 'towncenter')!;
const citizens = (s: GameState) => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'citizen');
/** Research the survey at the Town Center's side (a Storehouse is placed for it). */
const survey = (s: GameState) => {
  rich(s);
  const p = s.players[0];
  // A finished Storehouse right by the Town Center, as a citizen would leave it.
  const store = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'storehouse');
  if (!store) {
    const spot = findSpot(s, 'storehouse', p.startX, p.startY, 4, 20)!;
    placeBuilding(s, 0, 'storehouse', spot.tx, spot.ty, true);
  }
  const events: { found: boolean }[] = [];
  step(s, [{ t: 'research', p: 0, building: mine(s, 'storehouse')!.id, tech: 'survey' }]);
  for (let i = 0; i < secs(TECHS.survey.time) + 2; i++) {
    step(s);
    for (const ev of s.events) if (ev.k === 'survey' && ev.owner === 0) events.push(ev);
  }
  expect(p.techs).toContain('survey');
  return events;
};
const ironRoad = ROADS.find((r) => r.to === 'iron')!;
const advance = (s: GameState, to?: AgeId) => {
  const road = roadTo(s.players[0], to)!;
  run(s, road.time + 1, [{ t: 'advance', p: 0, building: tc(s).id, to }]);
};

describe('bog iron and the Iron Age (#39)', () => {
  it('lies in some worlds and not others, decided by the seed alone', () => {
    let yes = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const a = generateMap(seed, 'small', 2);
      const b = generateMap(seed, 'small', 2);
      expect(b.bogIron).toBe(a.bogIron);
      expect(b.res).toEqual(a.res);
      const tiles = a.res.filter((r) => r === R_BOG).length;
      expect(tiles > 0).toBe(a.bogIron);
      if (a.bogIron) yes++;
    }
    // About half (BOG_IRON.chance), and never all or none.
    expect(yes).toBeGreaterThan(8);
    expect(yes).toBeLessThan(32);
  });

  it('changes nothing else: without it a world is the same map, with it only empty ground turns to ore', () => {
    for (const seed of [...seeds.yes, ...seeds.no]) {
      const with_ = generateMap(seed, 'medium', 3, 'lakes');
      const without = generateMap(seed, 'medium', 3, 'lakes', false);
      expect(without.bogIron).toBe(false);
      expect(with_.terrain).toEqual(without.terrain);
      for (let i = 0; i < with_.res.length; i++) {
        if (with_.res[i] === without.res[i]) continue;
        expect(without.res[i]).toBe(R_NONE);
        expect(with_.res[i]).toBe(R_BOG);
        expect(with_.amount[i]).toBe(AMOUNT.bog);
      }
      expect(with_.deer).toEqual(without.deer);
      expect(with_.relics).toEqual(without.relics);
      expect(with_.posts).toEqual(without.posts);
    }
  });

  it('gives every town the same patch, the same way out, nearer it than any other', () => {
    for (const players of [2, 3, 4]) {
      for (let seed = 1, found = 0; found < 4; seed++) {
        const m = generateMap(seed, 'medium', players);
        if (!m.bogIron) continue;
        found++;
        const near = m.starts.map(() => 0);
        for (let i = 0; i < m.res.length; i++) {
          if (m.res[i] !== R_BOG) continue;
          const x = (i % m.w) + 0.5;
          const y = Math.floor(i / m.w) + 0.5;
          const ds = m.starts.map((st) => Math.sqrt((x - st.x) * (x - st.x) + (y - st.y) * (y - st.y)));
          const k = ds.indexOf(Math.min(...ds));
          near[k]++;
          expect(Math.abs(ds[k] - BOG_IRON.home)).toBeLessThan(BOG_IRON.home / 3);
        }
        expect(near, `seed ${seed}, ${players} players`).toEqual(m.starts.map(() => BOG_IRON.tiles));
      }
    }
  });

  it('keeps campaign maps as they were made', () => {
    const s = createGame({ ...setup(seeds.yes[0]), scenario: 'c1' });
    expect(s.bogIron).toBe(false);
    expect(s.res.some((r) => r === R_BOG)).toBe(false);
  });

  it('a survey answers yes, and the road to the Iron Age comes into view', () => {
    const s = game(seeds.yes[0]);
    const p = s.players[0];
    expect(s.bogIron).toBe(true);
    expect(roadKnown(s, p, ironRoad)).toBe(false);
    expect(roadProblem(s, p, ironRoad)).toBe('Needs Survey the Land');
    expect(survey(s)).toEqual([expect.objectContaining({ found: true })]);
    expect(roadKnown(s, p, ironRoad)).toBe(true);
    expect(roadProblem(s, p, ironRoad)).toContain(`0/${ironRoad.deed!.n}`);
    // The plain advance still takes the trunk.
    expect(mainRoad(p)!.to).toBe('bronze');
  });

  it('a survey that answers no hides the road for good', () => {
    const s = game(seeds.no[0]);
    const p = s.players[0];
    expect(s.bogIron).toBe(false);
    expect(survey(s)).toEqual([expect.objectContaining({ found: false })]);
    expect(roadKnown(s, p, ironRoad)).toBe(false);
    expect(roadProblem(s, p, ironRoad)).toBe('There is none in this world');
    // Even a deed met some other way opens nothing.
    p.stats.iron = 999;
    run(s, 1, [{ t: 'advance', p: 0, building: tc(s).id, to: 'iron' }]);
    expect(tc(s).advance).toBe(-1);
    expect(ageOf(p)).toBe('stone');
    expect(roadsFrom(p).filter((r) => roadKnown(s, p, r)).map((r) => r.to)).toEqual(['bronze']);
  });

  it('citizens dig bog iron as gold, and the digging counts toward the deed', () => {
    const s = game(seeds.yes[0]);
    const p = s.players[0];
    const home = (i: number) => {
      const x = (i % s.w) + 0.5 - p.startX;
      const y = Math.floor(i / s.w) + 0.5 - p.startY;
      return x * x + y * y;
    };
    let tile = -1;
    for (let i = 0; i < s.res.length; i++) if (s.res[i] === R_BOG && (tile < 0 || home(i) < home(tile))) tile = i;
    const crew = citizens(s);
    const gold = p.res.gold;
    run(s, 90, [{ t: 'gather', p: 0, ids: crew.map((u) => u.id), tile, queue: false }]);
    expect(p.stats.iron!).toBeGreaterThan(20);
    expect(p.res.gold).toBeGreaterThan(gold);
    expect(crew.some((u) => u.order.k === 'gather' && u.order.bog)).toBe(true);
  });

  it('the Iron Age: cheaper, harder-hitting foot soldiers and iron tools, no horses, back to the trunk at the Middle Ages', () => {
    const s = game(seeds.yes[0]);
    const p = s.players[0];
    survey(s);
    p.stats.iron = ironRoad.deed!.n;
    expect(roadProblem(s, p, ironRoad)).toBeNull();
    const spearCost = unitStats('infantry', 1).cost;
    advance(s, 'iron');
    expect(ageOf(p)).toBe('iron');
    expect(p.epoch).toBe(1);
    // Foot soldiers: a quarter cheaper, a point harder.
    const cost = trainCostFor(s, 0, 'infantry', 'barracks');
    expect(cost.food).toBe(Math.round(spearCost.food! * 0.75));
    expect(cost.wood).toBe(Math.round(spearCost.wood! * 0.75));
    expect(statsFor(s, 0, 'infantry').attack).toBe(unitStats('infantry', 1).attack + 1);
    // Archers and the rest at their usual price.
    expect(trainCostFor(s, 0, 'ranged', 'range')).toEqual(unitStats('ranged', 1).cost);
    // No horses.
    expect(barred(p, 'cavalry')).toContain('No horses');
    const spot = findSpot(s, 'stable', p.startX, p.startY, 6, 24)!;
    const stable = placeBuilding(s, 0, 'stable', spot.tx, spot.ty, true);
    run(s, 1, [{ t: 'train', p: 0, building: stable.id, unit: 'cavalry' }]);
    expect(stable.queue.length).toBe(0);
    // The one road out: the Middle Ages at the trunk's price, where the horse arrives.
    expect(roadsFrom(p).map((r) => r.to)).toEqual(['middle']);
    expect(mainRoad(p)!.cost).toEqual(EPOCHS[2].cost);
    advance(s);
    expect(ageOf(p)).toBe('middle');
    expect(barred(p, 'cavalry')).toBeNull();
    expect(trainCostFor(s, 0, 'infantry', 'barracks')).toEqual(unitStats('infantry', 2).cost);
  });

  it('is open only from the Stone Age', () => {
    const s = game(seeds.yes[0]);
    const p = s.players[0];
    survey(s);
    p.stats.iron = ironRoad.deed!.n;
    advance(s);
    expect(ageOf(p)).toBe('bronze');
    expect(roadsFrom(p).some((r) => r.to === 'iron')).toBe(false);
  });

  it('survives a save, and an older save (no flag) is a world without bog iron', () => {
    const s = game(seeds.yes[0]);
    survey(s);
    s.players[0].stats.iron = ironRoad.deed!.n;
    advance(s, 'iron');
    const back = deserialize(serialize(s));
    expect(back.bogIron).toBe(true);
    expect(ageOf(back.players[0])).toBe('iron');
    delete back.bogIron;
    const older = deserialize(serialize(back));
    expect(roadKnown(older, older.players[0], ironRoad)).toBe(false);
  });
});
