import { AIR, BARGE, NAVAL, lineClear, lock, sails, walkable } from './grid';
import type { GameState, Goal } from './types';
import { B_GATE, B_TERRAIN, T_WATER } from './types';

/**
 * Grid pathfinding: A* over tiles with eight directions (no cutting past blocked corners), then the
 * route is pulled taut so units walk straight lines instead of stair steps. The goal is a rectangle of
 * tiles: one tile for a walk, or the ring around a building or a resource to work it.
 */

const SQRT2 = Math.SQRT2;
const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
] as const;

let size = 0;
let gScore = new Float64Array(0);
let fScore = new Float64Array(0);
let parent = new Int32Array(0);
let stamp = new Uint32Array(0);
let closed = new Uint32Array(0);
let heap = new Int32Array(0);
let gen = 0;

function ensure(n: number): void {
  if (n === size) return;
  size = n;
  gScore = new Float64Array(n);
  fScore = new Float64Array(n);
  parent = new Int32Array(n);
  stamp = new Uint32Array(n);
  closed = new Uint32Array(n);
  // Room for repeated entries (no decrease-key): each tile can be pushed once per neighbor.
  heap = new Int32Array(n * 8 + 16);
  gen = 0;
}

function octile(dx: number, dy: number): number {
  const ax = dx < 0 ? -dx : dx;
  const ay = dy < 0 ? -dy : dy;
  return ax > ay ? ax + (SQRT2 - 1) * ay : ay + (SQRT2 - 1) * ax;
}

function hToGoal(x: number, y: number, g: Goal): number {
  const dx = x < g.x0 ? g.x0 - x : x > g.x1 ? x - g.x1 : 0;
  const dy = y < g.y0 ? g.y0 - y : y > g.y1 ? y - g.y1 : 0;
  return octile(dx, dy);
}

export interface PathResult {
  /** Waypoints [x0, y0, x1, y1, ...] in tile coordinates (tile centers, or the goal point). */
  points: number[];
  /** Whether it reaches the goal (otherwise it gets as close as it could). */
  complete: boolean;
  /** Tiles looked at, for the per-tick budget. */
  cost: number;
}

/**
 * Find a route from a point to a goal rectangle. `veto` (#755, routes that read the tide) turns down a step onto a tile reached `g` tiles
 * along the way, so a route can ask about a tile at the moment it would get there.
 */
