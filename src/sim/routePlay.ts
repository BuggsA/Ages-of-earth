import { AGES, ROUTES, TRUNK, type RouteId } from './data';
import { ageOf, hasWalked } from './ages';
import { createGame, step } from './game';
import type { AgeId, Difficulty, GameState, MapType } from './types';

/**
 * The forks' two roads are left to the computer's own choice (`forkRoad` in ai.ts; the Wild route's beasts or plants, `wants`): a
 * route walks one of them.
 */
const FORK: AgeId[] = ['hemocraft', 'bloodrite', 'bloom', 'leviathans'];

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
  /** Every age it stood in, with the minute it got there. */
  reached: { age: AgeId; minute: number }[];
  /** Route ages it chose and later gave up (patience out, or a countered road), with the age it was in and the minute. */
  gaveUp: { age: AgeId; in: AgeId; minute: number }[];
}

/**
 * Plays one match for the sweeps (#555 s0): a Hard computer in seat 0 bound to `route` (it has made up its mind on every
 * side age: the route's ages yes, all others no, so it climbs the route and the trunk and nothing else) against a Normal
 * computer that walks the web as it likes, the mix a player meets. Deterministic for a seed.
 */
export function playRoute(route: RouteId, seed: number, map: MapType = routeMaps(route)[0], maxMinutes = 40, size: 'small' | 'medium' = 'small', level: Difficulty = 'hard', startEpoch = 0): RouteMatch {
  const s = createGame({ seed, size, mapType: map, startEpoch, players: [{ name: 'Route', ai: level }, { name: 'Mix', ai: 'normal' }] });
  step(s);
  const mine = routeAges(route);
  const roads: Partial<Record<AgeId, boolean>> = {};
  for (const a of Object.keys(AGES) as AgeId[]) if (!TRUNK.includes(a) && !FORK.includes(a)) roads[a] = mine.includes(a);
  s.ai[0].roads = { ...s.ai[0].roads, ...roads };
  const reached: RouteMatch['reached'] = [{ age: ageOf(s.players[0]), minute: 0 }];
  const gaveUp: RouteMatch['gaveUp'] = [];
  while (!s.over && s.tick < 1200 * maxMinutes) {
    step(s);
    const here = ageOf(s.players[0]);
    const minute = s.tick / 1200;
    if (here !== reached[reached.length - 1].age) reached.push({ age: here, minute });
    for (const a of mine) if (s.ai[0].roads![a] === false && !gaveUp.some((g) => g.age === a)) gaveUp.push({ age: a, in: here, minute });
  }
  return { ...summary(s, route, seed, map), reached, gaveUp };
}

function summary(s: GameState, route: RouteId, seed: number, map: MapType): Omit<RouteMatch, 'reached' | 'gaveUp'> {
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
