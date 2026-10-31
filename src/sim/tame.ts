import { SEASON, TAME, secs } from './data';
import { ageDef } from './ages';
import { spawnAnimal } from './animals';
import { walkable } from './grid';
import { seasonAt } from './seasons';
import type { Animal, GameState, Player, Unit } from './types';
import { R_NONE } from './types';
import { spawnUnit } from './world';

/**
 * Taming (the Age of the Wild, `docs/wild-road.md`): a citizen of a Wild people walks up to a wild wolf, boar or mammoth and
 * sings it calm for `TAME.secs` seconds; then the beast is gone from the wild and a beast of war of that people stands in its
 * place. The beast being tamed stands still for its tamer (`Animal.tamer`, `calmFor`), but its pack does not, and a wound
 * breaks the song. A kind once tamed can be bred at a Beast Den (`Player.tamed`, `barred` in `ages.ts`). The numbers are `TAME`.
 */

export type BeastKind = 'wolf' | 'boar' | 'mammoth';

/** Whether a people tames: it stands in an age that does (the Age of the Wild). */
export const tames = (p: Player): boolean => !!ageDef(p).tames;

/** A wild beast that can be tamed: a living wolf, boar or mammoth that belongs to no people. */
export function wildBeast(a: Animal | undefined): a is Animal & { kind: BeastKind } {
  return !!a && a.hp > 0 && a.owner === undefined && (a.kind === 'wolf' || a.kind === 'boar' || a.kind === 'mammoth');
}

/** Why a people can't tame this beast now, or null. */
export function tameProblem(s: GameState, p: Player, a: Animal | undefined): string | null {
  if (!tames(p)) return 'Only a people of the Age of the Wild tames beasts';
  if (!wildBeast(a)) return 'Only wild wolves, boars and mammoths can be tamed';
  if (a.tamer !== undefined && a.tamer >= 0) {
    const other = s.byId.get(a.tamer);
    if (other && other.kind === 'unit' && other.hp > 0 && other.owner !== p.id && singing(other, a)) return 'Someone else is taming that beast';
  }
  return null;
}

/** Whether a unit is singing to this beast now: a citizen with a tame order on it. */
function singing(u: Unit, a: Animal): boolean {
  return u.hp > 0 && !u.inside && u.order.k === 'tame' && u.order.target === a.id;
}

/**
 * Whether a beast stands calm for its tamer this tick: its tamer still lives, is still at the song and is within `TAME.calm` tiles.
 * A beast whose tamer has gone forgets them.
 */
export function calmFor(s: GameState, a: Animal): boolean {
  if (a.tamer === undefined) return false;
  const u = s.byId.get(a.tamer);
  if (u && u.kind === 'unit' && singing(u, a)) {
    const dx = u.x - a.x;
    const dy = u.y - a.y;
    if (dx * dx + dy * dy <= TAME.calm * TAME.calm) return true;
  }
  a.tamer = undefined;
  return false;
}

/** The beast is tame: it leaves the wild and stands as a beast of war of the tamer's people. */
export function finishTame(s: GameState, u: Unit, a: Animal & { kind: BeastKind }): Unit {
  const p = s.players[u.owner];
  s.animals = s.animals.filter((x) => x !== a);
  const beast = spawnUnit(s, u.owner, TAME.unit[a.kind], a.x, a.y);
  beast.fx = a.x - u.x || 1;
  beast.fy = a.y - u.y;
  if (!(p.tamed ??= []).includes(a.kind)) p.tamed.push(a.kind);
  p.stats.tamed = (p.stats.tamed ?? 0) + 1;
  p.statsVersion++;
  s.events.push({ k: 'tamed', owner: u.owner, kind: a.kind, x: a.x, y: a.y });
  return beast;
}

/** How many ticks of song this beast needs. */
export const songOf = (a: Animal & { kind: BeastKind }): number => secs(TAME.secs[a.kind]);

/**
 * The call of the wild: every `TAME.callEvery` seconds from the second season on (the first `TAME.callAt` seconds into each), each
 * finished Hunting Camp of a Wild people draws a wild beast to it from `TAME.callFrom` tiles out, unless `TAME.callCap` wild wolves
 * and boars already stand within `TAME.callNear` tiles. It brings the kind the people has not tamed yet, or else the season's (a boar
 * in spring and summer, a lone wolf in autumn and winter). A mammoth comes too, from the far side, while the people has tamed none,
 * and after that on the first call of each winter, if none stands near (`TAME.callMammoths`). So every kind is within reach of a
 * Wild town on every map, the wild near it never runs dry, and what comes to the door must be tamed or fought: a called boar guards
 * where it stands.
 */
export function callWild(s: GameState): void {
  const every = secs(TAME.callEvery);
  if (s.tick < secs(SEASON.len) || s.tick % every !== secs(TAME.callAt) % every) return;
  const season = seasonAt(s);
  const winterCall = season === 3 && s.tick % secs(SEASON.len) < secs(TAME.callAt) + every;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'huntcamp' || !e.built || e.hp <= 0) continue;
    const p = s.players[e.owner];
    if (!tames(p)) continue;
    const cx = e.x;
    const cy = e.y;
    const near = { wolf: 0, boar: 0, mammoth: 0 };
    for (const a of s.animals) if (wildBeast(a) && (a.x - cx) * (a.x - cx) + (a.y - cy) * (a.y - cy) <= TAME.callNear * TAME.callNear) near[a.kind]++;
    // The beast comes from a side that turns with each call, the first open ground found going round.
    const turn = Math.floor(s.tick / every) + e.id;
    const tamed = p.tamed ?? [];
    if (near.wolf + near.boar < TAME.callCap) {
      // The season's kind, unless another kind the people lacks (untamed, and none waiting by the camp) is wanted more.
      const kind: BeastKind = season < 2 ? 'boar' : 'wolf';
      const other: BeastKind = kind === 'boar' ? 'wolf' : 'boar';
      const lacks = (k: BeastKind) => !tamed.includes(k) && !near[k];
      callTo(s, cx, cy, turn, !lacks(kind) && lacks(other) ? other : kind);
    }
    if (near.mammoth < TAME.callMammoths && (!tamed.includes('mammoth') || winterCall)) callTo(s, cx, cy, turn + 4, 'mammoth');
  }
}

/** One beast called to a camp at (cx, cy), on the first open ground going round from `turn`. */
function callTo(s: GameState, cx: number, cy: number, turn: number, kind: BeastKind): void {
  for (let i = 0; i < 8; i++) {
    const d = CALL_DIRS[(turn + i) % 8];
    const x = Math.floor(cx + d[0] * TAME.callFrom);
    const y = Math.floor(cy + d[1] * TAME.callFrom);
    if (!walkable(s, x, y) || s.res[y * s.w + x] !== R_NONE || s.bldAt[y * s.w + x] !== 0) continue;
    const a = spawnAnimal(s, x + 0.5, y + 0.5, kind);
    s.events.push({ k: 'wildCry', id: a.id, kind, x: a.x, y: a.y });
    return;
  }
}

/** Eight ways round a camp, each a unit long, so a called beast lands well inside the ring it is counted in. */
const CALL_DIRS: [number, number][] = [[1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0], [-0.7, -0.7], [0, -1], [0.7, -0.7]];