export function findPath(s: GameState, sx: number, sy: number, goal: Goal, limit = 8000, team = -1, veto?: (tile: number, g: number) => boolean): PathResult {
  const w = s.w;
  ensure(s.w * s.h);
  gen++;
  if (gen === 0xffffffff) {
    stamp.fill(0);
    closed.fill(0);
    gen = 1;
  }
  const startX = Math.max(0, Math.min(w - 1, Math.floor(sx)));
  const startY = Math.max(0, Math.min(s.h - 1, Math.floor(sy)));
  const start = startY * w + startX;

  let heapLen = 0;
  const push = (i: number) => {
    let k = heapLen++;
    heap[k] = i;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (fScore[heap[p]] <= fScore[heap[k]]) break;
      const t = heap[p];
      heap[p] = heap[k];
      heap[k] = t;
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    heapLen--;
    if (heapLen > 0) {
      heap[0] = heap[heapLen];
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let m = k;
        if (l < heapLen && fScore[heap[l]] < fScore[heap[m]]) m = l;
        if (r < heapLen && fScore[heap[r]] < fScore[heap[m]]) m = r;
        if (m === k) break;
        const t = heap[m];
        heap[m] = heap[k];
        heap[k] = t;
        k = m;
      }
    }
    return top;
  };

  stamp[start] = gen;
  gScore[start] = 0;
  parent[start] = -1;
  const h0 = hToGoal(startX, startY, goal);
  fScore[start] = h0;
  push(start);
  let best = start;
  let bestH = h0;
  let found = -1;
  let cost = 0;

  while (heapLen > 0) {
    const cur = pop();
    if (closed[cur] === gen) continue;
    closed[cur] = gen;
    cost++;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    const hc = hToGoal(cx, cy, goal);
    if (hc === 0) {
      found = cur;
      break;
    }
    if (hc < bestH) {
      bestH = hc;
      best = cur;
    }
    if (cost >= limit) break;
    const gc = gScore[cur];
    for (let d = 0; d < 8; d++) {
      const dx = DIRS[d][0];
      const dy = DIRS[d][1];
      const nx = cx + dx;
      const ny = cy + dy;
      if (!walkable(s, nx, ny, team)) continue;
      if (dx !== 0 && dy !== 0 && (!walkable(s, cx + dx, cy, team) || !walkable(s, cx, cy + dy, team))) continue;
      const ni = ny * w + nx;
      if (closed[ni] === gen) continue;
      const ng = gc + DIRS[d][2];
      if (stamp[ni] === gen && ng >= gScore[ni]) continue;
      // A diagonal step brushes both tiles at its corner, so a veto asks about them too.
      if (veto && (veto(ni, ng) || (dx !== 0 && dy !== 0 && (veto(cy * w + nx, ng) || veto(ny * w + cx, ng))))) continue;
      stamp[ni] = gen;
      gScore[ni] = ng;
      parent[ni] = cur;
      // A touch of weight on the heuristic keeps searches narrow on open ground.
      fScore[ni] = ng + hToGoal(nx, ny, goal) * 1.001;
      push(ni);
    }
  }

  const end = found >= 0 ? found : best;
  const tiles: number[] = [];
  for (let i = end; i !== -1; i = parent[i]) tiles.push(i);
  tiles.reverse();

  const pts: number[] = [];
  for (const t of tiles) pts.push((t % w) + 0.5, Math.floor(t / w) + 0.5);
  if (found >= 0) {
    // End on the requested spot if it is inside the last tile's reach.
    const ex = end % w;
    const ey = Math.floor(end / w);
    const px = Math.max(ex + 0.2, Math.min(ex + 0.8, goal.px));
    const py = Math.max(ey + 0.2, Math.min(ey + 0.8, goal.py));
    pts[pts.length - 2] = px;
    pts[pts.length - 1] = py;
  }
  return { points: smooth(s, sx, sy, pts, team, veto), complete: found >= 0, cost };
}

/** Whether a straight walk from one point to another, starting `g0` tiles along the way, steps on no tile `veto` turns down (#755). */
function lineSafe(s: GameState, x0: number, y0: number, x1: number, y1: number, g0: number, veto: (tile: number, g: number) => boolean): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(len * 3));
  let last = -1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const tile = Math.floor(y0 + dy * t) * s.w + Math.floor(x0 + dx * t);
    if (tile === last) continue;
    last = tile;
    if (veto(tile, g0 + len * t)) return false;
  }
  return true;
}

/** Pull a stair-step route taut: keep only the waypoints where the straight view ahead is blocked (or, with a `veto`, turned down). */
function smooth(s: GameState, sx: number, sy: number, pts: number[], team: number, veto?: (tile: number, g: number) => boolean): number[] {
  const n = pts.length / 2;
  if (n <= 1) return pts;
  const out: number[] = [];
  let ax = sx;
  let ay = sy;
  // Standing inside something (pushed into a new foundation): step to the first open tile before cutting corners.
  if (!walkable(s, Math.floor(sx), Math.floor(sy), team)) {
    out.push(pts[2], pts[3]);
    ax = pts[2];
    ay = pts[3];
  }
  // How far along the kept waypoints run, for a veto that asks about the moment a tile is reached.
  let g = 0;
  for (let i = out.length ? 2 : 1; i < n; i++) {
    if (lineClear(s, ax, ay, pts[i * 2], pts[i * 2 + 1], team) && (!veto || lineSafe(s, ax, ay, pts[i * 2], pts[i * 2 + 1], g, veto))) continue;
    const px = pts[(i - 1) * 2];
    const py = pts[(i - 1) * 2 + 1];
    if (veto) g += Math.sqrt((px - ax) * (px - ax) + (py - ay) * (py - ay));
    out.push(px, py);
    ax = px;
    ay = py;
  }
  out.push(pts[(n - 1) * 2], pts[(n - 1) * 2 + 1]);
  return out;
}

