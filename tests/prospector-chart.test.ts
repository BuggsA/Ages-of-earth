import { describe, expect, it } from 'vitest';
import { TECHS, secs } from '../src/sim/data';
import { charted, keyAt, prospected } from '../src/sim/ages';
import { aiStep, findSpot } from '../src/sim/ai';
import { createGame, step } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { techProblem } from '../src/sim/stats';
import type { Building, GameState } from '../src/sim/types';
import { R_NONE } from '../src/sim/types';
import { placeBuilding } from '../src/sim/world';

// The age road s2 (#565, docs/age-roads.md spine §4): the Prospector's Lodge, level 2, Chart the Veins.
const setup = (seed = 1) => ({ seed, size: 'small' as const, players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
/** A town in the Bronze Age with a finished lodge, which has prospected. */
const town = (seed = 1): { s: GameState; lodge: Building } => {
  const s = createGame(setup(seed));
  const p = s.players[0];
  p.epoch = 1;
  p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
  const spot = findSpot(s, 'prospector', p.startX, p.startY, 4, 14)!;
  const lodge = placeBuilding(s, 0, 'prospector', spot.tx, spot.ty, true);
  p.techs.push('survey');
  p.statsVersion++;
  return { s, lodge };
};
const chart = (s: GameState, lodge: Building) => {
  step(s, [{ t: 'research', p: 0, building: lodge.id, tech: 'chart' }]);
  for (let i = 0; i < secs(TECHS.chart.time) + 2; i++) step(s);
};
const keyTiles = (s: GameState) => Array.from({ length: s.res.length }, (_, i) => i).filter((i) => keyAt(s, i));

describe('Chart the Veins (#565)', () => {
  it('is learned at the lodge from the Bronze Age, after the lodge has prospected', () => {
    expect(TECHS.chart.at).toBe('prospector');
    expect(TECHS.chart.epoch).toBe(1);
    const { s } = town();
    const p = s.players[0];
    p.techs = [];
    expect(techProblem(s, 0, 'chart')).toBe('Needs Survey the Land first');
    p.techs.push('survey');
    p.epoch = 0;
    expect(techProblem(s, 0, 'chart')).toBe('Needs the Bronze Age');
    p.epoch = 1;
    expect(techProblem(s, 0, 'chart')).toBeNull();
  });

  it('marks every key-resource tile in the world, for its own people only', () => {
    let seed = 1;
    while (keyTiles(createGame(setup(seed))).length === 0) seed++;
    const { s, lodge } = town(seed);
    const p = s.players[0];
    expect(charted(p)).toBe(false);
    chart(s, lodge);
    expect(p.techs).toContain('chart');
    expect(charted(p)).toBe(true);
    expect(p.chart!.map((c) => c.tile)).toEqual(keyTiles(s));
    for (const c of p.chart!) expect(keyAt(s, c.tile)).toBe(c.key);
    // Caves are rich tiles of ore: each is on the chart.
    for (const cave of s.caves ?? []) expect(p.chart!.some((c) => c.tile === cave.tile)).toBe(true);
    expect(charted(s.players[1])).toBe(false);
  });

  it('is a picture of the land when charted: a vein dug out later still shows', () => {
    let seed = 1;
    while (keyTiles(createGame(setup(seed))).length === 0) seed++;
    const { s, lodge } = town(seed);
    chart(s, lodge);
    const first = s.players[0].chart![0];
    s.res[first.tile] = R_NONE;
    expect(s.players[0].chart![0]).toEqual(first);
  });

  it('is kept in a save', () => {
    let seed = 1;
    while (keyTiles(createGame(setup(seed))).length === 0) seed++;
    const { s, lodge } = town(seed);
    chart(s, lodge);
    const back = deserialize(serialize(s));
    expect(back.players[0].chart).toEqual(s.players[0].chart);
  });

  it('the computer charts once it has settled on a road this world holds the key to', () => {
    // A world with salt: the Merchant road's shortcut.
    let seed = 1;
    while (!createGame(setup(seed)).rares?.includes('salt')) seed++;
    const s = createGame({ ...setup(seed), players: [{ name: 'A', ai: 'hard', civ: 'greeks' }, { name: 'B', ai: null }] });
    const p = s.players[0];
    p.epoch = 1;
    p.age = 'bronze';
    p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
    const spot = findSpot(s, 'prospector', p.startX, p.startY, 4, 14)!;
    const lodge = placeBuilding(s, 0, 'prospector', spot.tx, spot.ty, true);
    p.techs.push('survey');
    expect(prospected(p)).toBe(true);
    s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: { merchant: true } };
    aiStep(s);
    expect(lodge.queue.map((q) => q.tech)).toContain('chart');
  });

  it('the computer leaves the chart alone with no rare road in mind', () => {
    const s = createGame({ ...setup(), players: [{ name: 'A', ai: 'hard', civ: 'greeks' }, { name: 'B', ai: null }] });
    const p = s.players[0];
    p.epoch = 1;
    p.age = 'bronze';
    p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
    const spot = findSpot(s, 'prospector', p.startX, p.startY, 4, 14)!;
    const lodge = placeBuilding(s, 0, 'prospector', spot.tx, spot.ty, true);
    p.techs.push('survey');
    s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: { merchant: false } };
    aiStep(s);
    expect(lodge.queue.map((q) => q.tech)).not.toContain('chart');
  });
});
