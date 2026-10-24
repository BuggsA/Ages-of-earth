import { BLOOD, BUILDINGS, HEMO, ORDERS, RITE, secs, TICK_HZ, type UnitClass } from './data';
import { ageDef, asleep, sleepWhy } from './ages';
import { modsOf } from './stats';
import { exitSpot, spawnUnit, statsOf } from './world';
import type { Animal, Building, BuildingType, Ent, GameState, Player, Unit, UnitType } from './types';

/**
 * Blood (#355 s1): a store of its own, kept as `Player.blood` so the four ordinary resources stay as they are. It is drawn two ways:
 * from the enemy's living dead that fall within `BLOOD.reach` tiles of one of the killer's finished Drain Rigs, and by the levy,
 * which turns the citizens near a rig into blood. It is spent (s3) on Blood Towers, paid once to raise, and at Transfusion Stations,
 * which graft soldiers (`hemo.ts`). Past the fork (s2, `fork.ts`) Hemocraft's rigs also bleed the living who stand near them, and the
 * Blood-rite's Temples draw as rigs do and pay blood out to mend. Beasts slain near a rig give blood, a rig bleeds the flock that grazes
 * by it, and an enemy citizen struck down near one is taken there captive and bled (`bloodStep`).
 */

/** Machines and ships bleed nothing. */
const BLOODLESS: readonly UnitType[] = ['siege', 'warship', 'transport', 'cog', 'fighter', 'bomber', 'wagon', 'tow'];

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

/**
 * Whether a soldier is sworn (Military Orders, #355 s6): its people learned the heirloom and one of their priests stands within
 * `ORDERS.reach` tiles of it, out in the open. No rival's priest can turn, offer up or curse a sworn soldier.
 */
