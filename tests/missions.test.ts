import { describe, expect, it } from 'vitest';
import { BUILDINGS, MISSION, ROADS, TICK_HZ, secs } from '../src/sim/data';
import { asleep, buildBarred, canRaise, crossingLeft, roadKnown, roadProblem } from '../src/sim/ages';
import { createGame, step } from '../src/sim/game';
import { applyCommand } from '../src/sim/commands';
import { homeDistance, paying, tithe } from '../src/sim/missions';
import { landOwnerAt } from '../src/sim/borders';
import { placeProblem } from '../src/sim/grid';
import type { AgeId, Building, GameState } from '../src/sim/types';
import { placeBuilding, spawnUnit } from '../src/sim/world';

/** The second crossing age (#555 s12): the Age of Missions, open only to a people that walked the Pilgrims and the Sail. */

const road = ROADS.find((r) => r.to === 'missions')!;
const game = (age: AgeId = 'missions', walked: AgeId[] = ['pilgrim', 'sail']): GameState => {
  const s = createGame({ seed: 2, size: 'small', mapType: 'lakes', players: [{ name: 'A', ai: null }, { name: 'B', ai: null }] });
  s.peaceUntil = 1e9;
  s.animals = [];
  const p = s.players[0];
  p.epoch = 2;
  p.age = age;
  p.walked = walked;
  p.res = { food: 9000, wood: 9000, stone: 9000, gold: 0 };
  return s;
};
const tc = (s: GameState) => s.ents.find((e): e is Building => e.kind === 'building' && e.owner === 0 && e.type === 'towncenter')!;
/** The shore tile where a Mission could stand nearest to `d` tiles from the Town Center. */
const spot = (s: GameState, d: number): { tx: number; ty: number } => {
  const home = tc(s);
  let best: { tx: number; ty: number } | null = null;
  let bestE = Infinity;
  for (let ty = 1; ty < s.h; ty++)
    for (let tx = 1; tx < s.w; tx++) {
      if (placeProblem(s, 'mission', tx, ty, true, 0)) continue;
      const e = Math.abs(Math.hypot(tx - home.x, ty - home.y) - d);
      if (e < bestE) {
        bestE = e;
        best = { tx, ty };
      }
    }
  return best!;
};
const mission = (s: GameState, d: number): Building => {
  const at = spot(s, d);
  return placeBuilding(s, 0, 'mission', at.tx, at.ty, true);
};

describe('the door (#555 s12)', () => {
  it('is seen with one sibling walked, and open only with both, a Temple standing', () => {
    const s = game('middle', ['pilgrim']);
    const p = s.players[0];
    expect(roadKnown(s, p, road)).toBe(false);
    placeBuilding(s, 0, 'temple', tc(s).tx + 6, tc(s).ty, true);
    expect(roadKnown(s, p, road)).toBe(true);
    expect(crossingLeft(p, road)).toBe('sail');
    expect(roadProblem(s, p, road)).toMatch(/Age of Sail/);
    expect(roadKnown(s, game('middle', []).players[0], road)).toBe(false);
    p.walked = ['pilgrim', 'sail'];
    expect(roadProblem(s, p, road)).toBeNull();
  });
});

describe('the Mission (#555 s12)', () => {
  it('is raised by priests only, and only in the Age of Missions', () => {
    expect(canRaise('priest', 'mission')).toBe(true);
    expect(canRaise('citizen', 'mission')).toBe(false);
    expect(buildBarred(game().players[0], 'mission')).toBeNull();
    expect(buildBarred(game('middle').players[0], 'mission')).toMatch(/Age of Missions/);
  });

  it('a priest raises one on a shore, and it claims land and trains priests', () => {
    const s = game();
    s.players[0].res.gold = 500;
    const at = spot(s, 14);
    const priest = spawnUnit(s, 0, 'priest', tc(s).x + 3, tc(s).y + 3);
    applyCommand(s, { t: 'build', p: 0, ids: [priest.id], type: 'mission', tx: at.tx, ty: at.ty });
    const site = s.ents.find((e): e is Building => e.kind === 'building' && e.type === 'mission')!;
    expect(site).toBeTruthy();
    for (let i = 0; i < 120 * TICK_HZ && !site.built; i++) step(s);
    expect(site.built).toBe(true);
    expect(landOwnerAt(s, at.tx + 1, at.ty + 1)).toBe(0);
    expect(BUILDINGS.mission.trains).toContain('priest');
  });
});

describe('the tithe (#555 s12)', () => {
  it('grows with the distance from the Town Center, up to the cap', () => {
    const s = game();
    const near = mission(s, 8);
    const far = mission(s, 26);
    expect(homeDistance(s, far)).toBeGreaterThan(homeDistance(s, near));
    expect(tithe(s, far)).toBeGreaterThan(tithe(s, near));
    expect(tithe(s, far)).toBeLessThanOrEqual(MISSION.cap);
  });

  it('is paid every few seconds, only for the farthest few, and not while asleep', () => {
    const s = game();
    const ms = [8, 12, 16, 20, 24].map((d) => mission(s, d));
    const got = new Set(paying(s, 0).map((b) => b.id));
    expect(got.size).toBe(MISSION.most);
    expect(got.has(ms[4].id)).toBe(true);
    expect(got.has(ms[0].id)).toBe(false);
    s.players[0].res.gold = 0;
    for (let i = 0; i < secs(MISSION.every) + 1; i++) step(s);
    expect(s.players[0].res.gold).toBeGreaterThan(0);
    expect(s.players[0].stats.tithe).toBeGreaterThan(0);
    // Back in the Middle Ages the Missions sleep, and pay nothing.
    s.players[0].age = 'middle';
    expect(ms.every((b) => asleep(s, b))).toBe(true);
    expect(paying(s, 0)).toHaveLength(0);
    // A keepsake never sleeps.
    ms[4].keep = 'missions';
    expect(paying(s, 0).map((b) => b.id)).toEqual([ms[4].id]);
  });
});
