import { AI_LEVELS, BUILDINGS, CARRY, DEER, DT, EPOCH_GATHER_BONUS, GATHER, PRIEST, secs } from './data';
import { gap, nearestEnemyUnit, peace, strike, throwSpear } from './combat';
import { clearResource, distToRect, distToTile, lineClear, nearestWalkable, stampBuilding, walkable } from './grid';
import { findRoute } from './path';
import type { Spatial } from './spatial';
import { buildTimeFor, modsOf } from './stats';
import type { Act, Animal, Building, Ent, GameState, Goal, Order, Res, Unit } from './types';
import { R_BERRY, R_GOLD, R_MEAT, R_NONE, R_STONE, R_TREE } from './types';
import { exitSpot, goalForBuilding, goalForPoint, goalForTile, isEnemy, maxHp, nearestDrop, radiusOf, statsOf, teamOf } from './world';

/**
 * What units do each tick: follow their order (walk, gather and carry, farm, build, hunt, fight, heal,
 * convert, take shelter), then walk their route, then get nudged apart from each other and out of walls.
 */

/** Edge-to-edge distance that counts as touching, for work and drop-offs. */
const REACH = 0.4;
/** Give up on an order after this many walks that didn't get there. */
const MAX_MISS = 4;
/** Node budget for routes per tick; the rest wait for the next tick. */
const PATH_BUDGET = 60000;
/** Defensive units chase no farther than this from where they stood. */
const LEASH = 7;

export const RES_OF_TILE: Record<number, Res> = { [R_TREE]: 'wood', [R_BERRY]: 'food', [R_STONE]: 'stone', [R_GOLD]: 'gold', [R_MEAT]: 'food' };
const ACT_OF_TILE: Record<number, Act> = { [R_TREE]: 'chop', [R_BERRY]: 'forage', [R_STONE]: 'mine', [R_GOLD]: 'mine', [R_MEAT]: 'forage' };
const RATE_OF_TILE: Record<number, number> = { [R_TREE]: GATHER.tree, [R_BERRY]: GATHER.berry, [R_STONE]: GATHER.stone, [R_GOLD]: GATHER.gold, [R_MEAT]: GATHER.meat };

export function setOrder(u: Unit, order: Order): void {
  u.order = order;
  u.path = null;
  u.goal = null;
  u.wantPath = false;
  u.stuck = 0;
  u.miss = 0;
}

/** Give an order now, or (with `queue`) after the ones already lined up. */
export function giveOrder(u: Unit, order: Order, queue = false): void {
  if (queue && (u.order.k !== 'idle' || u.queue.length)) {
    u.queue.push(order);
    return;
  }
  u.queue = [];
  setOrder(u, order);
}

export function goTo(u: Unit, goal: Goal): void {
  u.goal = goal;
  u.wantPath = true;
  u.path = null;
  u.stuck = 0;
}

function stopWalking(u: Unit): void {
  u.path = null;
  u.goal = null;
  u.wantPath = false;
  u.miss = 0;
}

const walking = (u: Unit) => u.path !== null || u.wantPath;

/** Walk toward a goal if not already; false once it has failed to get there too many times. */
function approach(u: Unit, goal: Goal): boolean {
  if (walking(u)) return true;
  if (u.miss >= MAX_MISS) return false;
  u.miss++;
  goTo(u, goal);
  return true;
}

function face(u: Unit, x: number, y: number): void {
  const dx = x - u.x;
  const dy = y - u.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 1e-4) {
    u.fx = dx / d;
    u.fy = dy / d;
  }
}

function gatherRate(s: GameState, u: Unit, kind: number | 'farm'): number {
  const p = s.players[u.owner];
  const m = modsOf(s, u.owner);
  const ai = p.ai ? AI_LEVELS[p.ai].gather : 1;
  const base = kind === 'farm' ? GATHER.farm : RATE_OF_TILE[kind];
  const mod =
    kind === 'farm' ? m.farm : kind === R_TREE ? m.wood : kind === R_STONE || kind === R_GOLD ? m.mine : kind === R_MEAT ? m.hunt * m.forage : m.forage;
  return base * mod * (1 + p.epoch * EPOCH_GATHER_BONUS) * ai;
}

const carryCap = (s: GameState, u: Unit) => CARRY[s.players[u.owner].epoch] + modsOf(s, u.owner).carry;

