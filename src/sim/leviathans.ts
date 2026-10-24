import { LEVIATHANS, TICK_HZ, domainOf, secs } from './data';
import { ageOf } from './ages';
import { placeProblem, stampBuilding } from './grid';
import { pitchSpot } from './steppe';
import { ungarrison } from './units';
import { canAfford, maxHp, pay, placeBuilding, spawnUnit } from './world';
import type { Building, GameState, Player, Unit } from './types';

/**
 * The Age of Leviathans (`docs/wild-road.md` §5a): the Wild route's beasts' end, the Bloom's sibling at the fork. Giants are bred at
 * a Great Den, and the Heart Tree sleeps (`wildwood.ts`: no new Ents, no Spreading, every Ent roots).
 * - A Skywhale flies (the air domain) and carries people on foot as a transport does (`isCarrier` in `units.ts`), boarding and setting
 *   them down wherever there is ground beneath it. Every `LEVIATHANS.every` seconds it may drop a seed-bomb (`seedBomb`): Thornwall
 *   seedlings of its people on the open ground beneath it, in anyone's land, which grow as any Thornwall does (`grove.ts`).
 * - The Behemoth, one to a people, is bred carrying a Town Center (`Unit.packed`, so the heart rule counts it as the Steppe's wagons
 *   are counted). It kneels where a wagon would pitch (`kneel`): its Town Center stands at once, built, with the share of health the
 *   titan had; and that Town Center rises onto its back again (`rise`) whenever its queue is empty.
 * Great Dens and their giants belong to any people that has walked the age, in every age after (`buildBarred`, `barred`).
 */

/** Whether a people stands in the Age of Leviathans now. */
export const inLeviathans = (p: Player | undefined): boolean => !!p && ageOf(p) === 'leviathans';

/** Whether a people already has its Behemoth: walking, knelt as a Town Center, or in training at a Great Den. */
export function behemothBusy(s: GameState, owner: number): boolean {
  for (const e of s.ents) {
    if (e.owner !== owner || e.hp <= 0) continue;
    if (e.kind === 'unit' ? e.type === 'behemoth' : e.behemoth || e.queue.some((q) => q.unit === 'behemoth')) return true;
  }
  return false;
}

/** A Behemoth just bred: it carries its Town Center from the first. */
export function bornBehemoth(u: Unit): void {
  u.packed = 'towncenter';
  u.packedHp = 1;
}

/** Why a Behemoth can't kneel where it stands, or null. */
export function kneelProblem(s: GameState, u: Unit): string | null {
  if (u.type !== 'behemoth' || u.hp <= 0) return 'Only a Behemoth kneels';
  if (u.inside) return 'Not while aboard';
  return pitchSpot(s, u, LEVIATHANS.kneel) ? null : 'No room to kneel here, or the land is a rival\'s';
}

/** The Behemoth kneels: its Town Center stands at once where a wagon would pitch, finished, with the share of health the titan had. */
export function kneel(s: GameState, u: Unit): Building | null {
  const spot = pitchSpot(s, u, LEVIATHANS.kneel);
  if (!spot) return null;
  const share = Math.max(0.05, Math.min(1, u.hp / maxHp(s, u)));
  s.byId.delete(u.id);
  s.ents = s.ents.filter((e) => e !== u);
  const b = placeBuilding(s, u.owner, 'towncenter', spot.tx, spot.ty, true);
  b.hp = Math.max(1, maxHp(s, b) * share);
  b.behemoth = true;
  s.events.push({ k: 'leviathan', what: 'kneel', owner: u.owner, id: b.id, x: b.x, y: b.y });
  return b;
}

/** Why this Town Center can't rise onto its Behemoth now, or null. */
export function riseProblem(b: Building): string | null {
  if (!b.behemoth || b.type !== 'towncenter') return 'Only a Town Center knelt from a Behemoth rises';
  if (!b.built || b.hp <= 0) return 'It must stand finished first';
  if (b.advance >= 0) return 'Not while the people is changing its age';
  if (b.queue.length) return 'Finish or cancel the training here first';
  return null;
}

