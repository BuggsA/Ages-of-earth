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
 * The call of the wild: `TAME.callAt` seconds into every season, each finished Hunting Camp of a Wild people draws one wild beast
 * to it from `TAME.callFrom` tiles out (a boar in spring and summer, a lone wolf in autumn and winter), unless `TAME.callCap`
 * wild boars and wolves already stand within `TAME.callNear` tiles. In autumn it also draws a mammoth from `TAME.mammothFrom`
 * tiles out, unless one stands within `TAME.mammothNear`. So the wild near a Wild town never runs dry, and what comes to the
 * door must be tamed or fought: a called boar guards where it stands.
 */
export function callWild(s: GameState): void {
  if (s.tick < secs(SEASON.len) || s.tick % secs(SEASON.len) !== secs(TAME.callAt)) return;
  const kind = seasonAt(s) < 2 ? 'boar' : 'wolf';
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'huntcamp' || !e.built || e.hp <= 0 || !tames(s.players[e.owner])) continue;
    const cx = e.x;
    const cy = e.y;
    let near = 0;
    let mammoth = false;
    for (const a of s.animals) {
      if (!wildBeast(a)) continue;
      const d2 = (a.x - cx) * (a.x - cx) + (a.y - cy) * (a.y - cy);
      if (a.kind !== 'mammoth' && d2 <= TAME.callNear * TAME.callNear) near++;
      if (a.kind === 'mammoth' && d2 <= TAME.mammothNear * TAME.mammothNear) mammoth = true;
    }
    if (near < TAME.callCap) callOne(s, e.id, cx, cy, TAME.callFrom, kind);
    // Once a year, in autumn, a mammoth too, if none lives in the camp's wider country.
    if (seasonAt(s) === 2 && !mammoth) callOne(s, e.id, cx, cy, TAME.mammothFrom, 'mammoth');
  }
}

/** One beast called to the camp at (cx, cy): from `from` tiles out, on a side that turns with the seasons, the first open ground found going round. */
function callOne(s: GameState, camp: number, cx: number, cy: number, from: number, kind: BeastKind): void {
  const turn = Math.floor(s.tick / secs(SEASON.len)) + camp;
  for (let i = 0; i < 8; i++) {
    const d = CALL_DIRS[(turn + i) % 8];
    const x = Math.floor(cx + d[0] * from);
    const y = Math.floor(cy + d[1] * from);
    if (!walkable(s, x, y) || s.res[y * s.w + x] !== R_NONE || s.bldAt[y * s.w + x] !== 0) continue;
    const a = spawnAnimal(s, x + 0.5, y + 0.5, kind);
    s.events.push({ k: 'wildCry', id: a.id, kind, x: a.x, y: a.y });
    return;
  }
}

/** Eight ways round a camp, a unit apart along each axis (diagonals a little further out). */
const CALL_DIRS: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