/** The nearest tile of a resource near a point that a citizen could stand beside, or -1. */
export function findResource(s: GameState, kind: number, x: number, y: number, maxR: number): number {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let best = -1;
  let bestD = Infinity;
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = cx + dx;
        const ty = cy + dy;
        if (tx < 0 || ty < 0 || tx >= s.w || ty >= s.h) continue;
        const i = ty * s.w + tx;
        if (s.res[i] !== kind) continue;
        let open = false;
        for (let oy = -1; oy <= 1 && !open; oy++) for (let ox = -1; ox <= 1; ox++) if ((ox || oy) && walkable(s, tx + ox, ty + oy)) open = true;
        if (!open) continue;
        const ddx = tx + 0.5 - x;
        const ddy = ty + 0.5 - y;
        const d = ddx * ddx + ddy * ddy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
    // Once something is found, finish one more ring for a fair nearest, then stop.
    if (best >= 0 && r > 0 && bestD < (r - 0.5) * (r - 0.5)) break;
  }
  return best;
}

function deposit(s: GameState, u: Unit, at: Building): void {
  if (u.carry > 0 && u.carryRes) {
    const p = s.players[u.owner];
    p.res[u.carryRes] += u.carry;
    p.stats.gathered += u.carry;
    s.events.push({ k: 'deliver', owner: u.owner, res: u.carryRes, amount: u.carry, x: at.x, y: at.y });
  }
  u.carry = 0;
}

/** Head for the nearest drop site and empty the basket there. */
function dropOff(s: GameState, u: Unit): 'done' | 'going' | 'none' {
  if (!u.carryRes || u.carry <= 0) return 'done';
  // On the way: the route ends beside the drop site, so look again only now and then (in case it fell).
  if (walking(u) && (s.tick + u.id) % 20 !== 0) return 'going';
  const drop = nearestDrop(s, u.owner, u.carryRes, u.x, u.y);
  if (!drop) return 'none';
  const r = statsOf(s, u).radius;
  if (distToRect(u.x, u.y, drop) - r <= REACH) {
    stopWalking(u);
    deposit(s, u, drop);
    return 'done';
  }
  if (!approach(u, goalForBuilding(drop))) return 'none';
  return 'going';
}

function workEvent(s: GameState, u: Unit, act: Act, x: number, y: number): void {
  if ((s.tick + u.id) % 24 === 0) s.events.push({ k: 'work', id: u.id, owner: u.owner, act, x, y });
}

function gatherStep(s: GameState, u: Unit, o: Extract<Order, { k: 'gather' }>): void {
  if (u.carryRes !== o.res) {
    u.carry = 0;
    u.frac = 0;
    u.carryRes = o.res;
  }
  const cap = carryCap(s, u);
  if (o.phase === 'drop') {
    const r = dropOff(s, u);
    if (r === 'done') {
      o.phase = 'go';
      u.miss = 0;
    } else if (r === 'none') setOrder(u, { k: 'idle' });
    return;
  }
  const kind = s.res[o.tile];
  if (kind === R_NONE || RES_OF_TILE[kind] !== o.res) {
    // Run out: the next one nearby of the same kind (game first, then berries, for food).
    const wants = o.res === 'wood' ? [R_TREE] : o.res === 'food' ? [R_MEAT, R_BERRY] : o.res === 'stone' ? [R_STONE] : [R_GOLD];
    let next = -1;
    for (const want of wants) {
      next = findResource(s, want, (o.tile % s.w) + 0.5, Math.floor(o.tile / s.w) + 0.5, want === R_MEAT ? 5 : 8);
      if (next >= 0) break;
    }
    if (next >= 0) {
      o.tile = next;
      o.phase = 'go';
      stopWalking(u);
    } else if (u.carry > 0) o.phase = 'drop';
    else setOrder(u, { k: 'idle' });
    return;
  }
  const r = statsOf(s, u).radius;
  const tx = (o.tile % s.w) + 0.5;
  const ty = Math.floor(o.tile / s.w) + 0.5;
  if (distToTile(u.x, u.y, o.tile, s.w) - r <= REACH) {
    if (walking(u)) stopWalking(u);
    o.phase = 'work';
    u.miss = 0;
    face(u, tx, ty);
    u.act = ACT_OF_TILE[kind];
    u.frac += gatherRate(s, u, kind) * DT;
    while (u.frac >= 1 && u.carry < cap && s.amount[o.tile] > 0) {
      u.frac -= 1;
      u.carry++;
      s.amount[o.tile]--;
    }
    workEvent(s, u, u.act, tx, ty);
    if (s.amount[o.tile] <= 0) {
      clearResource(s, o.tile);
      s.events.push({ k: 'depleted', tile: o.tile });
    }
    if (u.carry >= cap) {
      u.frac = 0;
      o.phase = 'drop';
    }
    return;
  }
  o.phase = 'go';
  if (!approach(u, goalForTile(s, o.tile))) {
    // Can't get to that one: try another nearby before giving up.
    const want = s.res[o.tile];
    s.res[o.tile] = R_NONE;
    const next = findResource(s, want, tx, ty, 8);
    s.res[o.tile] = want;
    if (next >= 0 && next !== o.tile) {
      o.tile = next;
      u.miss = 0;
    } else setOrder(u, { k: 'idle' });
  }
}

