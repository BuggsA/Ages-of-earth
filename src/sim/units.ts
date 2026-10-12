import { AI_LEVELS, BUILDINGS, CARRY, DT, EPOCH_GATHER_BONUS, GATHER, buildingHp, secs } from './data';
import { gap, nearestEnemyUnit, strike } from './combat';
import { clearResource, distToRect, distToTile, lineClear, nearestWalkable, walkable } from './grid';
import { findRoute } from './path';
import type { Spatial } from './spatial';
import type { Act, Building, Ent, GameState, Goal, Order, Res, Unit } from './types';
import { R_BERRY, R_GOLD, R_NONE, R_STONE, R_TREE } from './types';
import { goalForBuilding, goalForPoint, goalForTile, isEnemy, maxHp, nearestDrop, radiusOf, statsOf } from './world';

/**
 * What units do each tick: follow their order (walk, gather and carry, farm, build, fight), then walk
 * their route, then get nudged apart from each other and out of walls.
 */

/** Edge-to-edge distance that counts as touching, for work and drop-offs. */
const REACH = 0.4;
/** Give up on an order after this many walks that didn't get there. */
const MAX_MISS = 4;
/** Node budget for routes per tick; the rest wait for the next tick. */
const PATH_BUDGET = 60000;

export const RES_OF_TILE: Record<number, Res> = { [R_TREE]: 'wood', [R_BERRY]: 'food', [R_STONE]: 'stone', [R_GOLD]: 'gold' };
const ACT_OF_TILE: Record<number, Act> = { [R_TREE]: 'chop', [R_BERRY]: 'forage', [R_STONE]: 'mine', [R_GOLD]: 'mine' };
const RATE_OF_TILE: Record<number, number> = { [R_TREE]: GATHER.tree, [R_BERRY]: GATHER.berry, [R_STONE]: GATHER.stone, [R_GOLD]: GATHER.gold };

