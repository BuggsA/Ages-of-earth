import { describe, expect, it } from 'vitest';
import { AGES, VENT, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { ventOf } from '../src/sim/forge';
import type { Building } from '../src/sim/types';
import { restat, spawnUnit } from '../src/sim/world';

/** The computer in the Age of Deep Forges (#884): it raises a Vent Forge over its home vent, and scalds rivals who stand round it. */
describe('the computer in the Age of Deep Forges (#884)', () => {
  it('raises a forge over the vent by its town, and lets its steam out on a rival band holding it', () => {
    const s = createGame({ seed: 4, size: 'small', players: [{ name: 'A', ai: 'hard', civ: 'egyptians' }, { name: 'B', ai: null }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    restat(s, p, () => {
      p.epoch = AGES.forges.tier;
      p.age = 'forges';
    });
    p.walked = ['megaliths', 'delvings', 'undercity', 'forges'];
    p.res = { food: 3000, wood: 3000, stone: 3000, gold: 3000 };
    const forges = () => s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'ventforge' && e.built);
    for (let i = 0; i < secs(120) && !forges().length; i++) step(s);
    const f = forges()[0];
    expect(f).toBeDefined();
    expect(ventOf(s, f)).toBe(s.vents![0]);
    s.peaceUntil = 0;
    const v = ventOf(s, f);
    const band = [0, 1, 2].map((i) => spawnUnit(s, 1, 'infantry', (v % s.w) + 0.5 - 1 + i, Math.floor(v / s.w) + 0.5 + 2.6));
    for (const u of band) u.stance = 'stand';
    for (let i = 0; i < secs(4) && !(p.stats.scalded ?? 0); i++) step(s);
    expect(p.stats.scalded ?? 0).toBeGreaterThanOrEqual(VENT.aiScald);
  });
});