function farmStep(s: GameState, u: Unit, o: Extract<Order, { k: 'farm' }>): void {
  const f = s.byId.get(o.target);
  if (!f || f.kind !== 'building' || f.hp <= 0 || f.type !== 'farm') {
    if (u.carry > 0) setOrder(u, { k: 'deliver' });
    else setOrder(u, { k: 'idle' });
    return;
  }
  if (!f.built) {
    setOrder(u, { k: 'build', target: f.id });
    return;
  }
  const holder = f.farmer ? s.byId.get(f.farmer) : undefined;
  if (holder && holder !== u && holder.hp > 0 && holder.kind === 'unit' && holder.order.k === 'farm' && holder.order.target === f.id) {
    // Someone already works it: find a free farm nearby, or stand by.
    const other = freeFarm(s, u.owner, f.x, f.y, 12);
    if (other) setOrder(u, { k: 'farm', target: other.id, phase: 'go' });
    else setOrder(u, { k: 'idle' });
    return;
  }
  f.farmer = u.id;
  if (u.carryRes !== 'food') {
    u.carry = 0;
    u.frac = 0;
    u.carryRes = 'food';
  }
  if (o.phase === 'drop') {
    const r = dropOff(s, u);
    if (r === 'done') {
      o.phase = 'go';
      u.miss = 0;
    } else if (r === 'none') setOrder(u, { k: 'idle' });
    return;
  }
  const inside = distToRect(u.x, u.y, f) <= 0.05;
  if (inside && !walking(u)) {
    o.phase = 'work';
    u.miss = 0;
    u.act = 'farm';
    u.frac += gatherRate(s, u, 'farm') * DT;
    while (u.frac >= 1) {
      u.frac -= 1;
      u.carry++;
    }
    workEvent(s, u, 'farm', u.x, u.y);
    if (u.carry >= carryCap(s, u)) {
      u.frac = 0;
      o.phase = 'drop';
    }
    return;
  }
  // Each farmer works a spot of the field, picked from its id so neighbors spread out.
  const spot = (u.id % 5) * 0.11;
  if (!approach(u, { ...goalForBuilding(f, true), px: f.tx + 0.9 + spot * 3, py: f.ty + 0.9 + spot * 2 })) setOrder(u, { k: 'idle' });
}

export function freeFarm(s: GameState, owner: number, x: number, y: number, r: number): Building | null {
  let best: Building | null = null;
  let bestD = r;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'farm' || e.owner !== owner || e.hp <= 0) continue;
    if (farmTaken(s, e)) continue;
    const d = distToRect(x, y, e);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function farmTaken(s: GameState, f: Building): boolean {
  const holder = f.farmer ? s.byId.get(f.farmer) : undefined;
  return !!holder && holder.hp > 0 && holder.kind === 'unit' && holder.order.k === 'farm' && holder.order.target === f.id;
}

export function completeBuilding(s: GameState, b: Building): void {
  b.built = true;
  b.progress = 1;
  b.hp = Math.min(b.hp, maxHp(s, b));
  s.players[b.owner].stats.built++;
  // A finished gate opens for its own side.
  if (b.type === 'gate') stampBuilding(s, b, true);
  if (b.type === 'wonder') {
    b.timer = s.wonderTime;
    s.events.push({ k: 'wonder', owner: b.owner, id: b.id, x: b.x, y: b.y, ticks: b.timer });
  }
  s.events.push({ k: 'built', id: b.id, owner: b.owner, type: b.type });
}

