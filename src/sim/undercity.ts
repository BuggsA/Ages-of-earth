import { BUILDINGS, TICK_HZ, UNDER, domainOf, secs, type UnitStats } from './data';
import { ageDef } from './ages';
import { distToRect, nearestWalkable } from './grid';
import { B_BUILDING } from './types';
import type { Building, Cost, Ent, GameState, Unit } from './types';
import { statsOf } from './world';

/**
 * The Age of the Undercity (#883, the Deep Road's third age): a people sinks its houses, stores, halls and Barrows below the ground
 * (`sink`, `UNDER.sink` seconds) and surfaces them again (`surface`, `UNDER.rise`). Sunk, a building is bare earth to a rival who hasn't
 * found it (`hiddenFrom`), and nothing but a found foot soldier's blade or a keg reaches it (`canHit` in `world.ts`, `blow` in
 * `powder.ts`). It still houses, stores and shelters, and a sunk Barrow is a mouth of the tunnel, but it trains, researches and shoots
 * nothing (`inert`). Its footprint is open ground while sunk, so a rival's soldiers can stand on it; standing there `UNDER.find`
 * seconds finds it for their team (`underStep`). The kept Storehouse sinks and surfaces on any road.
 */

/** Whether a building is below the ground now. */
export const isSunk = (b: Ent): boolean => b.kind === 'building' && !!b.sunk;

/** Whether a building is sunk, or on its way down or up: it trains, researches and shoots nothing. */
export const inert = (b: Building): boolean => !!b.sunk || b.sinking !== undefined || b.rising !== undefined;

/** Whether a player's team has found this sunk building. */
export function foundBy(s: GameState, b: Building, viewer: number): boolean {
  const team = s.players[viewer]?.team;
  return !!b.found && b.found.some((id) => s.players[id]?.team === team);
}

/**
 * Whether a building is hidden from a player: sunk, a rival's, and not found by the player's team. A hidden building is not seen, not
 * drawn, not aimed at and not named in any command the player gives: to the player it isn't there.
 */
export function hiddenFrom(s: GameState, e: Ent, viewer: number): boolean {
  if (e.kind !== 'building' || !e.sunk) return false;
  const p = s.players[viewer];
  const q = s.players[e.owner];
  if (!p || !q || viewer === e.owner || p.team === q.team) return false;
  return !foundBy(s, e, viewer);
}

/** Whether a soldier's arm can strike a found sunk building: foot soldiers and heroes with blades, at its door. */
export const digsAt = (st: UnitStats): boolean => st.range <= 0 && (st.cls === 'infantry' || st.cls === 'hero');

/** Whether a unit counts toward finding a rival's sunk building: a soldier on foot in the open, armed. */
function seeker(s: GameState, u: Unit): boolean {
  if (u.hp <= 0 || u.inside || domainOf(u.type) !== 'land' || u.type === 'citizen' || u.type === 'siege') return false;
  const st = statsOf(s, u);
  return st.attack > 0 && st.cls !== 'cavalry' && st.cls !== 'siege';
}

/** What it costs to sink a building: `UNDER.cost` stone a tile of its footprint. */
export const sinkCost = (b: Building): Cost => ({ stone: UNDER.cost * b.size * b.size });

/** Whether a people may sink this building now: in the age (or a Golden Age that holds its verb), or the kept Storehouse on any road. */
const sinksHere = (s: GameState, b: Building): boolean => !!ageDef(s.players[b.owner]).sinks || b.keep === 'undercity';

/** Why `owner` can't sink this building now, or null. */
export function sinkProblem(s: GameState, owner: number, b: Building | null | undefined): string | null {
  if (!b || b.kind !== 'building' || b.owner !== owner || b.hp <= 0) return 'Pick a building of your own';
  if (!sinksHere(s, b)) return 'Only a people of the Undercity sinks its buildings (and its kept Storehouse, on any road)';
  if (!UNDER.kinds.includes(b.type)) return `A ${BUILDINGS[b.type].name} can't go below: only Houses, Storehouses, Barracks, Ranges, Stables, Forges, Workshops and Barrows`;
  if (!b.built) return 'Finish it first';
  if (b.sunk) return 'It is sunk already';
  if (b.sinking !== undefined) return 'It is going down';
  if (b.rising !== undefined) return 'It is still coming up';
  const p = s.players[owner];
  const need = sinkCost(b).stone ?? 0;
  if (p.res.stone < need) return `Need ${Math.ceil(need - p.res.stone)} more stone`;
  return null;
}

