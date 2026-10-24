import { AGES, ROUTES, TRUNK, type RouteId } from './data';
import { ageOf, hasWalked } from './ages';
import { createGame, step } from './game';
import type { AgeId, Difficulty, GameState, MapType } from './types';

/** The fork's two roads are left to the computer's own choice (`forkRoad` in ai.ts): a route walks one of them. */
const FORK: AgeId[] = ['hemocraft', 'bloodrite'];

/** The side ages standing on a route, oldest tier first (the plain road has none: it is the trunk). */
export function routeAges(route: RouteId): AgeId[] {
  return (Object.keys(AGES) as AgeId[])
    .filter((a) => !TRUNK.includes(a) && AGES[a].routes!.includes(route))
    .sort((a, b) => AGES[a].tier - AGES[b].tier);
}

/** The maps a route names (`docs/age-roads.md` spine §1): the navy wants water, every other route is for any map. */
export const routeMaps = (route: RouteId): MapType[] => (route === 'navy' ? ['lakes', 'sea'] : ['continental']);

export interface RouteMatch {
  route: RouteId;
  seed: number;
  map: MapType;
  /** 'win' for the route's seat, 'lose', or 'unfinished' when the clock ran out. */
  result: 'win' | 'lose' | 'unfinished';
  minutes: number;
  /** Route ages the seat walked or stands in at the end, of `routeAges(route)`. */
  walked: AgeId[];
  /** The age it ended in. */
  ended: AgeId;
}

/**
 * Plays one match for the sweeps (#555 s0): a Hard computer in seat 0 bound to `route` (it has made up its mind on every
 * side age: the route's ages yes, all others no, so it climbs the route and the trunk and nothing else) against a Normal
 * computer that walks the web as it likes, the mix a player meets. Deterministic for a seed.
 */
export function playRoute(route: RouteId, seed: number, map: MapType = routeMaps(route)[0], maxMinutes = 40, size: 'small' | 'medium' = 'small', level: Difficulty = 'hard'): RouteMatch {
  const s = createGame({ seed, size, mapType: map, players: [{ name: 'Route', ai: level }, { name: 'Mix', ai: 'normal' }] });
  step(s);
  const mine = routeAges(route);
  const roads: Partial<Record<AgeId, boolean>> = {};
  for (const a of Object.keys(AGES) as AgeId[]) if (!TRUNK.includes(a) && !FORK.includes(a)) roads[a] = mine.includes(a);
  s.ai[0].roads = { ...s.ai[0].roads, ...roads };
  while (!s.over && s.tick < 1200 * maxMinutes) step(s);
  return summary(s, route, seed, map);
}

function summary(s: GameState, route: RouteId, seed: number, map: MapType): RouteMatch {
  const me = s.players[0];
  const ended = ageOf(me);
  return {
    route, seed, map,
    result: s.winner === 0 ? 'win' : s.winner > 0 ? 'lose' : 'unfinished',
    minutes: s.tick / 1200,
    walked: routeAges(route).filter((a) => hasWalked(me, a)),
    ended,
  };
}

export const routeIds = (): RouteId[] => Object.keys(ROUTES) as RouteId[];