/** The Town Center rises: its people step out, and the Behemoth walks again with the share of health the Town Center had. */
export function rise(s: GameState, b: Building): Unit {
  ungarrison(s, b);
  const share = b.hp / maxHp(s, b);
  stampBuilding(s, b, false);
  s.byId.delete(b.id);
  s.ents = s.ents.filter((e) => e !== b);
  const u = spawnUnit(s, b.owner, 'behemoth', b.x, b.y);
  bornBehemoth(u);
  u.hp = Math.max(1, maxHp(s, u) * share);
  s.events.push({ k: 'leviathan', what: 'rise', owner: b.owner, id: u.id, x: u.x, y: u.y });
  return u;
}

/** Whether a land unit or a beast stands on a tile, so a seedling can't sprout on it. */
function standing(s: GameState, tile: number): boolean {
  const cx = (tile % s.w) + 0.5;
  const cy = Math.floor(tile / s.w) + 0.5;
  const near = (x: number, y: number) => Math.abs(x - cx) < 0.9 && Math.abs(y - cy) < 0.9;
  for (const e of s.ents) if (e.kind === 'unit' && e.hp > 0 && !e.inside && domainOf(e.type) === 'land' && near(e.x, e.y)) return true;
  for (const a of s.animals) if (a.hp > 0 && near(a.x, a.y)) return true;
  return false;
}

/** The open tiles a seed-bomb dropped at (x, y) sprouts on: up to `LEVIATHANS.seeds` within `reach` tiles, nearest first, then in tile order. */
export function bombTiles(s: GameState, x: number, y: number): number[] {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const r = LEVIATHANS.reach;
  const open: { i: number; d: number }[] = [];
  for (let ty = cy - r; ty <= cy + r; ty++) {
    for (let tx = cx - r; tx <= cx + r; tx++) {
      if (placeProblem(s, 'thornwall', tx, ty)) continue;
      const i = ty * s.w + tx;
      if (s.stools?.some((t) => t.tile === i) || s.roots?.some((t) => t.tile === i) || standing(s, i)) continue;
      open.push({ i, d: (tx - cx) * (tx - cx) + (ty - cy) * (ty - cy) });
    }
  }
  open.sort((a, b) => a.d - b.d || a.i - b.i);
  return open.slice(0, LEVIATHANS.seeds).map((o) => o.i);
}

/** Seconds until a Skywhale's next seed-bomb is ready: 0 when it is. */
export const bombIn = (s: GameState, u: Unit): number => Math.max(0, Math.ceil(((u.bombAt ?? 0) - s.tick) / TICK_HZ));

/** Why this Skywhale can't drop a seed-bomb now, or null. */
export function seedBombProblem(s: GameState, u: Unit): string | null {
  if (u.type !== 'skywhale' || u.hp <= 0) return 'Only a Skywhale drops seed-bombs';
  const left = bombIn(s, u);
  if (left > 0) return `The next seed-bomb is ready in ${left}s`;
  if (!canAfford(s.players[u.owner], LEVIATHANS.bomb)) return `A seed-bomb takes ${Object.entries(LEVIATHANS.bomb).map(([r, n]) => `${n} ${r}`).join(', ')}`;
  if (!bombTiles(s, u.x, u.y).length) return 'No open ground beneath it for the seeds to take';
  return null;
}

/** A seed-bomb: Thornwall seedlings of the whale's people sprout on the open ground beneath it, and the next one starts to ripen. */
export function seedBomb(s: GameState, u: Unit): void {
  const tiles = bombTiles(s, u.x, u.y);
  pay(s.players[u.owner], LEVIATHANS.bomb);
  u.bombAt = s.tick + secs(LEVIATHANS.every);
  for (const i of tiles) placeBuilding(s, u.owner, 'thornwall', i % s.w, Math.floor(i / s.w), true);
  s.events.push({ k: 'leviathan', what: 'bomb', owner: u.owner, id: u.id, x: u.x, y: u.y, n: tiles.length });
}