export function setOrder(u: Unit, order: Order): void {
  u.order = order;
  u.path = null;
  u.goal = null;
  u.wantPath = false;
  u.stuck = 0;
  u.miss = 0;
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

function gatherRate(s: GameState, u: Unit, base: number): number {
  const p = s.players[u.owner];
  const ai = p.ai ? AI_LEVELS[p.ai].gather : 1;
  return base * (1 + p.epoch * EPOCH_GATHER_BONUS) * ai;
}

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

/** Head for the nearest drop site and empty the basket there. Returns true once delivered. */
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
  const cap = CARRY[s.players[u.owner].epoch];
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
    // Run out: the next one nearby of the same kind.
    const want = o.res === 'wood' ? R_TREE : o.res === 'food' ? R_BERRY : o.res === 'stone' ? R_STONE : R_GOLD;
    const next = findResource(s, want, (o.tile % s.w) + 0.5, Math.floor(o.tile / s.w) + 0.5, 8);
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
    u.frac += gatherRate(s, u, RATE_OF_TILE[kind]) * DT;
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
    u.frac += gatherRate(s, u, GATHER.farm) * DT;
    while (u.frac >= 1) {
      u.frac -= 1;
      u.carry++;
    }
    workEvent(s, u, 'farm', u.x, u.y);
    if (u.carry >= CARRY[s.players[u.owner].epoch]) {
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
    const holder = e.farmer ? s.byId.get(e.farmer) : undefined;
    const taken = holder && holder.hp > 0 && holder.kind === 'unit' && holder.order.k === 'farm' && holder.order.target === e.id;
    if (taken) continue;
    const d = distToRect(x, y, e);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

export function completeBuilding(s: GameState, b: Building): void {
  b.built = true;
  b.progress = 1;
  b.hp = Math.min(b.hp, buildingHp(b.type, s.players[b.owner].epoch));
  s.players[b.owner].stats.built++;
  s.events.push({ k: 'built', id: b.id, owner: b.owner, type: b.type });
}

/** What a builder does once the building is up. */
function afterBuilding(s: GameState, u: Unit, b: Building): void {
  if (b.type === 'farm' && !freeFarmTaken(s, b)) {
    setOrder(u, { k: 'farm', target: b.id, phase: 'go' });
    return;
  }
  // Help with other foundations nearby.
  let next: Building | null = null;
  let bestD = 14;
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

function freeFarmTaken(s: GameState, f: Building): boolean {
  const holder = f.farmer ? s.byId.get(f.farmer) : undefined;
  return !!holder && holder.hp > 0 && holder.kind === 'unit' && holder.order.k === 'farm' && holder.order.target === f.id;
}

function buildStep(s: GameState, u: Unit, o: Extract<Order, { k: 'build' }>): void {
  const b = s.byId.get(o.target);
  if (!b || b.kind !== 'building' || b.hp <= 0) {
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
    const step = DT / BUILDINGS[b.type].time;
    b.progress = Math.min(1, b.progress + step);
    b.hp = Math.min(maxHp(s, b), b.hp + maxHp(s, b) * step);
    workEvent(s, u, 'build', u.x, u.y);
    if (b.progress >= 1) completeBuilding(s, b);
    return;
  }
  if (!approach(u, goalForBuilding(b, BUILDINGS[b.type].open))) setOrder(u, { k: 'idle' });
}

/** An enemy to pick a fight with near a unit: units first, buildings when on the attack. */
function findTarget(s: GameState, sp: Spatial, u: Unit, r: number, buildings: boolean): Ent | null {
  const t = nearestEnemyUnit(s, sp, u.owner, u.x, u.y, r);
  if (t || !buildings) return t;
  let best: Building | null = null;
  let bestD = r;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.hp <= 0 || !isEnemy(s, u.owner, e.owner)) continue;
    const d = distToRect(u.x, u.y, e);
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
    if (o.then) {
      setOrder(u, { k: 'move', x: o.then.x, y: o.then.y, amove: true });
      goTo(u, goalForPoint(s, o.then.x, o.then.y));
    } else setOrder(u, { k: 'idle' });
  };
  if (!t || t.hp <= 0 || (t.kind === 'building' && !isEnemy(s, u.owner, t.owner) && t.owner !== u.owner)) {
    // The target fell: pick the next one close by if this was a fight already joined.
    const next = u.type !== 'citizen' ? findTarget(s, sp, u, st.sight, !!o.then) : null;
    if (next) {
      o.target = next.id;
      o.auto = true;
      u.miss = 0;
    } else done();
    return;
  }
  const d = gap(s, u, t);
  if (o.auto && d > st.sight * 1.8) {
    done();
    return;
  }
  if (d <= st.range + 0.15) {
    if (walking(u)) stopWalking(u);
    face(u, t.x, t.y);
    u.act = 'attack';
    if (u.cool <= 0) {
      strike(s, u, t);
      u.cool = secs(st.reload);
    }
    return;
  }
  // Chase: straight at it when close and clear, otherwise by route, refreshed as it moves.
  const tr = radiusOf(s, t);
  if (t.kind === 'unit' && d < 2.5 && lineClear(s, u.x, u.y, t.x, t.y)) {
    u.path = [t.x - u.fx * tr * 0.5, t.y - u.fy * tr * 0.5];
    u.pathI = 0;
    u.wantPath = false;
    u.goal = goalForPoint(s, t.x, t.y);
    return;
  }
  const g = t.kind === 'building' ? goalForBuilding(t) : chaseGoal(s, u, t, st.range);
  const moved = u.goal ? Math.abs(u.goal.px - g.px) + Math.abs(u.goal.py - g.py) : 99;
  if (walking(u) && moved > 1.5 && s.tick - u.pathTick > 10) {
    goTo(u, g);
    return;
  }
  if (!approach(u, g)) done();
}

function chaseGoal(s: GameState, u: Unit, t: Unit, range: number): Goal {
  const tx = Math.floor(t.x);
  const ty = Math.floor(t.y);
  const r = Math.max(1, Math.floor(range * 0.7));
  void s;
  void u;
  return { x0: tx - r, y0: ty - r, x1: tx + r, y1: ty + r, px: t.x, py: t.y };
}

function deliverStep(s: GameState, u: Unit): void {
  const r = dropOff(s, u);
  if (r !== 'going') setOrder(u, { k: 'idle' });
}

/** One unit's decision for this tick. */
export function think(s: GameState, sp: Spatial, u: Unit): void {
  u.act = 'idle';
  if (u.cool > 0) u.cool--;
  const o = u.order;
  const military = u.type !== 'citizen';
  switch (o.k) {
    case 'idle':
      if (military && (s.tick + u.id) % 8 === 0) {
        const t = findTarget(s, sp, u, statsOf(s, u).sight, false);
        if (t) setOrder(u, { k: 'attack', target: t.id, auto: true, then: null });
      }
      break;
    case 'move':
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
  }
}

/** Work out waiting routes, a budget's worth per tick, in id order. */
export function routeUnits(s: GameState): void {
  let budget = PATH_BUDGET;
  for (const e of s.ents) {
    if (e.kind !== 'unit' || !e.wantPath || e.hp <= 0 || !e.goal) continue;
    if (budget <= 0) break;
    const g = e.goal;
    e.pathTick = s.tick;
    e.wantPath = false;
    e.pathI = 0;
    const inGoal = (x: number, y: number) => x >= g.x0 && x <= g.x1 && y >= g.y0 && y <= g.y1;
    if (inGoal(Math.floor(g.px), Math.floor(g.py)) && walkable(s, Math.floor(g.px), Math.floor(g.py)) && lineClear(s, e.x, e.y, g.px, g.py)) {
      e.path = [g.px, g.py];
      budget -= 4;
      continue;
    }
    const r = findRoute(s, e.x, e.y, g, Math.min(12000, Math.max(800, budget)));
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
    if (u.kind !== 'unit' || u.hp <= 0) continue;
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
      u.x -= (dx / d) * push * (wu / tot) * 2 * 0.5;
      u.y -= (dy / d) * push * (wu / tot) * 2 * 0.5;
      o.x += (dx / d) * push * (wo / tot) * 2 * 0.5;
      o.y += (dy / d) * push * (wo / tot) * 2 * 0.5;
    });
  }
}

/** Keep units out of water, rock, resources and buildings, sliding along their edges. */
export function collide(s: GameState, u: Unit): void {
  const r = statsOf(s, u).radius;
  u.x = Math.max(r, Math.min(s.w - r, u.x));
  u.y = Math.max(r, Math.min(s.h - r, u.y));
  const cx = Math.floor(u.x);
  const cy = Math.floor(u.y);
  if (!walkable(s, cx, cy)) {
    // Inside something (a new foundation, a pushed crowd): out to the nearest open tile.
    const t = nearestWalkable(s, u.x, u.y, 8);
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
      if (walkable(s, tx, ty)) continue;
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
