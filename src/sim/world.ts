import { BUILDINGS, LANDMARKS, POP_MAX, domainOf, type UnitStats } from './data';
import { AIR, NAVAL, distToRect, nearestWalkable, stampBuilding, walkable } from './grid';
import { buildingMaxHp, statsFor } from './stats';
import type { Building, BuildingType, Cost, Ent, GameState, Goal, Player, Unit, UnitType } from './types';
import { RES } from './types';

/** Making, finding and removing units and buildings. */

export function statsOf(s: GameState, u: Unit): UnitStats {
  return statsFor(s, u.owner, u.type);
}

export function maxHp(s: GameState, e: Ent): number {
  return e.kind === 'unit' ? statsOf(s, e).hp : buildingMaxHp(s, e.owner, e.type);
}

/** The team a player is on (gates open for their own team). */
export const teamOf = (s: GameState, owner: number) => s.players[owner].team;

/** How a unit passes over tiles, for the tile tests and routes: its team on foot, or NAVAL, or AIR. */
export function passOf(s: GameState, u: Unit): number {
  const d = domainOf(u.type);
  return d === 'water' ? NAVAL : d === 'air' ? AIR : s.players[u.owner].team;
}

/**
 * Whether a unit can fight a target at all: only missiles reach ships and aircraft (and of those, not
 * siege or bombers at aircraft); rams go only for buildings and siege; unarmed units fight nothing.
 */
export function canHit(s: GameState, u: Unit, t: Ent): boolean {
  const st = statsOf(s, u);
  if (st.attack <= 0) return false;
  if (t.kind === 'building') return true;
  if (st.buildingsOnly) return t.type === 'siege';
  const d = domainOf(t.type);
  if (d === 'air') return st.range > 0 && st.cls !== 'siege' && st.cls !== 'bomber';
  if (d === 'water') return st.range > 0;
  return true;
}

export function radiusOf(s: GameState, e: Ent): number {
  return e.kind === 'unit' ? statsOf(s, e).radius : e.size / 2;
}

export const isEnemy = (s: GameState, a: number, b: number) => a !== b && s.players[a].team !== s.players[b].team;

export function canAfford(p: Player, cost: Cost): boolean {
  return RES.every((r) => p.res[r] >= (cost[r] ?? 0));
}

export function pay(p: Player, cost: Cost): void {
  for (const r of RES) p.res[r] -= cost[r] ?? 0;
}

export function refund(p: Player, cost: Cost, share = 1): void {
  for (const r of RES) p.res[r] += Math.floor((cost[r] ?? 0) * share);
}

export function spawnUnit(s: GameState, owner: number, type: UnitType, x: number, y: number): Unit {
  const u: Unit = {
    id: s.nextId++,
    owner,
    kind: 'unit',
    type,
    x,
    y,
    px: x,
    py: y,
    fx: 0,
    fy: 1,
    hp: statsFor(s, owner, type).hp,
    order: { k: 'idle' },
    queue: [],
    stance: 'aggressive',
    guardX: x,
    guardY: y,
    inside: 0,
    path: null,
    pathI: 0,
    goal: null,
    wantPath: false,
    pathTick: -999,
    cool: 0,
    carry: 0,
    carryRes: null,
    frac: 0,
    stuck: 0,
    miss: 0,
    resume: null,
    cargo: [],
    act: 'idle',
    swing: -999,
    hurt: -999,
    born: s.tick,
    aura: -999,
  };
  s.ents.push(u);
  s.byId.set(u.id, u);
  return u;
}

export function placeBuilding(s: GameState, owner: number, type: BuildingType, tx: number, ty: number, built: boolean): Building {
  const size = BUILDINGS[type].size;
  const b: Building = {
    id: s.nextId++,
    owner,
    kind: 'building',
    type,
    tx,
    ty,
    size,
    x: tx + size / 2,
    y: ty + size / 2,
    hp: built ? buildingMaxHp(s, owner, type) : 1,
    built,
    progress: built ? 1 : 0,
    queue: [],
    advance: -1,
    rally: null,
    cool: 0,
    farmer: 0,
    garrison: [],
    timer: -1,
    dir: 0,
    hurt: -999,
    born: s.tick,
  };
  if (type === 'dock') b.dir = waterSide(s, tx, ty, size);
  s.ents.push(b);
  s.byId.set(b.id, b);
  stampBuilding(s, b, true);
  return b;
}