/** What a builder does once the building is up. */
function afterBuilding(s: GameState, u: Unit, b: Building): void {
  if (b.type === 'farm' && !farmTaken(s, b) && !u.queue.length) {
    setOrder(u, { k: 'farm', target: b.id, phase: 'go' });
    return;
  }
  // Orders lined up with Shift come first.
  if (u.queue.length) {
    setOrder(u, { k: 'idle' });
    return;
  }
  // Help with other foundations nearby (a wall goes up piece by piece).
  let next: Building | null = null;
  let bestD = b.type === 'wall' || b.type === 'gate' ? 4 : 14;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.owner !== u.owner || e.built || e.hp <= 0) continue;
    const d = distToRect(u.x, u.y, e);
    if (d < bestD) {
      bestD = d;
      next = e;
    }
  }
  if (next) {
    const back = u.resume;
    setOrder(u, { k: 'build', target: next.id });
    u.resume = back;
    return;
  }
  // Back to the work they were pulled off, if any.
  if (u.resume) {
    const back = u.resume;
    u.resume = null;
    if (back.k === 'gather' || back.k === 'farm') {
      setOrder(u, back);
      return;
    }
  }
  if (b.type === 'storehouse') {
    // Work whatever lies closest to the new storehouse.
    let best = -1;
    let bestDist = Infinity;
    for (const kind of [R_TREE, R_GOLD, R_STONE, R_BERRY]) {
      const t = findResource(s, kind, b.x, b.y, 8);
      if (t < 0) continue;
      const d = distToTile(b.x, b.y, t, s.w);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    if (best >= 0) {
      setOrder(u, { k: 'gather', tile: best, res: RES_OF_TILE[s.res[best]], phase: 'go' });
      return;
    }
  }
  setOrder(u, { k: 'idle' });
}

function buildStep(s: GameState, u: Unit, o: Extract<Order, { k: 'build' }>): void {
  const b = s.byId.get(o.target);
  if (!b || b.kind !== 'building' || b.hp <= 0 || b.owner !== u.owner) {
    setOrder(u, { k: 'idle' });
    return;
  }
  if (b.built) {
    afterBuilding(s, u, b);
    return;
  }
  const r = statsOf(s, u).radius;
  if (distToRect(u.x, u.y, b) - r <= REACH) {
    if (walking(u)) stopWalking(u);
    face(u, b.x, b.y);
    u.act = 'build';
    const step = DT / buildTimeFor(s, u.owner, b.type);
    b.progress = Math.min(1, b.progress + step);
    b.hp = Math.min(maxHp(s, b), b.hp + maxHp(s, b) * step);
    workEvent(s, u, 'build', u.x, u.y);
    if (b.progress >= 1) completeBuilding(s, b);
    return;
  }
  if (!approach(u, goalForBuilding(b, BUILDINGS[b.type].open))) setOrder(u, { k: 'idle' });
}

