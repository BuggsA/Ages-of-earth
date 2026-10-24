import { describe, expect, it } from 'vitest';
import { ROUTES, TRUNK, type RouteId } from '../src/sim/data';
import { playRoute, routeAges, routeIds, routeMaps } from '../src/sim/routePlay';

// The route sweeps' harness (#555 s0, scripts/routes.ts); the sweeps themselves are run by hand, they take minutes.
describe('route sweeps', () => {
  it('every route but the plain road has side ages to walk, none of them on the trunk', () => {
    expect(routeIds().sort()).toEqual(Object.keys(ROUTES).sort());
    for (const r of routeIds()) {
      const ages = routeAges(r);
      if (r === 'plain') expect(ages).toEqual([]);
      else expect(ages.length, r).toBeGreaterThan(0);
      for (const a of ages) expect(TRUNK.includes(a)).toBe(false);
    }
  });

  it('the navy names water maps and the rest name any', () => {
    expect(routeMaps('navy')).toEqual(['lakes', 'sea']);
    for (const r of ['army', 'economy', 'horse', 'faith', 'plain'] as RouteId[]) expect(routeMaps(r)).toEqual(['continental']);
  });

  it('a match is deterministic for a seed', () => {
    const a = playRoute('economy', 7, 'continental', 1);
    const b = playRoute('economy', 7, 'continental', 1);
    expect(a).toEqual(b);
    expect(a.result).toBe('unfinished');
  });
});