/** Which side of a footprint has the most open water: 0 south (+y), 1 east (+x), 2 north, 3 west. */
export function waterSide(s: GameState, tx: number, ty: number, size: number): number {
  const counts = [0, 0, 0, 0];
  for (let k = -1; k <= size; k++) {
    if (walkable(s, tx + k, ty + size, NAVAL)) counts[0]++;
    if (walkable(s, tx + size, ty + k, NAVAL)) counts[1]++;
    if (walkable(s, tx + k, ty - 1, NAVAL)) counts[2]++;
    if (walkable(s, tx - 1, ty + k, NAVAL)) counts[3]++;
  }
  let best = 0;
  for (let d = 1; d < 4; d++) if (counts[d] > counts[best]) best = d;
  return best;
}

/** Units, buildings and capacity are counted again every tick. */
export function countPop(s: GameState): void {
  for (const p of s.players) {
    p.pop = 0;
    p.cap = 0;
  }
  for (const e of s.ents) {
    if (e.hp <= 0) continue;
    const p = s.players[e.owner];
    if (e.kind === 'unit') p.pop++;
    else if (e.built) p.cap += BUILDINGS[e.type].pop;
  }
  // An Ancestors' Cairn gives its keeper room for more.
  for (const m of s.landmarks ?? []) if (m.kind === 'cairn' && m.owner >= 0) s.players[m.owner].cap += LANDMARKS.cairn.pop;
  for (const p of s.players) p.cap = Math.min(POP_MAX, p.cap);
}

/** A walkable spot beside a building, on the side nearest to a point (open water, for ships from a dock). */
export function exitSpot(s: GameState, b: Building, towardX: number, towardY: number, pass = s.players[b.owner].team): { x: number; y: number } {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (let ring = 0; ring < 6 && !best; ring++) {
    const x0 = b.tx - 1 - ring;
    const y0 = b.ty - 1 - ring;
    const x1 = b.tx + b.size + ring;
    const y1 = b.ty + b.size + ring;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
        if (!walkable(s, x, y, pass)) continue;
        const dx = x + 0.5 - towardX;
        const dy = y + 0.5 - towardY;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = { x: x + 0.5, y: y + 0.5 };
        }
      }
    }
  }
  if (best) return best;
  const t = nearestWalkable(s, b.x, b.y + b.size, 20, pass);
  return t >= 0 ? { x: (t % s.w) + 0.5, y: Math.floor(t / s.w) + 0.5 } : { x: b.x, y: b.y + b.size / 2 + 0.5 };
}

/** The nearest finished building of a player's that takes this resource (for boats, a dock). */
export function nearestDrop(s: GameState, owner: number, res: string, x: number, y: number, naval = false): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== owner || !e.built || e.hp <= 0) continue;
    if (naval !== (e.type === 'dock')) continue;
    if (!BUILDINGS[e.type].drop.includes(res as never)) continue;
    const d = distToRect(x, y, e);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

export function goalForTile(s: GameState, tile: number): Goal {
  const x = tile % s.w;
  const y = Math.floor(tile / s.w);
  return { x0: x - 1, y0: y - 1, x1: x + 1, y1: y + 1, px: x + 0.5, py: y + 0.5 };
}

export function goalForBuilding(b: Building, inside = false): Goal {
  if (inside) return { x0: b.tx, y0: b.ty, x1: b.tx + b.size - 1, y1: b.ty + b.size - 1, px: b.x, py: b.y };
  return { x0: b.tx - 1, y0: b.ty - 1, x1: b.tx + b.size, y1: b.ty + b.size, px: b.x, py: b.y };
}

export function goalForPoint(s: GameState, x: number, y: number, team = -1): Goal {
  let tx = Math.floor(x);
  let ty = Math.floor(y);
  let px = x;
  let py = y;
  if (!walkable(s, tx, ty, team)) {
    const t = nearestWalkable(s, x, y, 16, team);
    if (t >= 0) {
      tx = t % s.w;
      ty = Math.floor(t / s.w);
      px = tx + 0.5;
      py = ty + 0.5;
    }
  }
  return { x0: tx, y0: ty, x1: tx, y1: ty, px, py };
}

/** Owner's living Town Centers. */
export function townCenters(s: GameState, owner: number): Building[] {
  return s.ents.filter((e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'towncenter' && e.hp > 0);
}

/** Change a player's stats (an epoch, a technology), keeping every unit's and building's share of health. */
export function restat(s: GameState, p: Player, change: () => void): void {
  const before = new Map<number, number>();
  for (const e of s.ents) if (e.owner === p.id && e.hp > 0) before.set(e.id, maxHp(s, e));
  change();
  p.statsVersion++;
  for (const e of s.ents) {
    const was = before.get(e.id);
    if (!was) continue;
    e.hp = (e.hp * maxHp(s, e)) / was;
  }
}
