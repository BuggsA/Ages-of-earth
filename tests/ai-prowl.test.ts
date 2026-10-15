import { describe, expect, it } from 'vitest';
import { AI_PROWL, TICK_HZ } from '../src/sim/data';
import { prey, rivalCamp } from '../src/sim/ai';
import { createGame, step } from '../src/sim/game';
import type { Building, GameState, Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** Hunters hunted (#260): the clever computer falls on rival citizens working far from their town. */

const game = (level: 'normal' | 'easy' = 'normal', peaceMinutes = 0): GameState =>
  createGame({ seed: 7, size: 'small', peaceMinutes, players: [{ name: 'A', ai: null, civ: 'romans' }, { name: 'B', ai: level, civ: 'greeks' }] });

/** A point between the towns: `f` of the way from B's home toward A's. */
function between(s: GameState, f: number): { x: number; y: number } {
  const a = s.players[0], b = s.players[1];
  return { x: b.startX + (a.startX - b.startX) * f, y: b.startY + (a.startY - b.startY) * f };
}

/** Clear the open ground so only what a test places is there (the wild and landmarks wander in otherwise). */
function clearWild(s: GameState): void {
  for (const e of s.ents) if (e.kind === 'unit' && e.owner !== 0 && e.owner !== 1) e.hp = 0;
  s.animals = [];
}

describe('which rival citizen a band may fall on', () => {
  it('takes a seen citizen far from its town, and none near a Tower, a soldier, or unseen', () => {
    const s = game();
    const b = s.players[1];
    b.vis.fill(1);
    const home = { x: b.startX, y: b.startY };
    const at = between(s, 0.4);
    const lone = spawnUnit(s, 0, 'citizen', at.x, at.y);
    expect(prey(s, b, home, home, AI_PROWL.reach, 2)).toBe(lone);

    // A soldier of theirs beside it guards it.
    const guard = spawnUnit(s, 0, 'infantry', at.x + 2, at.y);
    expect(prey(s, b, home, home, AI_PROWL.reach, 2)).toBeNull();
    guard.hp = 0;

    // Unseen, it is not known.
    b.vis.fill(0);
    expect(prey(s, b, home, home, AI_PROWL.reach, 2)).toBeNull();
    b.vis.fill(1);

    // A Tower of theirs close by covers it.
    placeBuilding(s, 0, 'tower', Math.floor(at.x) + 4, Math.floor(at.y), true);
    expect(prey(s, b, home, home, AI_PROWL.reach, 2)).toBeNull();
  });

  it('leaves a crowd too big for the band, and citizens at home', () => {
    const s = game();
    const b = s.players[1];
    b.vis.fill(1);
    const home = { x: b.startX, y: b.startY };
    const at = between(s, 0.4);
    for (let i = 0; i < 5; i++) spawnUnit(s, 0, 'citizen', at.x + i * 0.4, at.y);
    expect(prey(s, b, home, home, AI_PROWL.reach, 2)).toBeNull(); // 5 > 2 × 2
    expect(prey(s, b, home, home, AI_PROWL.reach, 3)).not.toBeNull(); // 5 ≤ 3 × 2
    // The rival's own citizens by its Town Center are never prey.
    for (const e of s.ents) if (e.kind === 'unit' && e.owner === 0 && e.type === 'citizen' && Math.hypot(e.x - at.x, e.y - at.y) < 3) e.hp = 0;
    expect(prey(s, b, home, home, 999, 3)).toBeNull();
  });
});

describe('the computer sends a band after them', () => {
  const run = (s: GameState) => {
    clearWild(s);
    const b = s.players[1];
    const at = between(s, 0.3);
    const lone = spawnUnit(s, 0, 'citizen', at.x, at.y);
    const band: Unit[] = [];
    for (let i = 0; i < 3; i++) band.push(spawnUnit(s, 1, 'infantry', at.x - 5 + i * 0.4, at.y - 3));
    for (let i = 0; i < 4 * TICK_HZ; i++) step(s);
    return { lone, band, b };
  };

  it('on Hard: soldiers seeing a lone rival citizen go for it', () => {
    const s = game('normal');
    const { lone, band } = run(s);
    expect(s.ai[1]?.prowl?.target).toBe(lone.id);
    expect(band.filter((u) => u.order.k === 'attack').length).toBeGreaterThanOrEqual(AI_PROWL.band);
  }, 30000);

  it('not on Normal (no tricks), nor during a peace treaty', () => {
    const calm = game('easy');
    run(calm);
    expect(calm.ai[1]?.prowl).toBeUndefined();
    const peace = game('normal', 10);
    run(peace);
    expect(peace.ai[1]?.prowl).toBeUndefined();
  }, 30000);

  it('goes home when a rival soldier comes to the rescue', () => {
    const s = game('normal');
    const { lone, band } = run(s);
    expect(s.ai[1]?.prowl).toBeTruthy();
    const lead = band[0];
    spawnUnit(s, 0, 'cavalry', lead.x + 2, lead.y + 1);
    for (let i = 0; i < 3 * TICK_HZ; i++) step(s);
    expect(s.ai[1]?.prowl).toBeUndefined();
    expect(s.ai[1]?.prowled).toBeGreaterThan(0);
    void lone;
  }, 30000);
});

describe('the computer looks for hunters at a rival Hunting Camp', () => {
  it('walks a band to a camp it has seen, and falls on the citizen working there', () => {
    const s = game('normal');
    clearWild(s);
    const b = s.players[1];
    const at = between(s, 0.45);
    const camp = placeBuilding(s, 0, 'huntcamp', Math.floor(at.x), Math.floor(at.y), true) as Building;
    b.seen.fill(1);
    expect(rivalCamp(s, b, { x: b.startX, y: b.startY })).toBe(camp);
    const butcher = spawnUnit(s, 0, 'citizen', camp.x + 2, camp.y + 1);
    // The band waits at home, out of sight of the camp.
    const band: Unit[] = [];
    for (let i = 0; i < 2; i++) band.push(spawnUnit(s, 1, 'infantry', b.startX + 4 + i * 0.4, b.startY + 4));
    for (let i = 0; i < 3 * TICK_HZ; i++) step(s);
    expect(s.ai[1]?.prowl?.look).toBe(camp.id);
    let fell = false;
    for (let i = 0; i < 40 * TICK_HZ && !fell; i++) {
      step(s);
      if (s.ai[1]?.prowl?.target === butcher.id) fell = true;
    }
    expect(fell).toBe(true);
  }, 30000);
});
