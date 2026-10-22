import { describe, expect, it } from 'vitest';
import { ageOf, mainRoad } from '../src/sim/ages';
import { AI_LEVELS, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { findSpot } from '../src/sim/ai';
import { RES, type AgeId, type CivId, type GameState } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/**
 * #532: a climb nearly paid for isn't spent on the next wave; a nomad sets aside the gold for its road's stone;
 * a town bound for the Path of Blood doesn't turn pilgrim.
 */

const game = (civ: CivId, startEpoch: number): GameState => {
  const s = createGame({ seed: 11, size: 'small', startEpoch, players: [{ name: 'A', ai: 'hard', civ }, { name: 'B', ai: null, civ: 'britons' }] });
  s.peaceUntil = 1e9;
  return s;
};
const run = (s: GameState, seconds: number, until?: () => boolean) => {
  for (let i = 0; i < secs(seconds) && !s.over && !until?.(); i++) step(s);
};
/** A full town (40 citizens, so its Town Center trains no more), no soldiers, a wave already sent: army-first holds the climb. */
const town = (s: GameState, roads: Partial<Record<AgeId, boolean>>) => {
  const p = s.players[0];
  for (let i = 0; i < 40; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
  const at = findSpot(s, 'barracks', p.startX, p.startY, 6, 16)!;
  placeBuilding(s, 0, 'barracks', at.tx, at.ty, true);
  s.tick = secs(900);
  s.ai[0] = { next: s.tick, wave: 1, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads };
};
const sides = { iron: false, merchant: false, pilgrim: false, fair: false, reclaimer: false, sail: false, steppe: false };

describe('a climb nearly paid for keeps its savings (#532)', () => {
  it('while army-first holds the climb, the price in hand is not spent on soldiers', () => {
    const s = game('romans', 1);
    town(s, sides);
    const p = s.players[0];
    const cost = mainRoad(p)!.cost;
    for (const r of RES) p.res[r] = cost[r] ?? 0;
    run(s, AI_LEVELS.hard.armyWait - 10);
    // Still held for the army, but the price is still there.
    expect(p.epoch).toBe(1);
    for (const r of RES) expect(p.res[r]).toBeGreaterThanOrEqual((cost[r] ?? 0) - 1);
    // And once army-first gives out, it climbs at once.
    const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    run(s, 30, () => tc.kind === 'building' && tc.advance >= 0);
    expect(tc.kind === 'building' && tc.advance).toBeGreaterThanOrEqual(0);
  });
});

describe('a nomad buys its road\'s stone with gold set aside (#532)', () => {
  it('in the Warband, holding for its army, it keeps the gold for the climb\'s stone and buys it', () => {
    const s = game('mongols', 2);
    const p = s.players[0];
    p.age = 'warband';
    const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    const spot = findSpot(s, 'market', tc.x, tc.y, 5, 14)!;
    placeBuilding(s, 0, 'market', spot.tx, spot.ty, true);
    // Not bound for Iron and Blood, so its plunder doesn't call for the army.
    town(s, { ...sides, ironblood: false });
    // Room for soldiers, so the army can spend what the climb doesn't set aside.
    for (let i = 0; i < 12; i++) {
      const h = findSpot(s, 'house', tc.x, tc.y, 4, 20);
      if (h) placeBuilding(s, 0, 'house', h.tx, h.ty, true);
    }
    const cost = mainRoad(p)!.cost;
    expect(cost.stone ?? 0).toBeGreaterThan(200);
    // The climb's food and gold, and gold for its stone at the Market; no stone.
    for (const r of RES) p.res[r] = cost[r] ?? 0;
    p.res.stone = 0;
    p.res.gold += 600;
    run(s, AI_LEVELS.hard.armyWait - 10);
    expect(p.res.stone).toBeGreaterThanOrEqual(cost.stone!);
  });
});

describe('a town bound for the Path of Blood does not turn pilgrim (#532)', () => {
  it('takes the Warband, not the pilgrims, with both deeds done', () => {
    const s = game('romans', 2);
    const p = s.players[0];
    const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    // The clues: a Temple keeping two relics, and the Barracks `town` raises; and both deeds done.
    const ts = findSpot(s, 'temple', tc.x, tc.y, 6, 14)!;
    const temple = placeBuilding(s, 0, 'temple', ts.tx, ts.ty, true);
    for (let i = 0; i < 2; i++) s.relics.push({ id: s.nextId++, x: temple.x, y: temple.y, carrier: 0, temple: temple.id });
    p.stats.slain = 50;
    p.stats.relicGold = 500;
    town(s, { ...sides, pilgrim: true, warband: true });
    s.ai[0].attacking = true;
    for (const r of RES) p.res[r] = 3000;
    run(s, 90, () => ageOf(p) !== 'middle');
    expect(ageOf(p)).toBe('warband');
  });
});
