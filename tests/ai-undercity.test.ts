import { describe, expect, it } from 'vitest';
import { AGES, UNDER, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import type { Building, Unit } from '../src/sim/types';
import { restat, spawnUnit } from '../src/sim/world';

/** The computer in the Age of the Undercity (#883): its houses and stores go below when a rival army nears, and come up after it goes. */
describe('the computer in the Age of the Undercity (#883)', () => {
  it('sinks its Houses and Storehouses as a rival army comes, and surfaces them once it has gone', () => {
    const s = createGame({ seed: 4, size: 'small', players: [{ name: 'A', ai: 'hard', civ: 'egyptians' }, { name: 'B', ai: null }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    restat(s, p, () => {
      p.epoch = AGES.undercity.tier;
      p.age = 'undercity';
    });
    p.walked = ['megaliths', 'delvings'];
    p.res = { food: 3000, wood: 3000, stone: 3000, gold: 2000 };
    const homely = () => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && (e.type === 'house' || e.type === 'storehouse') && e.built);
    for (let i = 0; i < secs(60) && homely().length < 2; i++) step(s);
    expect(homely().length).toBeGreaterThan(0);
    const raid: Unit[] = [];
    for (let i = 0; i < UNDER.army + 2; i++) raid.push(spawnUnit(s, 1, 'infantry', p.startX + 4 + (i % 3), p.startY + 4 + Math.floor(i / 3)));
    for (const u of raid) u.stance = 'stand';
    for (let i = 0; i < secs(UNDER.sink + 6) && !homely().some((b) => b.sunk); i++) step(s);
    expect(homely().some((b) => b.sunk)).toBe(true);
    expect(p.stats.sunk ?? 0).toBeGreaterThan(0);
    for (const u of raid) u.hp = 0;
    for (let i = 0; i < secs(UNDER.calm + 10) && homely().some((b) => b.sunk); i++) step(s);
    expect(homely().some((b) => b.sunk)).toBe(false);
  });
});