/** An enemy to pick a fight with near a unit: units first, buildings when on the attack (rams: buildings only). */
function findTarget(s: GameState, sp: Spatial, u: Unit, r: number, buildings: boolean): Ent | null {
  if (peace(s)) return null;
  const st = statsOf(s, u);
  if (!st.buildingsOnly) {
    const t = nearestEnemyUnit(s, sp, u.owner, u.x, u.y, r);
    if (t || !buildings) return t;
  }
  if (!buildings && !st.buildingsOnly) return null;
  let best: Building | null = null;
  let bestD = r;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.hp <= 0 || !isEnemy(s, u.owner, e.owner)) continue;
    // Walls only matter when they are in the way.
    const wall = e.type === 'wall' || e.type === 'gate';
    const d = distToRect(u.x, u.y, e) + (wall ? 3 : 0);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function attackStep(s: GameState, sp: Spatial, u: Unit, o: Extract<Order, { k: 'attack' }>): void {
  const t = s.byId.get(o.target);
  const st = statsOf(s, u);
  const done = () => {
    if (o.then) setOrder(u, { k: 'move', x: o.then.x, y: o.then.y, amove: true, started: false });
    else if (u.stance === 'defensive') setOrder(u, { k: 'move', x: u.guardX, y: u.guardY, amove: false, started: false });
    else setOrder(u, { k: 'idle' });
  };
  if (!t || t.hp <= 0 || (t.kind === 'unit' && t.inside) || !isEnemy(s, u.owner, t.owner) || peace(s)) {
    // The target fell (or changed sides): pick the next one close by if this was a fight already joined.
    const next = u.type !== 'citizen' && !peace(s) ? findTarget(s, sp, u, st.sight, !!o.then) : null;
    if (next) {
      o.target = next.id;
      o.auto = true;
      u.miss = 0;
    } else done();
    return;
  }
  if (st.buildingsOnly && t.kind === 'unit' && t.type !== 'siege') {
    done();
    return;
  }
  const d = gap(s, u, t);
  if (o.auto && d > st.sight * 1.8) {
    done();
    return;
  }
  // Defensive units don't stray far; units standing their ground don't move at all.
  if (o.auto && u.stance === 'defensive') {
    const gx = u.x - u.guardX;
    const gy = u.y - u.guardY;
    if (gx * gx + gy * gy > LEASH * LEASH) {
      done();
      return;
    }
  }
  if (d <= st.range + 0.15) {
    if (st.minRange && d < st.minRange) {
      // Too close to shoot: back off if allowed, else wait.
      if (u.stance === 'stand' || o.auto) {
        done();
        return;
      }
      const dx = u.x - t.x;
      const dy = u.y - t.y;
      const l = Math.sqrt(dx * dx + dy * dy) || 1;
      if (!walking(u)) goTo(u, goalForPoint(s, u.x + (dx / l) * 3, u.y + (dy / l) * 3, teamOf(s, u.owner)));
      return;
    }
    if (walking(u)) stopWalking(u);
    face(u, t.x, t.y);
    u.act = 'attack';
    if (u.cool <= 0) {
      strike(s, u, t);
      u.cool = secs(st.reload);
    }
    return;
  }
  if (u.stance === 'stand' && o.auto) {
    done();
    return;
  }
  // Chase: straight at it when close and clear, otherwise by route, refreshed as it moves.
  const team = teamOf(s, u.owner);
  const tr = radiusOf(s, t);
  if (t.kind === 'unit' && d < 2.5 && lineClear(s, u.x, u.y, t.x, t.y, team)) {
    u.path = [t.x - u.fx * tr * 0.5, t.y - u.fy * tr * 0.5];
    u.pathI = 0;
    u.wantPath = false;
    u.goal = goalForPoint(s, t.x, t.y, team);
    return;
  }
  const g = t.kind === 'building' ? goalForBuilding(t) : chaseGoal(t, st.range);
  const moved = u.goal ? Math.abs(u.goal.px - g.px) + Math.abs(u.goal.py - g.py) : 99;
  if (walking(u) && moved > 1.5 && s.tick - u.pathTick > 10) {
    goTo(u, g);
    return;
  }
  if (!approach(u, g)) done();
}

function chaseGoal(t: Unit, range: number): Goal {
  const tx = Math.floor(t.x);
  const ty = Math.floor(t.y);
  const r = Math.max(1, Math.floor(range * 0.7));
  return { x0: tx - r, y0: ty - r, x1: tx + r, y1: ty + r, px: t.x, py: t.y };
}

function deliverStep(s: GameState, u: Unit): void {
  const r = dropOff(s, u);
  if (r !== 'going') setOrder(u, { k: 'idle' });
}

// ---- Shelter ---------------------------------------------------------------------------------------

export function garrisonRoom(b: Building): number {
  return (BUILDINGS[b.type].garrison ?? 0) - b.garrison.length;
}

function garrisonStep(s: GameState, u: Unit, o: Extract<Order, { k: 'garrison' }>): void {
  const b = s.byId.get(o.target);
  if (!b || b.kind !== 'building' || b.hp <= 0 || !b.built || b.owner !== u.owner || garrisonRoom(b) <= 0 || u.type === 'siege') {
    setOrder(u, { k: 'idle' });
    return;
  }
  if (distToRect(u.x, u.y, b) - statsOf(s, u).radius <= REACH + 0.2) {
    stopWalking(u);
    u.inside = b.id;
    u.x = b.x;
    u.y = b.y;
    u.px = u.x;
    u.py = u.y;
    b.garrison.push(u.id);
    setOrder(u, { k: 'idle' });
    s.events.push({ k: 'garrison', owner: u.owner, building: b.id, inside: true });
    return;
  }
  if (!approach(u, goalForBuilding(b))) setOrder(u, { k: 'idle' });
}

/** Everyone out of a building, beside it, and back to whatever the bell pulled them off. */
export function ungarrison(s: GameState, b: Building): void {
  if (!b.garrison.length) return;
  for (const id of b.garrison) {
    const u = s.byId.get(id);
    if (!u || u.kind !== 'unit') continue;
    const spot = exitSpot(s, b, b.x + (u.id % 3) - 1, b.y + b.size);
    u.inside = 0;
    u.x = spot.x + ((u.id % 5) - 2) * 0.12;
    u.y = spot.y + ((u.id % 3) - 1) * 0.12;
    u.px = u.x;
    u.py = u.y;
    if (u.resume) {
      const back = u.resume;
      u.resume = null;
      setOrder(u, back);
    } else setOrder(u, { k: 'idle' });
  }
  b.garrison = [];
  s.events.push({ k: 'garrison', owner: b.owner, building: b.id, inside: false });
}

