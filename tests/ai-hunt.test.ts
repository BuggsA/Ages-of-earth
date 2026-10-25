import { describe, expect, it } from 'vitest';
import { ageOf } from '../src/sim/ages';
import { HUNT, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { AgeId, GameState, Unit } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer and the fifth crossing (#801): it plans the Wild and the Steppe as it plans the others, turns Wild Hunt, and flies its hawk. */

const game = (age: AgeId, walked: AgeId[], roads: Record<string, boolean> = { hunt: true, wild: true, steppe: true }): GameState => {
  const s = createGame({ seed: 2, size: 'small', mapType: 'continental', players: [{ name: 'A', ai: 'hard', civ: 'britons' }, { name: 'B', ai: null, civ: 'britons' }] });
  s.peaceUntil = 1e9;
  const p = s.players[0];
  p.age = age;
  p.epoch = age === 'stone' ? 0 : 1;
  p.walked = walked;
  p.res = { food: 3000, wood: 3000, stone: 400, gold: 1500 };
  for (let i = 0; i < 30; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
  placeBuilding(s, 0, 'huntcamp', p.startX + 6, p.startY + 6, true);
  s.tick = secs(600);
  s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads };
  return s;
};
const run = (s: GameState, seconds: number, until: () => boolean) => {
  for (let i = 0; i < secs(seconds) && !s.over && !until(); i++) step(s);
};
const hawks = (s: GameState): Unit[] => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'hawk' && e.hp > 0);

describe('the computer crosses to the Wild Hunt (#801)', () => {
  it('steps back to the Stone Age from a sibling, after its stay', () => {
    const s = game('wild', ['stone', 'steppe']);
    run(s, 60, () => false);
    expect(ageOf(s.players[0])).toBe('wild');
    run(s, 400, () => ageOf(s.players[0]) === 'stone');
    expect(ageOf(s.players[0])).toBe('stone');
  });

  it('turns into the Wild Hunt from the Stone Age with both siblings walked', () => {
    const s = game('stone', ['stone', 'wild', 'steppe']);
    run(s, 300, () => ageOf(s.players[0]) === 'hunt');
    expect(ageOf(s.players[0])).toBe('hunt');
  });

  it('stays in the age a while after it turns, to raid', () => {
    const s = game('stone', ['stone', 'wild', 'steppe']);
    run(s, 300, () => ageOf(s.players[0]) === 'hunt');
    run(s, 60, () => false);
    expect(ageOf(s.players[0])).toBe('hunt');
  });
});

describe('the computer\'s hawk (#801)', () => {
  it('trains one Hunting-Camp hawk in the age and sends it exploring, no more', () => {
    const s = game('hunt', ['stone', 'wild', 'steppe']);
    run(s, 240, () => hawks(s).length > 0);
    expect(hawks(s)).toHaveLength(HUNT.hawks);
    // It is sent exploring (an idle hawk is sent again at its next turn), and a second one is never trained.
    let sent = false;
    run(s, 40, () => (sent = sent || hawks(s)[0]?.order.k === 'explore') && false);
    expect(hawks(s)).toHaveLength(HUNT.hawks);
    expect(sent).toBe(true);
  });

  it('keeps hawks out of its army', () => {
    const s = game('hunt', ['stone', 'wild', 'steppe']);
    run(s, 240, () => hawks(s).length > 0);
    run(s, 60, () => false);
    // Nothing is queued at the Hunting Camp but its one hawk.
    for (const b of s.ents) if (b.kind === 'building' && b.type === 'huntcamp') for (const q of b.queue) expect(q.unit).toBe('hawk');
  });
});