export function sworn(s: GameState, u: Ent): boolean {
  if (u.kind !== 'unit' || !GRAFTABLE.includes(u.type) || !modsOf(s, u.owner).sworn) return false;
  const r2 = ORDERS.reach * ORDERS.reach;
  return s.ents.some((e) => e.kind === 'unit' && e.type === 'priest' && e.owner === u.owner && e.hp > 0 && !e.inside && (e.x - u.x) * (e.x - u.x) + (e.y - u.y) * (e.y - u.y) <= r2);
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

/** Whether a unit lies under a Blood-rite curse (#355 s4). */
export function cursed(s: GameState, u: Ent): boolean {
  return u.kind === 'unit' && u.cursed !== undefined && s.tick < u.cursed;
}

/** How many times harder a blow lands on `target`: `RITE.taken` while it is cursed, else 1. */
export function curseTaken(s: GameState, target: Ent): number {
  return cursed(s, target) ? RITE.taken : 1;
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

/** The people's finished, standing buildings of one type, in id order. */
function standing(s: GameState, owner: number, type: BuildingType): Building[] {
  const out: Building[] = [];
  for (const e of s.ents) if (e.kind === 'building' && e.type === type && e.owner === owner && e.built && e.hp > 0) out.push(e);
  return out;
}

/** The people's Drain Rigs at work: standing, and awake (a rig sleeps off the ages of blood, #555 s10). */
const rigsOf = (s: GameState, owner: number): Building[] => standing(s, owner, 'drainrig').filter((b) => !asleep(s, b));

/** Whether the player has a Drain Rig standing, awake or asleep, so the blood store shows. */
export function hasRig(s: GameState, owner: number): boolean {
  return standing(s, owner, 'drainrig').length > 0;
}

/** Blood comes into a people's store, and the tally that the fork's deeds and the end report read. */
export function gainBlood(s: GameState, p: Player, n: number, x: number, y: number, how: 'slain' | 'levy' | 'drain' | 'sacrifice' | 'beast' | 'flock' | 'captive'): void {
  p.blood = bloodOf(p) + n;
  p.stats.blood = (p.stats.blood ?? 0) + n;
  s.events.push({ k: 'blood', owner: p.id, x, y, n, how });
}

/**
 * A people's Drain Rigs within `BLOOD.reach` tiles of a point, nearest first (ties in id order), while it walks an age of blood. In
 * the Blood-rite (#355 s2) every Temple is an altar, and counts as a rig does.
 */
function drawers(s: GameState, by: number, x: number, y: number): Building[] {
  const age = ageDef(s.players[by]);
  // Off the ages of blood every rig sleeps (#555 s10), so nothing draws, but for the keepsakes (#555 s11): a rig kept from Hemocraft,
  // or a Temple kept as the Blood-rite's altar.
  const rigs = rigsOf(s, by);
  const altars = standing(s, by, 'temple').filter((b) => age.rite || b.keep === 'bloodrite');
  if (!age.blood && !rigs.length && !altars.length) return [];
  const r2 = BLOOD.reach * BLOOD.reach;
  const near: { b: Building; d: number }[] = [];
  const look = (b: Building) => {
    const d = (b.x - x) * (b.x - x) + (b.y - y) * (b.y - y);
    if (d <= r2) near.push({ b, d });
  };
  rigs.forEach(look);
  altars.forEach(look);
  near.sort((a, c) => a.d - c.d || a.b.id - c.b.id);
  return near.map((n) => n.b);
}

/**
 * A unit of the enemy has fallen to `by`: a Drain Rig of theirs near the fall draws a share of its price as blood. An enemy citizen
 * struck down by one of `by`'s soldiers (`credit`) is taken alive into the rig instead, while it has room (`takeCaptive`).
 */
export function drawBlood(s: GameState, target: Unit, by: number, credit: Unit | null = null): void {
  if (BLOODLESS.includes(target.type)) return;
  const at = drawers(s, by, target.x, target.y);
  if (!at.length || takeCaptive(s, target, by, credit, at)) return;
  const c = statsOf(s, target).cost;
  const n = Math.max(1, Math.floor(((c.food ?? 0) + (c.wood ?? 0) + (c.gold ?? 0) + (c.stone ?? 0)) * BLOOD.share));
  gainBlood(s, s.players[by], n, target.x, target.y, 'slain');
}

/**
 * Captives (#355): an enemy citizen struck down by a soldier on foot or horseback is taken alive into the nearest of `at` (rigs and
 * altars near the fall) that holds fewer than `BLOOD.hold`, rather than slain. It is gone from its people all the same. True if taken.
 */
function takeCaptive(s: GameState, target: Unit, by: number, credit: Unit | null, at: Building[]): boolean {
  if (target.type !== 'citizen' || !credit || credit.owner !== by || !GRAFTABLE.includes(credit.type)) return false;
  const b = at.find((e) => (e.captives?.length ?? 0) < BLOOD.hold);
  if (!b) return false;
  (b.captives ??= []).push({ p: target.owner, left: BLOOD.captive });
  const st = s.players[by].stats;
  st.captives = (st.captives ?? 0) + 1;
  s.events.push({ k: 'captive', owner: by, from: target.owner, x: b.x, y: b.y, what: 'taken' });
  return true;
}

/** Blood a slain beast gives: `BLOOD.beast` of its meat, or `BLOOD.wolf` for a wolf (it leaves none); raiders give none. */
export function beastBlood(kind: Animal['kind'], meat: number): number {
  if (kind === 'raider') return 0;
  return kind === 'wolf' ? BLOOD.wolf : Math.max(1, Math.floor(meat * BLOOD.beast));
}

/** A beast has fallen to `by`'s people at `x, y` (#355): a rig or altar of theirs near it draws its blood. */
export function drawBeast(s: GameState, a: Animal, meat: number, by: number): void {
  const n = beastBlood(a.kind, meat);
  if (n <= 0 || !drawers(s, by, a.x, a.y).length) return;
  gainBlood(s, s.players[by], n, a.x, a.y, 'beast');
}

/** The captives a rig or altar holds. */
export function captivesOf(b: Building): number {
  return b.captives?.length ?? 0;
}

/** A rig or altar has fallen: its captives go free, citizens of their own people again where it stood (if that people still stands). */
export function freeCaptives(s: GameState, b: Building): void {
  if (!b.captives?.length) return;
  for (const c of b.captives) {
    const p = s.players[c.p];
    if (!p || p.defeated) continue;
    const spot = exitSpot(s, b, b.x, b.y + b.size, p.team);
    spawnUnit(s, c.p, 'citizen', spot.x, spot.y);
    s.events.push({ k: 'captive', owner: b.owner, from: c.p, x: spot.x, y: spot.y, what: 'freed' });
  }
  delete b.captives;
}

/** Sheep of the rig's people within `BLOOD.flockReach` tiles of it with milk in the udder, in id order. */
export function bledFlock(s: GameState, b: Building): Animal[] {
  const r2 = BLOOD.flockReach * BLOOD.flockReach;
  return s.animals.filter((a) => a.kind === 'sheep' && a.owner === b.owner && a.hp > 0 && a.lamb === undefined && (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) <= r2);
}

/** Once a second (#355): every finished rig bleeds the flock grazing by it, and every rig or altar bleeds its captives. */
export function bloodStep(s: GameState): void {
  if (s.tick % TICK_HZ !== 0) return;
  for (const b of s.ents) {
    // A sleeping rig (#555 s10) bleeds neither flock nor captives: they wait for its people to return.
    if (b.kind !== 'building' || !b.built || b.hp <= 0 || asleep(s, b)) continue;
    const p = s.players[b.owner];
    if (b.type === 'drainrig') {
      for (const a of bledFlock(s, b)) {
        const take = Math.min(Math.floor(a.milk ?? 0), BLOOD.flockMilk);
        if (take <= 0) continue;
        a.milk = (a.milk ?? 0) - take;
        gainBlood(s, p, take * BLOOD.flockYield, a.x, a.y, 'flock');
      }
    }
    if (!b.captives?.length) continue;
    let n = 0;
    for (const c of b.captives) {
      const d = Math.min(c.left, BLOOD.bleed);
      c.left -= d;
      n += d;
      if (c.left <= 0) s.events.push({ k: 'captive', owner: b.owner, from: c.p, x: b.x, y: b.y, what: 'spent' });
    }
    b.captives = b.captives.filter((c) => c.left > 0);
    if (!b.captives.length) delete b.captives;
    if (n > 0) gainBlood(s, p, n, b.x, b.y, 'captive');
  }
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
  if (asleep(s, b)) return sleepWhy(b);
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
  gainBlood(s, p, BLOOD.levy * taken.length, b.x, b.y, 'levy');
  return taken.length;
}
