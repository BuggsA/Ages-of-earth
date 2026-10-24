import { BUILDINGS, FLEE, WAYS, secs } from './data';
import { distToRect } from './grid';
import { garrisonRoom, setOrder, ungarrison } from './units';
import type { Building, Ent, GameState, Unit } from './types';
import { isEnemy, statsOf } from './world';

/** Citizens running from danger: into shelter from soldiers, out of range of towers. */

/** Whether a citizen runs from danger: its own setting, else its player's; the computer's citizens never do. */
export function flees(s: GameState, u: Unit): boolean {
  const p = s.players[u.owner];
  return !!p && p.ai === null && (u.flee ?? !p.noFlee);
}

/** A citizen has been struck by `by` (a unit, or null for a tower or any other source): it runs if it flees. */
export function alarm(s: GameState, u: Unit, source: Unit | null): void {
  if (u.type !== 'citizen' || u.hp <= 0 || u.inside || u.order.k === 'garrison' || !flees(s, u)) return;
  // Already on the run: let it finish.
  if (u.fled !== undefined && s.tick - u.fled < secs(2)) return;
  if (source && statsOf(s, source).attack > 0) {
    // A people whose bell never rings never shelters either.
    const way = s.players[u.owner].way;
    const home = way && WAYS[way].noBell ? null : shelterFor(s, u);
    if (home) {
      u.resume = work(u);
      u.queue = [];
      u.fled = s.tick;
      setOrder(u, { k: 'garrison', target: home.id, flee: true });
    } else runFrom(s, u, source.x, source.y, FLEE.run);
    return;
  }
  // No soldier struck it: a tower or Town Center's arrows. Step out of the nearest one's reach.
  let gun: Building | null = null;
  let best = Infinity;
  for (const e of s.ents) {
    if (e.kind !== 'building' || !e.built || e.hp <= 0 || !BUILDINGS[e.type].guns || !isEnemy(s, u.owner, e.owner)) continue;
    const d = distToRect(u.x, u.y, e);
    if (d < best) {
      best = d;
      gun = e;
    }
  }
  if (!gun) return;
  const g = BUILDINGS[gun.type].guns!;
  const reach = g.range + gun.size / 2 + FLEE.pad;
  u.resume = null;
  u.queue = [];
  runFrom(s, u, gun.x, gun.y, Math.max(2, reach - Math.sqrt((u.x - gun.x) * (u.x - gun.x) + (u.y - gun.y) * (u.y - gun.y)) + FLEE.pad));
}

/** The work a citizen should go back to afterward (as the town bell remembers it). */
function work(u: Unit) {
  const o = u.order;
  return o.k === 'gather' || o.k === 'farm' || o.k === 'snare' ? { ...o, phase: 'go' as const } : o.k === 'build' ? o : null;
}

/** The nearest built shelter of the citizen's own within `FLEE.shelter` tiles that has room. */
function shelterFor(s: GameState, u: Unit): Building | null {
  let best: Building | null = null;
  let bestD = FLEE.shelter * FLEE.shelter;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== u.owner || !e.built || e.hp <= 0 || !BUILDINGS[e.type].garrison || garrisonRoom(e) - heading(s, e) <= 0) continue;
    const dx = e.x - u.x;
    const dy = e.y - u.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** How many are already on their way into a building, so one tower isn't promised more than it holds. */
function heading(s: GameState, b: Building): number {
  let n = 0;
  for (const e of s.ents) if (e.kind === 'unit' && e.order.k === 'garrison' && e.order.target === b.id) n++;
  return n;
}

/** Walk `far` tiles straight away from a point (kept on the map; the walk itself finds its way). */
function runFrom(s: GameState, u: Unit, x: number, y: number, far: number): void {
  let dx = u.x - x;
  let dy = u.y - y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.01) {
    dx = (u.id % 2) * 2 - 1;
    dy = 0;
  } else {
    dx /= d;
    dy /= d;
  }
  const tx = Math.min(s.w - 1.5, Math.max(1.5, u.x + dx * far));
  const ty = Math.min(s.h - 1.5, Math.max(1.5, u.y + dy * far));
  u.fled = s.tick;
  setOrder(u, { k: 'move', x: tx, y: ty, amove: false, started: false });
}

/** Every second: citizens who took shelter on their own come out once no armed foe is near their shelter. */
export function fleeStep(s: GameState): void {
  if (s.tick % 20 !== 0) return;
  let foes: Ent[] | null = null;
  const out = new Map<number, Set<number>>();
  for (const u of s.ents) {
    if (u.kind !== 'unit' || !u.inside || u.fled === undefined || s.tick - u.fled < secs(FLEE.hold)) continue;
    const b = s.byId.get(u.inside);
    if (!b || b.kind !== 'building') continue;
    foes ??= s.ents.filter((e) => e.kind === 'unit' && e.hp > 0 && !e.inside && statsOf(s, e).attack > 0);
    const near = foes.some((f) => isEnemy(s, u.owner, f.owner) && distToRect(f.x, f.y, b) < FLEE.clear);
    if (near) continue;
    if (!out.has(b.id)) out.set(b.id, new Set());
    out.get(b.id)!.add(u.id);
  }
  for (const [id, ids] of out) ungarrison(s, s.byId.get(id) as Building, (u) => ids.has(u.id));
}