// ---- Distance fields for long trips --------------------------------------------------------------

/**
 * For long walks a whole-map distance field is grown out from the destination once and shared by
 * every unit going there (an army on the march, attackers converging on a building). Each unit then
 * just walks downhill, so a detour of any length around woods and lakes costs almost nothing.
 */

interface Field {
  version: number;
  tick: number;
  /** Steps to the goal in fifths of a tile (orthogonal 5, diagonal 7), or FAR where it can't be reached. */
  dist: Int32Array;
}

const FAR = 0x7fffffff;
const fieldCache = new WeakMap<GameState, Map<string, Field>>();
const FIELD_LIFE = 400;
const MAX_FIELDS = 12;
const STEP_COST = [5, 5, 5, 5, 7, 7, 7, 7];
/** Dial's bucket queue: one bucket per pending distance, mod 8 (more than the largest step). */
const buckets: number[][] = Array.from({ length: 8 }, () => []);

/** Set when the last `field` call had to grow a new field (it counts against the tick's route budget). */
let freshField = false;

function field(s: GameState, key: string, seeds: number[], team: number): Field {
  freshField = false;
  let cache = fieldCache.get(s);
  if (!cache) {
    cache = new Map();
    fieldCache.set(s, cache);
  }
  const hit = cache.get(key);
  if (hit && hit.version === s.blockVersion && s.tick - hit.tick < FIELD_LIFE) return hit;
  const w = s.w;
  const h = s.h;
  const n = w * h;
  const dist = new Int32Array(n).fill(FAR);
  // Walkability once, as bytes, for the inner loop.
  const open = new Uint8Array(n);
  // Ships sail open water, canals and under bridges (#701 s5): `sails`, as `walkable` asks it.
  if (team === NAVAL) for (let i = 0; i < n; i++) open[i] = sails(s, i) ? 1 : 0;
  else if (team === BARGE) for (let i = 0; i < n; i++) open[i] = s.terrain[i] === T_WATER && (s.block[i] === B_TERRAIN || s.block[i] === 0 || (s.block[i] === B_GATE && lock(s, i))) ? 1 : 0;
  else if (team === AIR) open.fill(1);
  else for (let i = 0; i < n; i++) open[i] = s.block[i] === 0 || (s.block[i] === B_GATE && s.gateTeam[i] === team && team >= 0) ? 1 : 0;
  for (const b of buckets) b.length = 0;
  let pending = 0;
  for (const t of seeds) {
    dist[t] = 0;
    buckets[0].push(t);
    pending++;
  }
  for (let d = 0; pending > 0; d++) {
    const bucket = buckets[d & 7];
    while (bucket.length) {
      const cur = bucket.pop()!;
      pending--;
      if (dist[cur] !== d) continue;
      const cx = cur % w;
      const cy = (cur - cx) / w;
      for (let k = 0; k < 8; k++) {
        const dx = DIRS[k][0];
        const dy = DIRS[k][1];
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (!open[ni]) continue;
        if (dx !== 0 && dy !== 0 && (!open[cy * w + nx] || !open[ny * w + cx])) continue;
        const nd = d + STEP_COST[k];
        if (nd >= dist[ni]) continue;
        dist[ni] = nd;
        buckets[nd & 7].push(ni);
        pending++;
      }
    }
  }
  const f = { version: s.blockVersion, tick: s.tick, dist };
  freshField = true;
  if (cache.size >= MAX_FIELDS) {
    // Drop the oldest.
    let oldKey = '';
    let oldTick = Infinity;
    for (const [k, v] of cache) {
      if (v.tick < oldTick) {
        oldTick = v.tick;
        oldKey = k;
      }
    }
    cache.delete(oldKey);
  }
  cache.set(key, f);
  return f;
}

