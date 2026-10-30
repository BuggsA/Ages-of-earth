import { describe, expect, it } from 'vitest';
import { AGES, LIVING, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { engineVent } from '../src/sim/fault';
import type { Building } from '../src/sim/types';
import { placeBuilding, restat } from '../src/sim/world';

/** The computer in the Age of the Living Earth (#904): it raises a Heartstone by its home vent, swallows what a warhead aims at, and wakes the Quake. */
describe('the computer in the Age of the Living Earth (#904)', () => {
  it('raises a Heartstone by its vent, swallows the district under a rival warhead, and wakes the Quake on a rival town it has seen', () => {
    const s = createGame({ seed: 4, size: 'small', players: [{ name: 'A', ai: 'hard', civ: 'egyptians' }, { name: 'B', ai: null }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    restat(s, p, () => {
      p.epoch = AGES.living.tier;
      p.age = 'living';
    });
    p.walked = ['megaliths', 'delvings', 'undercity', 'forges', 'faults', 'living'];
    p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
    const stones = () => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'heartstone' && e.built);
    for (let i = 0; i < secs(180) && !stones().length; i++) step(s);
    const b = stones()[0];
    expect(b).toBeDefined();
    expect(engineVent(s, b)).toBe(s.vents![0]);
    s.peaceUntil = 0;
    // A rival warhead on its houses: it swallows them before it lands.
    const q = s.players[1];
    restat(s, q, () => {
      q.epoch = 5;
      q.age = 'atomic';
    });
    q.res = { food: 9000, wood: 9000, stone: 9000, gold: 9000 };
    const house = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'house' && e.built) ?? placeBuilding(s, 0, 'house', Math.floor(p.startX) + 5, Math.floor(p.startY) - 6, true);
    const silo = placeBuilding(s, 1, 'silo', Math.floor(q.startX) + 5, Math.floor(q.startY) + 5, true);
    step(s, [{ t: 'launch', p: 1, silo: silo.id, x: house!.x, y: house!.y }]);
    for (let i = 0; i < secs(15) && !house!.sunk; i++) step(s);
    expect(house!.sunk).toBe(true);
    // The rival town seen: the Quake wakes on it.
    for (let i = 0; i < s.w * s.h; i++) p.seen[i] = 1;
    let woke = false;
    for (let i = 0; i < secs(60) && !woke; i++) {
      step(s);
      woke = !!s.faults?.some((f) => f.owner === 0 && f.kind === 'quake');
    }
    expect(woke).toBe(true);
    const f = s.faults!.find((f) => f.owner === 0 && f.kind === 'quake')!;
    const at = { x: (f.at! % s.w) + 0.5, y: Math.floor(f.at! / s.w) + 0.5 };
    const dx = at.x - q.startX;
    const dy = at.y - q.startY;
    expect(dx * dx + dy * dy).toBeLessThan(20 * 20);
    expect(LIVING.quake).toBeGreaterThan(0);
  });
});
