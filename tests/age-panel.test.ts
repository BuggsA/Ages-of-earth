import { describe, expect, it } from 'vitest';
import { AGES, ROADS, ROUTES, TRUNK, type RouteId, type Road } from '../src/sim/data';
import { leadsOn, leadsTo } from '../src/sim/ages';
import { createGame } from '../src/sim/game';
import type { AgeId } from '../src/sim/types';

// The age road (#555, docs/age-roads.md): the basic routes (s0, spine §1) and the age panel (s4, spine §2).
const ids = Object.keys(AGES) as AgeId[];
// A road a rare find opens and nothing else: a ruin dug, or a survey that found its deposit. An ore door is only a shortcut.
const rare = (r: Road) => !!r.ruin || !!r.found;

describe('the age panel in the data', () => {
  it('every age says what it is good at, in one line and never a number, and names its routes', () => {
    for (const id of ids) {
      const a = AGES[id];
      expect(a.good?.trim(), `${id} needs a good line`).toBeTruthy();
      expect(a.good, `${id}'s good line is a number`).not.toMatch(/[0-9%]/);
      expect(a.good, `${id}'s good line is one line`).not.toMatch(/[.\n]/);
      expect(a.routes, `${id} needs routes (empty for a rare age)`).toBeDefined();
      for (const r of a.routes!) expect(ROUTES[r], `${id}: unknown route ${r}`).toBeDefined();
    }
  });

  it('the trunk is the plain road, and only the trunk', () => {
    for (const id of ids) expect(AGES[id].routes!.includes('plain'), id).toBe(TRUNK.includes(id));
  });

  it('every route has ages, and every age on one is reached from the Stone Age by its own route and the plain road, with no rare find', () => {
    for (const route of Object.keys(ROUTES) as RouteId[]) {
      const on = (a: AgeId) => AGES[a].routes!.includes(route) || AGES[a].routes!.includes('plain');
      const mine = ids.filter((a) => AGES[a].routes!.includes(route));
      expect(mine.length, route).toBeGreaterThan(0);
      const reached = new Set<AgeId>(['stone']);
      for (let grew = true; grew; ) {
        grew = false;
        for (const r of ROADS) {
          if (reached.has(r.to) || !reached.has(r.from) || !on(r.to) || rare(r)) continue;
          // A road that asks for an age walked asks for one on the way.
          if (r.walked && !reached.has(r.walked)) continue;
          reached.add(r.to);
          grew = true;
        }
      }
      for (const a of mine) expect(reached.has(a), `${a} on the ${route} route`).toBe(true);
    }
  });

  it('an age only a rare find opens stands on no route', () => {
    for (const id of ids) {
      const ways = ROADS.filter((r) => r.to === id);
      if (ways.length && ways.every(rare)) expect(AGES[id].routes, id).toEqual([]);
    }
  });
});

describe('where an age leads', () => {
  it('is every road on to a later tier or a turn off the trunk, never a road back', () => {
    expect(leadsOn('middle').map((r) => r.to)).toEqual(expect.arrayContaining(['gunpowder', 'sail', 'warband', 'pilgrim', 'reclaimer']));
    expect(leadsOn('warband').map((r) => r.to)).toEqual(['gunpowder']);
    expect(leadsOn('bloodrite')).toEqual([]);
    expect(leadsOn('steppe').map((r) => r.to)).toEqual(['middle', 'horde']);
    for (const id of ids) for (const r of leadsOn(id)) expect(AGES[r.to].tier > AGES[id].tier || !TRUNK.includes(r.to), `${id} → ${r.to}`).toBe(true);
  });

  it('tells a player only the roads they could see from the Town Center, or have walked', () => {
    const s = createGame({ seed: 1, size: 'small', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
    const p = s.players[0];
    // At the start: the trunk road on, but no clue building raised, so no side road out of the Middle Ages is known.
    expect(leadsTo(s, p, 'stone')).toContain('bronze');
    expect(leadsTo(s, p, 'middle')).toEqual(['gunpowder']);
    // A people that has stood in an age knows the road there.
    p.walked = [...(p.walked ?? []), 'sail'];
    expect(leadsTo(s, p, 'middle')).toEqual(expect.arrayContaining(['gunpowder', 'sail']));
  });
});
