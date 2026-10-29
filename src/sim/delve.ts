import { BUILDINGS, DELVE, domainOf, secs, unitStats } from './data';
import { ageDef, asleep } from './ages';
import type { Building, GameState, Unit } from './types';

/**
 * The Age of Delvings (#881, the Deep Road's second age): every Barrow and Town Center of a people is a mouth of one tunnel. Those
 * sheltering in one mouth are sent below to another (`delve`), taking `DELVE.pace` tiles a second, and come up there when they arrive
 * (`delveStep`). A Barrow kept from the age keeps its tunnel to the people's Town Centers on any road.
 */

/** Whether a unit may go below: a land unit that is no rider (horses don't go below) and no siege engine. */
export const canDelve = (u: Unit): boolean => domainOf(u.type) === 'land' && u.type !== 'siege' && unitStats(u.type, 0).cls !== 'cavalry';

/** Whether a unit is below ground now, on its way to the mouth it is inside. */
export const isBelow = (s: GameState, u: Unit): boolean => !!u.inside && (u.below ?? 0) > s.tick;

/** Whether a people's kept Barrow stands (its tunnel runs to its Town Centers on any road). */
const keptBarrow = (s: GameState, owner: number): Building | undefined =>
  s.ents.find((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'barrow' && e.keep === 'delvings' && e.built && e.hp > 0);

/** Whether this building is a mouth of its people's tunnel now. */
export function isMouth(s: GameState, b: Building): boolean {
  if (!b.built || b.hp <= 0) return false;
  const p = s.players[b.owner];
  if (b.type === 'barrow') return !asleep(s, b);
  if (b.type !== 'towncenter') return false;
  return !!ageDef(p).delves || !!keptBarrow(s, b.owner);
}

/** Why `from` can't send its people below to `to`, or null. */
export function delveProblem(s: GameState, owner: number, from: Building | undefined, to: Building | undefined): string | null {
  if (!from || !to || from.kind !== 'building' || to.kind !== 'building' || from.owner !== owner || to.owner !== owner) return 'Pick two mouths of your own';
  if (from.id === to.id) return 'Pick another mouth';
  if (!isMouth(s, from) || !isMouth(s, to)) return 'Only a Barrow or a Town Center joined to the tunnel is a mouth';
  // Out of the age a kept Barrow is the tunnel: it runs between that Barrow and the Town Centers, not from one Town Center to another.
  if (!ageDef(s.players[owner]).delves && from.type !== 'barrow' && to.type !== 'barrow') return 'Out of the Delvings the tunnel runs only from your kept Barrow';
  if (!delvers(s, from).length) return 'No one sheltering here can go below (riders and siege engines stay up)';
  if (room(to) <= 0) return 'That mouth is full';
  return null;
}

/** Room left at a mouth: its shelter, less those already inside or on their way. */
const room = (b: Building): number => (BUILDINGS[b.type].garrison ?? 0) - b.garrison.length;

/** Those at a mouth who may go below now: inside, arrived, and no rider or siege engine. */
export function delvers(s: GameState, b: Building): Unit[] {
  const out: Unit[] = [];
  for (const id of b.garrison) {
    const u = s.byId.get(id);
    if (u && u.kind === 'unit' && u.hp > 0 && !isBelow(s, u) && canDelve(u)) out.push(u);
  }
  return out;
}

/** Seconds below from one mouth to another. */
export function delveTime(from: Building, to: Building): number {
  const dx = to.x - from.x, dy = to.y - from.y;
  return Math.max(DELVE.least, Math.sqrt(dx * dx + dy * dy) / DELVE.pace);
}

/** Send those who may go below from `from` to `to`, as many as it has room for: they are inside `to` at once, and come up when they arrive. */
export function delve(s: GameState, from: Building, to: Building): number {
  const go = delvers(s, from).slice(0, room(to));
  if (!go.length) return 0;
  const at = s.tick + secs(delveTime(from, to));
  const gone = new Set(go.map((u) => u.id));
  from.garrison = from.garrison.filter((id) => !gone.has(id));
  for (const u of go) {
    u.inside = to.id;
    u.below = at;
    u.x = u.px = to.x;
    u.y = u.py = to.y;
    to.garrison.push(u.id);
  }
  const p = s.players[from.owner];
  p.stats.delved = (p.stats.delved ?? 0) + go.length;
  s.events.push({ k: 'delve', owner: from.owner, from: from.id, to: to.id, n: go.length, x: from.x, y: from.y });
  return go.length;
}

/** Those who arrive come up beside the mouth they were bound for, and go back to what they were doing. */
export function delveStep(s: GameState, out: (s: GameState, b: Building, only: (u: Unit) => boolean) => void): void {
  for (const e of s.ents) {
    if (e.kind !== 'building' || !e.garrison.length) continue;
    let n = 0;
    for (const id of e.garrison) {
      const u = s.byId.get(id);
      if (u && u.kind === 'unit' && u.below === s.tick) n++;
    }
    if (!n) continue;
    out(s, e, (u) => u.below === s.tick);
    s.events.push({ k: 'surface', owner: e.owner, building: e.id, n, x: e.x, y: e.y });
  }
}