// ---- The hunt --------------------------------------------------------------------------------------

function huntStep(s: GameState, u: Unit, o: Extract<Order, { k: 'hunt' }>): void {
  const a = s.animals.find((x) => x.id === o.target);
  if (!a || a.hp <= 0) {
    // It fell: butcher it (or the nearest carcass).
    const meat = findResource(s, R_MEAT, u.x, u.y, 6);
    if (meat >= 0) setOrder(u, { k: 'gather', tile: meat, res: 'food', phase: 'go' });
    else setOrder(u, { k: 'idle' });
    return;
  }
  const dx = a.x - u.x;
  const dy = a.y - u.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= DEER.spear) {
    if (walking(u)) stopWalking(u);
    face(u, a.x, a.y);
    u.act = 'attack';
    if (u.cool <= 0) {
      throwSpear(s, u, a);
      u.cool = secs(1.5);
    }
    return;
  }
  const team = teamOf(s, u.owner);
  const g = goalForPoint(s, a.x, a.y, team);
  const moved = u.goal ? Math.abs(u.goal.px - g.px) + Math.abs(u.goal.py - g.py) : 99;
  if (walking(u) && moved > 1.5 && s.tick - u.pathTick > 15) {
    goTo(u, g);
    return;
  }
  if (!approach(u, g)) setOrder(u, { k: 'idle' });
}

// ---- Priests ---------------------------------------------------------------------------------------

/** How long a conversion takes for this target, in ticks (heavier units resist longer). */
function convertTicks(s: GameState, priest: Unit, t: Unit): number {
  const hard = t.type === 'hero' ? 3 : t.type === 'cavalry' || t.type === 'siege' ? 1.5 : t.type === 'priest' ? 2 : 1;
  return secs((PRIEST.convert * hard) / modsOf(s, priest.owner).priest);
}

function convertStep(s: GameState, u: Unit, o: Extract<Order, { k: 'convert' }>): void {
  const t = s.byId.get(o.target);
  const st = statsOf(s, u);
  if (!t || t.kind !== 'unit' || t.hp <= 0 || t.inside || !isEnemy(s, u.owner, t.owner) || peace(s)) {
    setOrder(u, { k: 'idle' });
    return;
  }
  if (u.cool > 0) {
    // Resting after the last conversion.
    if (walking(u)) stopWalking(u);
    return;
  }
  const d = gap(s, u, t);
  if (d <= st.range) {
    if (walking(u)) stopWalking(u);
    face(u, t.x, t.y);
    u.act = 'chant';
    if (o.done % 24 === 0) s.events.push({ k: 'work', id: u.id, owner: u.owner, act: 'chant', x: t.x, y: t.y });
    o.done++;
    if (o.done >= convertTicks(s, u, t)) {
      // It joins us: its orders are forgotten.
      const from = t.owner;
      t.owner = u.owner;
      t.queue = [];
      t.inside = 0;
      setOrder(t, { k: 'idle' });
      t.resume = null;
      s.players[u.owner].stats.converted++;
      s.events.push({ k: 'converted', id: t.id, from, to: u.owner, x: t.x, y: t.y });
      u.cool = secs(PRIEST.rest);
      setOrder(u, { k: 'idle' });
    }
    return;
  }
  const g = chaseGoal(t, st.range);
  const moved = u.goal ? Math.abs(u.goal.px - g.px) + Math.abs(u.goal.py - g.py) : 99;
  if (walking(u) && moved > 1.5 && s.tick - u.pathTick > 10) {
    goTo(u, g);
    return;
  }
  if (!approach(u, g)) setOrder(u, { k: 'idle' });
}

function healStep(s: GameState, u: Unit, o: Extract<Order, { k: 'heal' }>): void {
  const t = s.byId.get(o.target);
  if (!t || t.kind !== 'unit' || t.hp <= 0 || t.inside || t.owner !== u.owner || t.hp >= maxHp(s, t) || t.type === 'siege') {
    setOrder(u, { k: 'idle' });
    return;
  }
  const st = statsOf(s, u);
  const d = gap(s, u, t);
  if (d <= st.range * 0.6) {
    if (walking(u)) stopWalking(u);
    face(u, t.x, t.y);
    u.act = 'chant';
    t.hp = Math.min(maxHp(s, t), t.hp + PRIEST.heal * modsOf(s, u.owner).priest * DT);
    if ((s.tick + u.id) % 30 === 0) s.events.push({ k: 'healed', id: t.id, x: t.x, y: t.y });
    return;
  }
  if (!approach(u, chaseGoal(t, st.range * 0.5))) setOrder(u, { k: 'idle' });
}