/** Tiles of a goal to grow a field from: the goal rectangle's walkable tiles (a 4×4 block around a point goal). */
function fieldSeeds(s: GameState, g: Goal, team: number): { key: string; seeds: number[]; exact: boolean } {
  const small = g.x0 === g.x1 && g.y0 === g.y1;
  let x0 = g.x0;
  let y0 = g.y0;
  let x1 = g.x1;
  let y1 = g.y1;
  if (small) {
    // Point goals share a field per 4×4 block, so a whole formation uses one.
    x0 = Math.floor(g.x0 / 4) * 4;
    y0 = Math.floor(g.y0 / 4) * 4;
    x1 = x0 + 3;
    y1 = y0 + 3;
  }
  const seeds: number[] = [];
  for (let y = Math.max(0, y0); y <= Math.min(s.h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(s.w - 1, x1); x++) if (walkable(s, x, y, team)) seeds.push(y * s.w + x);
  if (!seeds.length && small && walkable(s, g.x0, g.y0, team)) seeds.push(g.y0 * s.w + g.x0);
  return { key: `${team}:${x0},${y0},${x1},${y1}`, seeds, exact: !small };
}

/**
 * A route to a goal: plain A* for short trips, and for long ones a walk down a shared distance field
 * followed by a short A* for the last stretch.
 */
export function findRoute(s: GameState, sx: number, sy: number, goal: Goal, limit: number, team = -1): PathResult {
  const tx = Math.max(0, Math.min(s.w - 1, Math.floor(sx)));
  const ty = Math.max(0, Math.min(s.h - 1, Math.floor(sy)));
  if (hToGoal(tx, ty, goal) < 22) return findPath(s, sx, sy, goal, limit, team);
  const { key, seeds, exact } = fieldSeeds(s, goal, team);
  if (!seeds.length) return findPath(s, sx, sy, goal, limit, team);
  const f = field(s, key, seeds, team);
  const fieldCost = freshField ? (s.w * s.h) >> 2 : 50;
  const w = s.w;
  let cur = ty * w + tx;
  if (f.dist[cur] === FAR) {
    // Standing somewhere odd (inside a new foundation): start from the best neighbor.
    let best = -1;
    for (let d = 0; d < 8; d++) {
      const nx = tx + DIRS[d][0];
      const ny = ty + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= s.h) continue;
      const ni = ny * w + nx;
      if (f.dist[ni] < (best < 0 ? FAR : f.dist[best])) best = ni;
    }
    // Not connected to the goal at all: get as close as A* can.
    if (best < 0) return findPath(s, sx, sy, goal, limit, team);
    cur = best;
  }
  const tiles = [cur];
  for (let guard = 0; guard < 4000; guard++) {
    const cx = cur % w;
    const cy = (cur - cx) / w;
    if (f.dist[cur] === 0) break;
    if (!exact && hToGoal(cx, cy, goal) <= 4) break;
    let next = -1;
    let nd = f.dist[cur];
    for (let d = 0; d < 8; d++) {
      const dx = DIRS[d][0];
      const dy = DIRS[d][1];
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= s.h) continue;
      if (dx !== 0 && dy !== 0 && (!walkable(s, cx + dx, cy, team) || !walkable(s, cx, cy + dy, team))) continue;
      const ni = ny * w + nx;
      if (f.dist[ni] < nd) {
        nd = f.dist[ni];
        next = ni;
      }
    }
    if (next < 0) break;
    cur = next;
    tiles.push(cur);
  }
  const pts: number[] = [];
  for (const t of tiles) pts.push((t % w) + 0.5, Math.floor(t / w) + 0.5);
  let complete = f.dist[cur] === 0 || hToGoal(cur % w, Math.floor(cur / w), goal) === 0;
  const ex = cur % w;
  const ey = Math.floor(cur / w);
  if (!exact || complete) {
    // The last stretch to the exact spot.
    const tail = findPath(s, ex + 0.5, ey + 0.5, goal, 3000, team);
    complete = tail.complete;
    const smoothHead = smooth(s, sx, sy, pts, team);
    return { points: [...smoothHead, ...tail.points], complete, cost: fieldCost + tail.cost };
  }
  return { points: smooth(s, sx, sy, pts, team), complete, cost: fieldCost };
}
