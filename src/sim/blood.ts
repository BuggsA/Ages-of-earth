import { BLOOD, BUILDINGS, HEMO, secs, TICK_HZ, type UnitClass } from './data';
import { ageDef } from './ages';
import { statsOf } from './world';
import type { Building, BuildingType, Ent, GameState, Player, Unit, UnitType } from './types';

/**
 * Blood (#355 s1): a store of its own, kept as `Player.blood` so the four ordinary resources stay as they are. It is drawn two ways:
 * from the enemy's living dead that fall within `BLOOD.reach` tiles of one of the killer's finished Drain Rigs, and by the levy,
 * which turns the citizens near a rig into blood. It is spent (s3) on Blood Towers, paid once to raise, and at Transfusion Stations,
 * which graft soldiers (`hemo.ts`).
 */

/** Machines and ships bleed nothing. */
const BLOODLESS: readonly UnitType[] = ['siege', 'warship', 'transport', 'cog', 'fighter', 'bomber', 'wagon'];

/** Whether a unit bleeds: everything but machines and ships. */
export function bleeds(u: Unit): boolean {
  return !BLOODLESS.includes(u.type);
}

/** The soldiers a Transfusion Station can graft: the living who fight on foot or horseback. */
export const GRAFTABLE: readonly UnitType[] = ['infantry', 'ranged', 'cavalry', 'hero'];

/** Whether a unit carries a live graft (#355 s3). */
export function grafted(s: GameState, u: Ent): boolean {
  return u.kind === 'unit' && u.hemo !== undefined && s.tick < u.hemo;
}

/** Machines that hit a grafted soldier harder; every other unit class is flesh. */
const MACHINES: readonly UnitClass[] = ['siege', 'ship', 'fighter', 'bomber'];

/**
 * How hard a blow lands on `target` (#355 s3): 1 unless it is grafted. Then blows from the living (a unit class, or a Watch Tower's
 * `arrow`) land `HEMO.flesh` times as hard and blows from machines (`MACHINES`, or a Coil Tower's `coil`) `HEMO.machine` times;
 * a Blood Tower's bolt (`blood`) lands in full.
 */
export function hemoTaken(s: GameState, target: Ent, from: UnitClass | 'arrow' | 'coil' | 'blood'): number {
  if (!grafted(s, target) || from === 'blood') return 1;
  return from === 'coil' || MACHINES.includes(from as UnitClass) ? HEMO.machine : HEMO.flesh;
}

/** Blows a grafted soldier strikes land this many times harder. */
export function hemoBlow(s: GameState, u: Unit | null): number {
  return u && grafted(s, u) ? HEMO.attack : 1;
}

/** A grafted soldier walks this many times faster. */
export function hemoPace(s: GameState, u: Unit): number {
  return grafted(s, u) ? HEMO.pace : 1;
}

/** What blood is missing to raise a building, in words, or null (only the Blood Tower costs any). */
export function bloodShort(p: Player, type: BuildingType): string | null {
  const need = (BUILDINGS[type].blood ?? 0) - bloodOf(p);
  return need > 0 ? `Need ${Math.ceil(need)} more blood` : null;
}

/** The blood a player holds. */
export function bloodOf(p: Player): number {
  return p.blood ?? 0;
}

function rigsOf(s: GameState, owner: number): Building[] {
  const out: Building[] = [];
  for (const e of s.ents) if (e.kind === 'building' && e.type === 'drainrig' && e.owner === owner && e.built && e.hp > 0) out.push(e);
  return out;
}

/** Whether the player has a Drain Rig standing, so the blood store shows. */
export function hasRig(s: GameState, owner: number): boolean {
  return rigsOf(s, owner).length > 0;
}

function add(s: GameState, p: Player, n: number, x: number, y: number, how: 'slain' | 'levy'): void {
  p.blood = bloodOf(p) + n;
  p.stats.blood = (p.stats.blood ?? 0) + n;
  s.events.push({ k: 'blood', owner: p.id, x, y, n, how });
}

/** A unit of the enemy has fallen to `by`: a Drain Rig of theirs near the fall draws a share of its price as blood. */
export function drawBlood(s: GameState, target: Unit, by: number): void {
  if (BLOODLESS.includes(target.type)) return;
  const p = s.players[by];
  if (!ageDef(p).blood) return;
  const r2 = BLOOD.reach * BLOOD.reach;
  if (!rigsOf(s, by).some((b) => (b.x - target.x) * (b.x - target.x) + (b.y - target.y) * (b.y - target.y) <= r2)) return;
  const c = statsOf(s, target).cost;
  const n = Math.max(1, Math.floor(((c.food ?? 0) + (c.wood ?? 0) + (c.gold ?? 0) + (c.stone ?? 0)) * BLOOD.share));
  add(s, p, n, target.x, target.y, 'slain');
}

/** The player's citizens within `BLOOD.levyReach` tiles of the rig, nearest first (ties in id order). */
export function levyReach(s: GameState, b: Building): Unit[] {
  const r2 = BLOOD.levyReach * BLOOD.levyReach;
  const near: { u: Unit; d: number }[] = [];
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.type !== 'citizen' || e.owner !== b.owner || e.hp <= 0 || e.inside) continue;
    const d = (e.x - b.x) * (e.x - b.x) + (e.y - b.y) * (e.y - b.y);
    if (d <= r2) near.push({ u: e, d });
  }
  near.sort((a, c) => a.d - c.d || a.u.id - c.u.id);
  return near.map((n) => n.u);
}

/** Whole seconds before a rig may take another levy; 0 when it may. */
export function levyWait(s: GameState, b: Building): number {
  return b.muster === undefined ? 0 : Math.max(0, Math.ceil((b.muster - s.tick) / TICK_HZ));
}

/** Why this rig can't take a levy now, or null. */
export function levyProblem(s: GameState, p: Player, b: Building): string | null {
  if (b.owner !== p.id || b.type !== 'drainrig' || !b.built || b.hp <= 0) return `Only a finished ${BUILDINGS.drainrig.name} takes a levy`;
  const wait = levyWait(s, b);
  if (wait > 0) return `The rig is still drawing the last levy: ${wait}s`;
  if (!levyReach(s, b).length) return `No citizen of yours within ${BLOOD.levyReach} tiles`;
  return null;
}

/**
 * Takes up to `n` citizens (at most `BLOOD.levyMost`) near the rig and draws `BLOOD.levy` blood from each; they are gone, and so is
 * what they carried. The rig rests `BLOOD.rest` seconds for each. Returns how many were taken.
 */
export function levy(s: GameState, p: Player, b: Building, n = 1): number {
  const taken = levyReach(s, b).slice(0, Math.max(1, Math.min(Math.floor(n), BLOOD.levyMost)));
  if (!taken.length) return 0;
  const gone = new Set<number>();
  for (const c of taken) {
    gone.add(c.id);
    s.byId.delete(c.id);
  }
  s.ents = s.ents.filter((e) => !gone.has(e.id));
  b.muster = s.tick + secs(BLOOD.rest) * taken.length;
  p.stats.levied = (p.stats.levied ?? 0) + taken.length;
  add(s, p, BLOOD.levy * taken.length, b.x, b.y, 'levy');
  return taken.length;
}
