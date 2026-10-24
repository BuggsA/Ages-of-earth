import { describe, expect, it } from 'vitest';
import { AGES, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { wateredAt } from '../src/sim/water';
import type { Building } from '../src/sim/types';
import { restat } from '../src/sim/world';

/** The computer on the Water Road (#701 s1): in the Age of Rivers it digs a channel by home, and lays its fields by water. */
describe('the computer in the Age of Rivers (#701 s1)', () => {
  it('digs its channel and lays every new field by water', () => {
    const s = createGame({ seed: 4, size: 'small', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: null }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    restat(s, p, () => {
      p.epoch = AGES.rivers.tier;
      p.age = 'rivers';
    });
    p.res = { food: 2000, wood: 2000, stone: 500, gold: 500 };
    const before = new Set(s.ents.filter((e) => e.kind === 'building').map((e) => e.id));
    for (let i = 0; i < secs(150) && (p.stats.dug ?? 0) < 3; i++) step(s);
    expect(p.stats.dug ?? 0).toBeGreaterThanOrEqual(3);
    // Fields come once the berries by home run short.
    for (let i = 0; i < secs(300) && s.ents.filter((e) => e.kind === 'building' && e.owner === 0 && e.type === 'farm' && !before.has(e.id)).length < 2; i++) step(s);
    const fields = s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'farm' && !before.has(e.id));
    expect(fields.length).toBeGreaterThan(0);
    for (const f of fields) expect(wateredAt(s, f.tx, f.ty, f.size, true, 0)).toBe(true);
  });
});