/** A wounded friend for an idle priest to tend, nearest first. */
function woundedNear(s: GameState, sp: Spatial, u: Unit, r: number): Unit | null {
  let best: Unit | null = null;
  let bestD = r * r;
  sp.near(u.x, u.y, r, (o) => {
    if (o === u || o.owner !== u.owner || o.hp <= 0 || o.type === 'siege' || o.hp >= maxHp(s, o)) return;
    const dx = o.x - u.x;
    const dy = o.y - u.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  });
  return best;
}

// ---- The decision each tick ------------------------------------------------------------------------

/** One unit's decision for this tick. */
export function think(s: GameState, sp: Spatial, u: Unit): void {
  u.act = 'idle';
  if (u.cool > 0) u.cool--;
  if (u.inside) return;
  // Next in line, once the current order is done.
  if (u.order.k === 'idle' && u.queue.length) setOrder(u, u.queue.shift()!);
  const o = u.order;
  const military = u.type !== 'citizen' && u.type !== 'priest';
  switch (o.k) {
    case 'idle':
      u.guardX = u.x;
      u.guardY = u.y;
      if (military && (s.tick + u.id) % 8 === 0) {
        const st = statsOf(s, u);
        const reach = u.stance === 'stand' ? st.range + st.radius + 0.6 : st.sight;
        const t = findTarget(s, sp, u, reach, !!st.buildingsOnly);
        if (t) setOrder(u, { k: 'attack', target: t.id, auto: true, then: null });
      } else if (u.type === 'priest' && (s.tick + u.id) % 10 === 0 && u.cool <= 0) {
        const w = woundedNear(s, sp, u, statsOf(s, u).sight);
        if (w) setOrder(u, { k: 'heal', target: w.id });
      }
      break;
    case 'move':
      if (!o.started) {
        o.started = true;
        goTo(u, goalForPoint(s, o.x, o.y, teamOf(s, u.owner)));
      }
      if (o.amove && military && (s.tick + u.id) % 6 === 0) {
        const t = findTarget(s, sp, u, statsOf(s, u).sight, true);
        if (t) {
          setOrder(u, { k: 'attack', target: t.id, auto: true, then: { x: o.x, y: o.y } });
          break;
        }
      }
      if (!walking(u)) setOrder(u, { k: 'idle' });
      break;
    case 'attack':
      attackStep(s, sp, u, o);
      break;
    case 'gather':
      gatherStep(s, u, o);
      break;
    case 'farm':
      farmStep(s, u, o);
      break;
    case 'build':
      buildStep(s, u, o);
      break;
    case 'deliver':
      deliverStep(s, u);
      break;
    case 'garrison':
      garrisonStep(s, u, o);
      break;
    case 'hunt':
      huntStep(s, u, o);
      break;
    case 'convert':
      convertStep(s, u, o);
      break;
    case 'heal':
      healStep(s, u, o);
      break;
  }
}

/** Work out waiting routes, a budget's worth per tick, in id order. */
export function routeUnits(s: GameState): void {
  let budget = PATH_BUDGET;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || !e.wantPath || e.hp <= 0 || !e.goal || e.inside) continue;
    if (budget <= 0) break;
    const g = e.goal;
    const team = teamOf(s, e.owner);
    e.pathTick = s.tick;
    e.wantPath = false;
    e.pathI = 0;
    const inGoal = (x: number, y: number) => x >= g.x0 && x <= g.x1 && y >= g.y0 && y <= g.y1;
    if (inGoal(Math.floor(g.px), Math.floor(g.py)) && walkable(s, Math.floor(g.px), Math.floor(g.py), team) && lineClear(s, e.x, e.y, g.px, g.py, team)) {
      e.path = [g.px, g.py];
      budget -= 4;
      continue;
    }
    const r = findRoute(s, e.x, e.y, g, Math.min(12000, Math.max(800, budget)), team);
    budget -= r.cost;
    e.path = r.points.length ? r.points : null;
  }
}

