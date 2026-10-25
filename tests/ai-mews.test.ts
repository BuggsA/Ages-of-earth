import { describe, expect, it } from 'vitest';
import { AGES, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { spawnUnit } from '../src/sim/world';
import type { Building, Unit } from '../src/sim/types';

/** The computer in the Age of the Wild Hunt raises a Falconer's Mews toward the nearest rival and breeds wolves there (#727). */

describe('the computer and the Falconer\'s Mews (#727)', () => {
  it('raises one, and breeds a wolf at it', () => {
    const s = createGame({ seed: 3, size: 'small', mapType: 'plains', players: [{ name: 'A', ai: 'hard', civ: 'greeks' }, { name: 'B', ai: null, civ: 'romans' }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    p.epoch = AGES.hunt.tier;
    p.age = 'hunt';
    p.walked = ['wild', 'steppe', 'hunt'];
    p.res = { food: 3000, wood: 3000, stone: 600, gold: 800 };
    for (let i = 0; i < 20; i++) spawnUnit(s, 0, 'citizen', p.startX - 3 + (i % 6), p.startY + 4 + Math.floor(i / 6));
    for (let i = 0; i < 5; i++) spawnUnit(s, 0, 'infantry', p.startX + 3 + i * 0.5, p.startY + 3);
    s.tick = secs(300);
    s.ai[0] = { next: 0, wave: 0, attacking: false, muster: null, ordered: {}, unitTurn: 0, bell: -1, roads: {} };
    const mine = () => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'mews');
    const wolves = () => s.ents.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0 && e.type === 'warwolf').length;
    for (let i = 0; i < secs(400) && !(mine().some((x) => x.built) && wolves() > 0); i++) step(s);
    expect(mine().length).toBe(1);
    expect(mine()[0].built).toBe(true);
    expect(wolves()).toBeGreaterThan(0);
  });
});
