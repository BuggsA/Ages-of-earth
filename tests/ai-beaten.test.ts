import { describe, expect, it } from 'vitest';
import { ageOf } from '../src/sim/ages';
import { AI_LEVELS, AI_WEB, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { AgeId, CivId, GameState, Unit } from '../src/sim/types';
import { spawnUnit } from '../src/sim/world';

/**
 * A beaten computer doesn't freeze (#113): it climbs once its next wave is out of reach, its citizens
 * come back out when a straggler or two is all that's left at its gates, and it holds a little longer
 * for a road whose deed is nearly done.
 */

const game = (civ: CivId, startEpoch: number, seed = 11): GameState => {
  const s = createGame({ seed, size: 'small', startEpoch, players: [{ name: 'A', ai: 'hard', civ }, { name: 'B', ai: null, civ: 'britons' }] });
  s.peaceUntil = 1e9;
  return s;
};
const run = (s: GameState, seconds: number, until?: () => boolean) => {
  for (let i = 0; i < secs(seconds) && !s.over && !until?.(); i++) step(s);
};
/** A full town (40 citizens: a Town Center busy training citizens never climbs) and no soldiers, rich enough for anything, its mind made up about the side roads. */
const town = (s: GameState, wave: number, roads: Partial<Record<AgeId, boolean>> = { iron: false, merchant: false, pilgrim: false, fair: false, reclaimer: false, sail: false }) => {
  const p = s.players[0];
  for (let i = 0; i < 40; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
  p.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
  s.tick = secs(900);
  s.ai[0] = { next: s.tick, wave, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads };
};
const tcOf = (s: GameState, owner = 0) => s.ents.find((e) => e.kind === 'building' && e.owner === owner && e.type === 'towncenter')!;

describe('a beaten computer climbs (#113)', () => {
  it('holds the next age back for its first wave, as before', () => {
    const s = game('romans', 1);
    town(s, 0);
    // Before any wave has gone out, it raises soldiers first: army-first never ran out for the opening.
    run(s, AI_LEVELS.hard.armyWait + 30);
    const soldiers = s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type !== 'citizen' && e.hp > 0).length;
    const tc = tcOf(s);
    expect(soldiers < AI_LEVELS.hard.wave ? tc.kind === 'building' && tc.advance < 0 && s.players[0].epoch === 1 : true).toBe(true);
  });

  it('once a wave has gone out and its army stays short of the next, it stops waiting and climbs', () => {
    const s = game('romans', 1);
    town(s, 1);
    run(s, AI_LEVELS.hard.armyWait - 10);
    const tc = tcOf(s);
    // Still waiting on its soldiers for a while.
    expect(tc.kind === 'building' && tc.advance).toBeLessThan(0);
    run(s, 40, () => tc.kind === 'building' && tc.advance >= 0);
    expect(tc.kind === 'building' && tc.advance).toBeGreaterThanOrEqual(0);
  });
});

describe('the town bell comes down for stragglers (#113)', () => {
  it('rings against a band at the gates, and lets the citizens out once only a couple are left', () => {
    const s = game('romans', 1);
    town(s, 1);
    const tc = tcOf(s);
    const band: Unit[] = [];
    for (let i = 0; i < 6; i++) band.push(spawnUnit(s, 1, 'infantry', tc.x + 6 + (i % 3), tc.y + 6 + Math.floor(i / 3)));
    // The band keeps its health and stays put: only the bell's own judgement is tested.
    const hold = () => {
      for (const u of band) {
        u.hp = 1e6;
        u.order = { k: 'idle' };
      }
      return false;
    };
    run(s, 10, () => hold() || s.ai[0].bell >= 0);
    expect(s.ai[0].bell).toBeGreaterThanOrEqual(0);
    // All but two leave.
    for (const u of band.slice(2)) u.hp = 0;
    band.length = 2;
    run(s, AI_LEVELS.hard.bell.hold + 10, () => hold() || s.ai[0].bell < 0);
    expect(AI_LEVELS.hard.bell.quiet).toBeGreaterThanOrEqual(2);
    expect(s.ai[0].bell).toBe(-1);
  });
});

describe('patience for a deed nearly done (#113)', () => {
  const bogSeed = (() => {
    for (let seed = 1; seed < 60; seed++) if (createGame({ seed, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] }).bogIron) return seed;
    throw new Error('no bog world');
  })();
  /** A Greek town in the Stone Age that has held its Town Center `held` seconds for the iron deed, `dug` bog iron dug. */
  const holding = (dug: number, held: number): GameState => {
    const s = game('greeks', 0, bogSeed);
    town(s, 0, { iron: true });
    const p = s.players[0];
    p.techs.push('survey');
    p.stats.iron = dug;
    // Early in the match, before soldiers come first.
    s.tick = secs(160);
    s.ai[0].next = s.tick;
    s.ai[0].waiting = s.tick - secs(held);
    return s;
  };

  it('gives the road up after `patience` seconds when the deed is only half dug', () => {
    const s = holding(80, AI_WEB.patience + 5);
    run(s, 2);
    expect(s.ai[0].roads?.iron).toBe(false);
    expect(ageOf(s.players[0])).toBe('stone');
  });

  it('holds on past `patience` when the deed is nearly dug', () => {
    const s = holding(130, AI_WEB.patience + 5);
    run(s, 2);
    expect(s.ai[0].roads?.iron).toBe(true);
    expect(s.ai[0].waiting).toBeDefined();
    // But not for ever.
    s.ai[0].waiting = s.tick - secs(AI_WEB.patience * 2 + 5);
    run(s, 2);
    expect(s.ai[0].roads?.iron).toBe(false);
  });
});
