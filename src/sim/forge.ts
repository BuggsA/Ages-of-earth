import { MILITARY, TICK_HZ, VENT, domainOf, secs } from './data';
import { ageDef, asleep, hasWalked } from './ages';
import { hurt, peace } from './combat';
import { isEnemy } from './world';
import type { Building, GameState } from './types';

/**
 * The Age of Deep Forges (#884, the Deep Road's fourth age). Mapgen lays a vent of the earth's heat by every town and a few out on the
 * map (`GameState.vents`); nothing is built on a vent but a Vent Forge, raised over it (`ventSpot`). While
 * it stands hot (`forgeHot`) it drives every building of its people within `VENT.reach` tiles (`ventRate`, read by `workRate`); in the
 * age, a building out of every hot forge's reach works at `VENT.cold`. A forge goes cold while a rival's soldiers stand round its vent
 * and none of its people's do (`forgeStep`), and its people may let its steam out over the vent (`scald`), striking every rival round it
 * and leaving the forge cold a while. The kept forge drives on any road; others sleep off the age.
 */

/** Whether a tile is a vent. */
export const isVent = (s: GameState, tile: number): boolean => !!s.vents && s.vents.includes(tile);

/** The vent under an n-by-n square, or -1 (vents lie at least five tiles apart, so a forge covers one at most). */
function ventUnder(s: GameState, tx: number, ty: number, n: number): number {
  if (!s.vents) return -1;
  for (const v of s.vents) {
    const vx = v % s.w;
    const vy = Math.floor(v / s.w);
    if (vx >= tx && vx < tx + n && vy >= ty && vy < ty + n) return v;
  }
  return -1;
}

/** The vent a Vent Forge stands over, or -1. */
export const ventOf = (s: GameState, b: Building): number => (b.type === 'ventforge' ? ventUnder(s, b.tx, b.ty, b.size) : -1);

/**
 * Why a building can't stand on this n-by-n square for the vents, or null: a Vent Forge goes over a vent (anywhere under it), and
 * nothing else goes on a vent. A people on the Deep Road (that has walked the Megaliths) keeps the eight tiles round every vent clear as
 * well, so its own town never shuts its forge out; a people that never took the road raises what it likes beside one.
 */
export function ventSpot(s: GameState, type: string, tx: number, ty: number, n: number, owner = -1): 'vent' | 'hot' | null {
  if (type === 'ventforge') return ventUnder(s, tx, ty, n) >= 0 ? null : 'vent';
  if (!s.vents) return null;
  if (ventUnder(s, tx, ty, n) >= 0) return 'hot';
  const p = owner >= 0 ? s.players[owner] : undefined;
  return p && hasWalked(p, 'megaliths') && ventUnder(s, tx - 1, ty - 1, n + 2) >= 0 ? 'hot' : null;
}

/** The top-left tile of a Vent Forge centred over this vent: its ground is kept open from the start. */
export const forgeAt = (s: GameState, vent: number): { tx: number; ty: number } => ({ tx: (vent % s.w) - 1, ty: Math.floor(vent / s.w) - 1 });

/** The Vent Forge standing (or rising) over a vent, if any. */
export function forgeOver(s: GameState, vent: number): Building | null {
  const id = s.bldAt[vent];
  const e = id ? s.byId.get(id) : undefined;
  return e && e.kind === 'building' && e.type === 'ventforge' && e.hp > 0 ? e : null;
}

/** Whether a forge lies cold after letting its steam out. */
export const spent = (s: GameState, b: Building): boolean => b.spent !== undefined && s.tick < b.spent;

/** Whether a Vent Forge drives the work round it: finished, standing over its vent, awake, its vent its own, its steam not spent. */
export function forgeHot(s: GameState, b: Building): boolean {
  return b.type === 'ventforge' && b.built && b.hp > 0 && !b.held && !spent(s, b) && ventOf(s, b) >= 0 && !asleep(s, b);
}

/** Why a finished forge stands cold, or null while it is hot. */
export function forgeIdle(s: GameState, b: Building): string | null {
  if (asleep(s, b)) return 'Its vent lies quiet: forges burn only in the Age of Deep Forges, or the one kept on leaving it';
  if (b.held) return "A rival's soldiers hold its vent: drive them off, or scald them";
  if (spent(s, b)) return `Its steam is spent: hot again in ${Math.ceil((b.spent! - s.tick) / TICK_HZ)} seconds`;
  return null;
}

/** Whether a hot Vent Forge of the building's owner stands within `VENT.reach` of it (centre to centre). */
export function forgeDrives(s: GameState, b: { x: number; y: number; owner: number }): boolean {
  const r2 = VENT.reach * VENT.reach;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'ventforge' || e.owner !== b.owner) continue;
    const dx = e.x - b.x;
    const dy = e.y - b.y;
    if (dx * dx + dy * dy <= r2 && forgeHot(s, e)) return true;
  }
  return false;
}