/** Walk the route. */
export function walk(s: GameState, u: Unit): void {
  if (!u.path) return;
  let left = statsOf(s, u).speed * DT;
  while (left > 1e-9 && u.path) {
    const tx = u.path[u.pathI * 2];
    const ty = u.path[u.pathI * 2 + 1];
    const dx = tx - u.x;
    const dy = ty - u.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 1e-4) {
      u.fx = dx / d;
      u.fy = dy / d;
    }
    if (d <= left) {
      u.x = tx;
      u.y = ty;
      left -= d;
      u.pathI++;
      if (u.pathI * 2 >= u.path.length) u.path = null;
    } else {
      u.x += (dx / d) * left;
      u.y += (dy / d) * left;
      left = 0;
    }
  }
  if (u.act === 'idle') u.act = 'walk';
}

/** Push overlapping units apart (workers and fighters hold their ground; walkers flow around). */
export function separate(s: GameState, sp: Spatial): void {
  for (const u of s.ents) {
    if (u.kind !== 'unit' || u.hp <= 0 || u.inside) continue;
    const ru = statsOf(s, u).radius;
    sp.near(u.x, u.y, 1, (o) => {
      if (o.id <= u.id || o.hp <= 0) return;
      const ro = statsOf(s, o).radius;
      const r = ru + ro;
      let dx = o.x - u.x;
      let dy = o.y - u.y;
      let d2 = dx * dx + dy * dy;
      if (d2 >= r * r) return;
      if (d2 < 1e-8) {
        // Exactly on top of each other: split along a direction picked from their ids.
        const k = (u.id * 7 + o.id * 13) % 8;
        dx = [1, 0.7, 0, -0.7, -1, -0.7, 0, 0.7][k];
        dy = [0, 0.7, 1, 0.7, 0, -0.7, -1, -0.7][k];
        d2 = dx * dx + dy * dy;
      }
      const d = Math.sqrt(d2);
      const push = (r - d) * 0.5;
      const firm = (x: Unit) => (x.act === 'idle' || x.act === 'walk' ? 1 : 0.25);
      const wu = firm(u);
      const wo = firm(o);
      const tot = wu + wo;
      u.x -= (dx / d) * push * (wu / tot);
      u.y -= (dy / d) * push * (wu / tot);
      o.x += (dx / d) * push * (wo / tot);
      o.y += (dy / d) * push * (wo / tot);
    });
  }
}

/** Keep units out of water, rock, resources and buildings (but through their own gates), sliding along edges. */
export function collide(s: GameState, u: Unit): void {
  if (u.inside) return;
  const r = statsOf(s, u).radius;
  const team = teamOf(s, u.owner);
  u.x = Math.max(r, Math.min(s.w - r, u.x));
  u.y = Math.max(r, Math.min(s.h - r, u.y));
  const cx = Math.floor(u.x);
  const cy = Math.floor(u.y);
  if (!walkable(s, cx, cy, team)) {
    // Inside something (a new foundation, a pushed crowd): out to the nearest open tile.
    const t = nearestWalkable(s, u.x, u.y, 8, team);
    if (t >= 0) {
      const tx = t % s.w;
      const ty = Math.floor(t / s.w);
      u.x = Math.max(tx + r, Math.min(tx + 1 - r, u.x));
      u.y = Math.max(ty + r, Math.min(ty + 1 - r, u.y));
    }
    return;
  }
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const tx = cx + dx;
      const ty = cy + dy;
      if (walkable(s, tx, ty, team)) continue;
      // Closest point of that tile to the unit.
      const qx = Math.max(tx, Math.min(tx + 1, u.x));
      const qy = Math.max(ty, Math.min(ty + 1, u.y));
      const ox = u.x - qx;
      const oy = u.y - qy;
      const d2 = ox * ox + oy * oy;
      if (d2 >= r * r || d2 < 1e-10) continue;
      const d = Math.sqrt(d2);
      u.x = qx + (ox / d) * r;
      u.y = qy + (oy / d) * r;
    }
  }
}

/** Notice units that keep walking into a wall, and route them again. */
export function checkStuck(s: GameState, u: Unit): void {
  if (!u.path) {
    u.stuck = 0;
    return;
  }
  const dx = u.x - u.px;
  const dy = u.y - u.py;
  const moved = Math.sqrt(dx * dx + dy * dy);
  if (moved < statsOf(s, u).speed * DT * 0.25) u.stuck++;
  else if (u.stuck > 0) u.stuck--;
  if (u.stuck > 24) {
    u.stuck = 0;
    u.miss++;
    if (u.miss >= MAX_MISS + 2) {
      // Hemmed in near where it was going: call it arrived.
      u.path = null;
      u.wantPath = false;
      return;
    }
    if (u.goal) u.wantPath = true;
    u.path = null;
  }
}

export type { Animal };