/** Why `owner` can't bring this building up now, or null. Anything sunk may come up, on any road. */
export function surfaceProblem(s: GameState, owner: number, b: Building | null | undefined): string | null {
  void s;
  if (!b || b.kind !== 'building' || b.owner !== owner || b.hp <= 0) return 'Pick a building of your own';
  if (b.sinking !== undefined) return 'It is still going down';
  if (!b.sunk) return 'It stands on the surface';
  return null;
}

/** Start a building down: paid now, it does nothing from this moment, and is under the ground in `UNDER.sink` seconds. */
export function sink(s: GameState, b: Building): void {
  s.players[b.owner].res.stone -= sinkCost(b).stone ?? 0;
  b.sinking = s.tick + secs(UNDER.sink);
  s.events.push({ k: 'sink', owner: b.owner, id: b.id, what: 'sinking', x: b.x, y: b.y });
}

/**
 * Bring a sunk building up: it stands on its footprint again at once (anyone standing there steps off), seen and struck as any other,
 * and goes back to work in `UNDER.rise` seconds. Who found it is forgotten: sunk again, it must be found again.
 */
export function surface(s: GameState, b: Building): void {
  delete b.sunk;
  delete b.found;
  delete b.feel;
  b.rising = s.tick + secs(UNDER.rise);
  ground(s, b, true);
  s.events.push({ k: 'sink', owner: b.owner, id: b.id, what: 'rising', x: b.x, y: b.y });
}

/** A building's footprint closes (it stands on it) or opens (it is under it), and those standing on a closing one step off. */
function ground(s: GameState, b: Building, shut: boolean): void {
  for (let y = b.ty; y < b.ty + b.size; y++) {
    for (let x = b.tx; x < b.tx + b.size; x++) {
      const i = y * s.w + x;
      s.block[i] = shut ? s.block[i] | B_BUILDING : s.block[i] & ~B_BUILDING;
    }
  }
  if (!shut) return;
  s.blockVersion++;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || e.hp <= 0 || e.inside || domainOf(e.type) !== 'land' || distToRect(e.x, e.y, b) > 0) continue;
    const t = nearestWalkable(s, e.x, e.y);
    if (t < 0) continue;
    e.x = e.px = (t % s.w) + 0.5;
    e.y = e.py = Math.floor(t / s.w) + 0.5;
  }
}

/** A keg blown on a sunk building (`powder.ts`) caves it in: it strikes harder, and the blast shows the cellar to whoever lit it. */
export function caveIn(s: GameState, b: Building, by: number): number {
  if (!b.sunk) return 1;
  if (!foundBy(s, b, by)) {
    (b.found ??= []).push(by);
    s.events.push({ k: 'sink', owner: b.owner, id: b.id, what: 'caved', by, x: b.x, y: b.y });
  }
  return UNDER.keg;
}

/**
 * Each tick: buildings going down are sunk when their time comes (their footprint opens), and those coming up are at work again. Once
 * a second, each rival team whose foot soldiers stand on a sunk building counts the seconds; `UNDER.find` unbroken finds it.
 */
export function underStep(s: GameState): void {
  const second = s.tick % TICK_HZ === 0;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.hp <= 0) continue;
    if (e.sinking !== undefined && s.tick >= e.sinking) {
      delete e.sinking;
      e.sunk = true;
      ground(s, e, false);
      const p = s.players[e.owner];
      p.stats.sunk = (p.stats.sunk ?? 0) + 1;
      s.events.push({ k: 'sink', owner: e.owner, id: e.id, what: 'sunk', x: e.x, y: e.y });
    }
    if (e.rising !== undefined && s.tick >= e.rising) delete e.rising;
    if (second && e.sunk) feel(s, e);
  }
}

/** One second of rival feet on a sunk building: each player with a foot soldier on it counts on, the rest start again. */
function feel(s: GameState, b: Building): void {
  const owner = s.players[b.owner];
  for (const p of s.players) {
    if (p.defeated || p.team === owner.team || foundBy(s, b, p.id)) continue;
    let on = false;
    for (const e of s.ents) {
      if (e.kind === 'unit' && e.owner === p.id && distToRect(e.x, e.y, b) <= UNDER.feel && seeker(s, e)) {
        on = true;
        break;
      }
    }
    const f = (b.feel ??= []);
    while (f.length <= p.id) f.push(0);
    f[p.id] = on ? f[p.id] + 1 : 0;
    if (f[p.id] < UNDER.find) continue;
    (b.found ??= []).push(p.id);
    f[p.id] = 0;
    p.stats.unearthed = (p.stats.unearthed ?? 0) + 1;
    s.events.push({ k: 'sink', owner: b.owner, id: b.id, what: 'found', by: p.id, x: b.x, y: b.y });
  }
  if (b.feel && b.feel.every((n) => n === 0)) delete b.feel;
}
