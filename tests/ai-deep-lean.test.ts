import { describe, expect, it } from 'vitest';
import { leanOf } from '../src/sim/ai';
import { isNomad } from '../src/sim/nomad';
import { AGES, POP_MAX, ROADS, TRUNK, secs } from '../src/sim/data';
import { createGame, step } from '../src/sim/game';
import { routeAges } from '../src/sim/routePlay';
import type { Building } from '../src/sim/types';
import { placeBuilding, restat, spawnUnit } from '../src/sim/world';

/** The `deep` route joins the computer's leanings (#906), and what kept a Deep Road town from climbing on is mended. */
describe('a computer leaning to the Deep Road (#906)', () => {
  it('chooses every Deep Road age and passes the Stone Age\'s other turns by; never a people that quarries no stone', () => {
    let deep = 0;
    for (const mapType of ['continental', 'lakes'] as const) {
      for (let seed = 1; seed <= 30; seed++) {
        const s = createGame({ seed, size: 'small', mapType, players: [{ name: 'A', ai: 'hard' }, { name: 'B', ai: 'hard' }] });
        while (s.tick < 40) step(s);
        for (const p of s.players) {
          if (leanOf(s, p.id) !== 'deep') continue;
          deep++;
          expect(isNomad(p)).toBe(false);
          const roads = s.ai[p.id].roads!;
          for (const a of routeAges('deep')) expect(roads[a]).toBe(true);
          for (const r of ROADS) if (r.from === 'stone' && !TRUNK.includes(r.to) && r.to !== 'megaliths') expect(roads[r.to]).toBe(false);
        }
      }
    }
    // About one leaning seat in eight: some, not most.
    expect(deep).toBeGreaterThan(0);
    expect(deep).toBeLessThan(20);
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
