import { describe, expect, it } from 'vitest';
import { enemyTarget, fleetWanted, watchPost } from '../src/sim/ai';
import { AI_WEB, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { GameState } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The computer reads a rival's heirlooms (#242). */

const game = (): GameState => {
  const s = createGame({ seed: 3, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: 'hard', civ: 'britons' }, { name: 'B', ai: null, civ: 'britons' }] });
  s.peaceUntil = 1e9;
  const p = s.players[0];
  p.epoch = 2;
  p.cap = 200;
  p.res = { food: 3000, wood: 3000, stone: 3000, gold: 3000 };
  for (let i = 0; i < 30; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
  for (let i = 0; i < 10; i++) spawnUnit(s, 0, 'infantry', p.startX + 4 + (i % 4), p.startY - 4 - Math.floor(i / 4));
  s.tick = secs(600);
  return s;
};

/** Siege engines a computer with a workshop has built or queued after a few minutes. */
const engines = (lodge: boolean): number => {
  const s = game();
  const w = s.players[0];
  placeBuilding(s, 0, 'workshop', w.startX + 8, w.startY + 8, true);
  if (lodge) s.players[1].techs.push('masonsLodge');
  s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: {} };
  let n = 0;
  for (let i = 0; i < secs(250) && !s.over; i++) {
    step(s);
    const now = s.ents.filter((e) => e.kind === 'unit' && e.owner === 0 && e.type === 'siege').length;
    n = Math.max(n, now);
  }
  return n;
};

describe('the computer reads a rival heirloom (#242)', () => {
  it('lies in wait by a Joint-Stock rival\'s trading post even outside the Merchants\' ages', () => {
    const s = game();
    if (!s.posts.length) s.posts.push({ id: 1, x: s.players[1].startX + 5, y: s.players[1].startY + 5 });
    expect(watchPost(s, s.players[0])).toBeNull();
    s.players[1].techs.push('jointStock');
    expect(watchPost(s, s.players[0])).not.toBeNull();
  });

  it('keeps more siege engines against a Masons\' Lodge rival', () => {
    const [a, b] = [engines(true), engines(false)];
    expect(a).toBeGreaterThan(b);
  });
});

describe('the computer answers Iron-Bound Hulls (#242)', () => {
  it('keeps a bigger fleet against a rival with them', () => {
    const s = game();
    expect(fleetWanted(s, s.players[0], 3)).toBe(3);
    s.players[1].techs.push('ironHulls');
    expect(fleetWanted(s, s.players[0], 3)).toBe(3 + AI_WEB.hulls);
    expect(fleetWanted(s, s.players[0], 0)).toBe(0);
  });
});

describe('the computer raids a Bell Foundry rival\'s relic Temple (#242)', () => {
  /** The rival's Temple keeping a relic stands a little farther off than its Town Center. */
  const target = (bell: boolean) => {
    const s = game();
    const [a, b] = s.players;
    a.seen.fill(1);
    const temple = placeBuilding(s, 1, 'temple', b.startX + 6, b.startY + 6, true)!;
    const tc = s.ents.find((e) => e.kind === 'building' && e.owner === 1 && e.type === 'towncenter')!;
    const d2 = (x: number, y: number) => (x - a.startX) ** 2 + (y - a.startY) ** 2;
    // Slide the Temple along the line from our start until it lies `AI_WEB.bell / 2` (squared tiles) farther than the Town Center.
    const dir = Math.hypot(tc.x - a.startX, tc.y - a.startY);
    const want = Math.sqrt(d2(tc.x, tc.y) + AI_WEB.bell / 2);
    temple.x = a.startX + ((tc.x - a.startX) / dir) * want;
    temple.y = a.startY + ((tc.y - a.startY) / dir) * want;
    s.relics.push({ id: 9999, x: temple.x, y: temple.y, carrier: 0, temple: temple.id });
    if (bell) b.techs.push('bellFoundry');
    return enemyTarget(s, a)?.type;
  };

  it('prefers the Temple only when its keeper has the Foundry', () => {
    expect(target(false)).toBe('towncenter');
    expect(target(true)).toBe('temple');
  });
});
