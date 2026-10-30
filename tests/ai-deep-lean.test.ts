import { describe, expect, it } from 'vitest';
import { leanOf } from '../src/sim/ai';
import { isNomad } from '../src/sim/nomad';
import { AGES, POP_MAX, TRUNK, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { routeAges } from '../src/sim/routePlay';
import type { Building } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The `deep` route joins the computer's leanings (#906), and what kept a Deep Road town from climbing on is mended. */
describe('a computer leaning to the Deep Road (#906)', () => {
  it('is settled in the Megaliths by a seat with an open mind, which then chooses every Deep Road age; never on the first turn', () => {
    let tried = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const s = createGame({ seed, size: 'small', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: null }] });
      s.peaceUntil = 1e9;
      while (s.tick < 40) step(s);
      expect(leanOf(s, 0)).not.toBe('deep');
      if (leanOf(s, 0)) continue;
      tried++;
      const p = s.players[0];
      restat(s, p, () => {
        p.epoch = AGES.megaliths.tier;
        p.age = 'megaliths';
      });
      p.walked = ['megaliths'];
      for (let i = 0; i < secs(5); i++) step(s);
      expect(leanOf(s, 0)).toBe('deep');
      for (const a of routeAges('deep')) expect(s.ai[0].roads![a]).toBe(true);
    }
    expect(tried).toBeGreaterThan(0);
  });

  it('is never settled by a seat already leaning another way, nor out of a skirmish', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = createGame({ seed, size: 'small', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: null }] });
      s.peaceUntil = 1e9;
      while (s.tick < 40) step(s);
      const was = leanOf(s, 0);
      if (!was) continue;
      const p = s.players[0];
      restat(s, p, () => {
        p.epoch = AGES.megaliths.tier;
        p.age = 'megaliths';
      });
      for (let i = 0; i < secs(5); i++) step(s);
      expect(leanOf(s, 0)).toBe(was);
      return;
    }
    throw new Error('no seat leaned in 12 seeds');
  });

  it('is never settled by a people that quarries no stone, which climbs the plain way when bound to the road', () => {
    const s = createGame({ seed: 4, size: 'small', players: [{ name: 'A', ai: 'hard', civ: 'mongols' }, { name: 'B', ai: null }] });
    s.peaceUntil = 1e9;
    step(s);
    const roads: Record<string, boolean> = {};
    for (const a of Object.keys(AGES)) if (!TRUNK.includes(a as never)) roads[a] = routeAges('deep').includes(a as never);
    s.ai[0].roads = { ...s.ai[0].roads, ...roads };
    const p = s.players[0];
    expect(isNomad(p)).toBe(true);
    for (let i = 0; i < secs(900) && p.epoch === 0; i++) step(s);
    expect(p.epoch).toBeGreaterThan(0);
    expect(leanOf(s, 0)).not.toBe('deep');
    expect(s.ai[0].roads!.megaliths).toBe(false);
  });

  it('clears a Town Center queue held up at the cap once the climb is paid for', () => {
    const s = createGame({ seed: 4, size: 'small', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: null }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    while (s.tick < secs(160)) step(s);
    p.res = { food: 5000, wood: 5000, stone: 5000, gold: 5000 };
    for (let i = p.pop; i < POP_MAX; i++) spawnUnit(s, 0, 'infantry', p.startX + 3 + (i % 8), p.startY + 3 + Math.floor(i / 8) / 2);
    const tc = s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
    step(s, [{ t: 'train', p: 0, building: tc.id, unit: 'citizen' }]);
    expect(tc.queue.some((q) => q.unit === 'citizen')).toBe(true);
    for (let i = 0; i < secs(30) && p.epoch === 0 && !s.ents.some((e) => e.kind === 'building' && e.owner === 0 && e.advance >= 0); i++) step(s);
    expect(tc.queue.some((q) => q.unit === 'citizen')).toBe(false);
    expect(tc.advance >= 0 || p.epoch > 0).toBe(true);
  });

  it('buys the next climb\'s stone at the Market with its gold, on the road past the Megaliths', () => {
    const s = createGame({ seed: 4, size: 'small', players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: null }] });
    s.peaceUntil = 1e9;
    const p = s.players[0];
    restat(s, p, () => {
      p.epoch = AGES.forges.tier;
      p.age = 'forges';
    });
    p.walked = ['megaliths', 'delvings', 'undercity', 'forges'];
    placeBuilding(s, 0, 'market', Math.floor(p.startX) - 8, Math.floor(p.startY) + 4, true);
    p.res = { food: 3000, wood: 3000, stone: 0, gold: 4000 };
    for (let i = 0; i < secs(20); i++) step(s);
    expect(p.res.stone).toBeGreaterThanOrEqual(500);
  });
});