/**
 * How fast the vents work a building, in hundredths: `VENT.drive` in a hot forge's reach (for a people in the age, or by the forge it
 * kept); in the age, `VENT.cold` out of every one's (not in a Golden Age); elsewhere 100.
 */
export function ventRate(s: GameState, b: Building): number {
  const p = s.players[b.owner];
  const here = !!ageDef(p).vents;
  if (!here && !p.walked?.includes('forges')) return 100;
  if (forgeDrives(s, b)) return VENT.drive;
  // A Golden Age (#703) keeps the forges' gift and drops their price: nothing out of reach runs slow.
  return here && !ageDef(p).golden ? VENT.cold : 100;
}

/**
 * Who holds a vent against its forge's people: the first rival (by unit id) with a soldier on foot within `VENT.hold` tiles of it, while
 * none of the forge's own side's soldiers stand there; or -1.
 */
export function holder(s: GameState, vent: number, owner: number): number {
  const cx = (vent % s.w) + 0.5;
  const cy = Math.floor(vent / s.w) + 0.5;
  const r2 = VENT.hold * VENT.hold;
  let by = -1;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || !MILITARY.includes(e.type) || domainOf(e.type) !== 'land') continue;
    const dx = e.x - cx;
    const dy = e.y - cy;
    if (dx * dx + dy * dy > r2) continue;
    if (!isEnemy(s, owner, e.owner)) return -1;
    if (by < 0) by = e.owner;
  }
  return by;
}

/** Why `owner` can't let this forge's steam out now, or null. */
export function scaldProblem(s: GameState, owner: number, b: Building | null | undefined): string | null {
  if (!b || b.kind !== 'building' || b.type !== 'ventforge' || b.owner !== owner || b.hp <= 0) return 'Pick a Vent Forge of your own';
  if (!b.built) return 'It must stand finished first';
  if (ventOf(s, b) < 0) return 'It stands over no vent';
  if (asleep(s, b)) return 'Its vent lies quiet: forges burn only in the Age of Deep Forges, or the one kept on leaving it';
  if (peace(s)) return 'Not while the peace holds';
  if (b.scaldAt !== undefined && s.tick - b.scaldAt < secs(VENT.again)) return `Its vent breathes again in ${Math.ceil((b.scaldAt + secs(VENT.again) - s.tick) / TICK_HZ)} seconds`;
  return null;
}

/**
 * Let a forge's steam out over its vent: every rival unit on the ground within `VENT.scald` tiles of it takes `VENT.burn`, and the forge
 * lies cold `VENT.spent` seconds. Returns how many were struck. Call only once `scaldProblem` is null.
 */
export function scald(s: GameState, b: Building): number {
  const vent = ventOf(s, b);
  const cx = (vent % s.w) + 0.5;
  const cy = Math.floor(vent / s.w) + 0.5;
  const r2 = VENT.scald * VENT.scald;
  let n = 0;
  for (const u of s.ents) {
    if (u.kind !== 'unit' || u.hp <= 0 || u.inside || domainOf(u.type) !== 'land' || !isEnemy(s, b.owner, u.owner)) continue;
    const dx = u.x - cx;
    const dy = u.y - cy;
    if (dx * dx + dy * dy > r2) continue;
    hurt(s, u, VENT.burn, b.owner, null);
    n++;
  }
  b.scaldAt = s.tick;
  b.spent = s.tick + secs(VENT.spent);
  const st = s.players[b.owner].stats;
  st.scalded = (st.scalded ?? 0) + n;
  s.events.push({ k: 'vent', owner: b.owner, id: b.id, what: 'scald', n, x: b.x, y: b.y });
  return n;
}

/** Once a second: which forges' vents a rival holds, and which have their steam back. */
export function forgeStep(s: GameState): void {
  if (!s.vents || s.tick % TICK_HZ !== 0) return;
  for (const b of s.ents) {
    if (b.kind !== 'building' || b.type !== 'ventforge' || !b.built || b.hp <= 0) continue;
    const vent = ventOf(s, b);
    if (vent < 0) continue;
    const by = holder(s, vent, b.owner);
    const was = !!b.held;
    b.held = by >= 0 ? true : undefined;
    // Its steam back: hot again unless its vent is held.
    const back = b.spent !== undefined && s.tick >= b.spent;
    if (back) b.spent = undefined;
    if (asleep(s, b)) continue;
    if (by >= 0 && !was) s.events.push({ k: 'vent', owner: b.owner, id: b.id, what: 'cold', by, x: b.x, y: b.y });
    else if (by < 0 && (was || back) && !spent(s, b)) s.events.push({ k: 'vent', owner: b.owner, id: b.id, what: 'warm', x: b.x, y: b.y });
  }
}
