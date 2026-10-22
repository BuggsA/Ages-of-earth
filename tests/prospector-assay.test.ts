import { describe, expect, it } from 'vitest';
import { AGES, TECHS } from '../src/sim/data';
import { assayed, diggersAt, holdingsOf, keyAt } from '../src/sim/ages';
import { aiStep, findSpot } from '../src/sim/ai';
import { createGame } from '../src/sim/game';
import { techProblem } from '../src/sim/stats';
import type { Building, GameState, Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

// The age road (#568, docs/age-roads.md spine §4): the Prospector's Lodge, level 3, Assay the Holdings.
const setup = (seed: number, ai: 'hard' | null = null) => ({ seed, size: 'small' as const, players: [{ name: 'A', ai, civ: 'greeks' as const }, { name: 'B', ai: null }] });
const keyTile = (s: GameState) => {
  for (let i = 0; i < s.res.length; i++) if (keyAt(s, i)) return i;
  return -1;
};
/** The first seed whose small world holds a key-resource tile. */
const seed = (() => {
  let n = 1;
  while (keyTile(createGame(setup(n))) < 0) n++;
  return n;
})();
/** A Middle Ages town with a charted lodge. */
const town = (ai: 'hard' | null = null): { s: GameState; lodge: Building } => {
  const s = createGame(setup(seed, ai));
  const p = s.players[0];
  p.epoch = 2;
  p.age = 'middle';
  p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
  const spot = findSpot(s, 'prospector', p.startX, p.startY, 4, 14)!;
  const lodge = placeBuilding(s, 0, 'prospector', spot.tx, spot.ty, true);
  p.techs.push('survey', 'chart');
  p.chart = [];
  p.statsVersion++;
  // The computer thinks on its first step, its mind not yet made up about any road.
  if (ai) s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: {} };
  return { s, lodge };
};
/** A rival citizen set to dig a key-resource tile. */
const dig = (s: GameState, owner: number, tile: number): Unit => {
  const x = (tile % s.w) + 0.5;
  const y = Math.floor(tile / s.w) + 0.5;
  const u = spawnUnit(s, owner, 'citizen', x, y);
  u.order = { k: 'gather', tile, res: 'gold', phase: 'work' };
  return u;
};

describe('Assay the Holdings (#568)', () => {
  it('is learned at the lodge from the Middle Ages, after the chart', () => {
    expect(TECHS.assay.at).toBe('prospector');
    expect(TECHS.assay.epoch).toBe(2);
    expect(TECHS.assay.needs).toBe('chart');
    const { s } = town();
    const p = s.players[0];
    expect(techProblem(s, 0, 'assay')).toBeNull();
    p.techs = p.techs.filter((t) => t !== 'chart');
    expect(techProblem(s, 0, 'assay')).toBe('Needs Chart the Veins first');
    expect(assayed(p)).toBe(false);
  });

  it('knows who digs each key tile now, in id order', () => {
    const { s } = town();
    const tile = keyTile(s);
    expect(diggersAt(s).has(tile)).toBe(false);
    dig(s, 1, tile);
    dig(s, 0, tile);
    expect(diggersAt(s).get(tile)).toBe(1);
  });

  it('reads what each people holds: rare ore in store, bog iron dug', () => {
    const { s } = town();
    const o = s.players[1];
    o.rare = { salt: 42.7, bloodiron: 5 };
    o.stats.iron = 151.2;
    expect(holdingsOf(o)).toEqual({ bogIron: 151, salt: 42, saltpetre: 0, bloodiron: 5 });
  });

  it('the computer assays once a rival stands in an age a key resource opens', () => {
    const { s, lodge } = town('hard');
    const o = s.players[1];
    o.age = 'merchant';
    o.epoch = AGES.merchant.tier;
    aiStep(s);
    expect(lodge.queue.map((q) => q.tech)).toContain('assay');
  });

  it('the computer leaves it alone while every rival keeps to the plain road', () => {
    const { s, lodge } = town('hard');
    aiStep(s);
    expect(lodge.queue.map((q) => q.tech)).not.toContain('assay');
  });

  it('assayed, the computer sends riders at a rival digging a key resource near its town', () => {
    const { s } = town('hard');
    const p = s.players[0];
    p.techs.push('assay');
    s.peaceUntil = 0;
    const riders = [0, 1, 2].map((i) => spawnUnit(s, 0, 'cavalry', p.startX + 3 + i, p.startY + 3));
    const digger = dig(s, 1, keyTile(s));
    digger.x = p.startX + 8;
    digger.y = p.startY + 8;
    for (let i = 0; i < 4; i++) {
      s.ai[0].next = 0;
      aiStep(s);
    }
    expect(riders.some((u) => u.order.k === 'attack' && u.order.target === digger.id)).toBe(true);
  });
});
