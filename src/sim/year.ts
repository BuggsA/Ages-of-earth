import { SEASON, YEAR, secs } from './data';
import { DIRS, spawnAnimal } from './animals';
import { landOwnerAt } from './borders';
import { walkable } from './grid';
import { seasonAt } from './seasons';
import { R_NONE, R_TREE } from './types';
import type { Animal, GameState } from './types';

/**
 * The turning year (#479, Goal 1 s3): the seasons of `seasons.ts` turn each homeland's staple, so the
 * opening that suits a homeland stops working for part of every year (`YEAR` in `data.ts`).
 * - The Herd Plains: the home herds trek out toward the middle each autumn and come home each spring, each
 *   deer still alive with a calf. A herd hunted out never comes back.
 * - The Shore: the shoals run thick in autumn and the mere ices over in winter (`catchOf`).
 * - The Deep Wood: deer come in to yard in the woods by every town each winter, and go back out in spring.
 * Everything follows from the tick and the animals, so saves and replays need nothing new but `Animal.town`.
 */

/** How the year scales a boat's catch: the Shore's autumn run and winter ice; 1 elsewhere. */
export function catchOf(s: GameState): number {
  if (s.homeland !== 'shore') return 1;
  const i = seasonAt(s);
  return i === 2 ? YEAR.run : i === 3 ? YEAR.ice : 1;
}

/** Whether the Herd Plains' home herds are out on their trek (autumn and winter). */
export function herdsOut(s: GameState): boolean {
  return s.homeland === 'herds' && seasonAt(s) >= 2;
}

/** Whether the Deep Wood's deer are in their yards (winter). */
export function yarding(s: GameState): boolean {
  return s.homeland === 'wood' && seasonAt(s) === 3;
}

/** At the start: on the Herd Plains, each herd that began within `YEAR.home` tiles of a town is that town's. */
export function markHomeHerds(s: GameState): void {
  if (s.homeland !== 'herds') return;
  for (const a of s.animals) {
    if (a.kind !== 'deer') continue;
    const ox = a.origX ?? a.homeX;
    const oy = a.origY ?? a.homeY;
    let best = YEAR.home * YEAR.home;
    for (const p of s.players) {
      const d = (ox - p.startX) * (ox - p.startX) + (oy - p.startY) * (oy - p.startY);
      if (d <= best) {
        best = d;
        a.town = p.id;
      }
    }
  }
}

/** Run each tick: on the turn of a season, move the herds that keep this homeland's year. */
export function turnYear(s: GameState): void {
  if (s.tick === 0 || s.tick % secs(SEASON.len) !== 0) return;
  const i = seasonAt(s);
  if (s.homeland === 'herds') {
    if (i === 2) trekOut(s);
    else if (i === 0) comeHome(s);
  } else if (s.homeland === 'wood') {
    if (i === 3) yardIn(s);
    else if (i === 0) yardOut(s);
  }
}

/** Ground a deer can stand on: on the map, open, and, unless `mine` says whose it may be, held by nobody. */
function open(s: GameState, x: number, y: number, mine = -1): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 3 || ty < 3 || tx >= s.w - 3 || ty >= s.h - 3 || !walkable(s, tx, ty)) return false;
  const owner = landOwnerAt(s, tx, ty);
  return owner < 0 || owner === mine;
}

const N8 = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]] as const;

/** Every tile a deer could walk to from a point within `R` tiles: each one's step back toward it (-1 where none). */
function reach(s: GameState, x: number, y: number, R: number): Int32Array {
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const from = fy * s.w + fx;
  const back = new Int32Array(s.w * s.h).fill(-1);
  back[from] = from;
  const queue = [from];
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q];
    const cx = c % s.w;
    const cy = (c - cx) / s.w;
    for (const [dx, dy] of N8) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h || Math.abs(nx - fx) > R || Math.abs(ny - fy) > R) continue;
      const ni = ny * s.w + nx;
      if (back[ni] >= 0 || !walkable(s, nx, ny)) continue;
      // Corners are cut only between open tiles: a step that grazes a blocked one stops the deer there.
      if (dx && dy && (!walkable(s, cx + dx, cy) || !walkable(s, cx, cy + dy))) continue;
      back[ni] = c;
      queue.push(ni);
    }
  }
  return back;
}

/** Whether a reach got to the tile under a point. */
const reached = (s: GameState, back: Int32Array, x: number, y: number) => back[Math.floor(y) * s.w + Math.floor(x)] >= 0;

/** The way from a reach's start to a tile it got to: the tiles where it turns, nearest first, ending on that tile. */
function wayTo(back: Int32Array, to: number): number[] {
  const path: number[] = [];
  for (let c = to; back[c] !== c; c = back[c]) path.push(c);
  path.reverse();
  const out: number[] = [];
  for (let k = 0; k < path.length; k++) {
    const prev = k ? path[k - 1] : back[path[0]];
    const next = path[k + 1];
    if (next === undefined || next - path[k] !== path[k] - prev) out.push(path[k]);
  }
  return out;
}

/** How far a herd on the move looks for its way, in tiles each side. */
const SEARCH = 40;

/** Send a deer to new ground by a way round what stands between, settling a little apart from its fellows. */
function send(s: GameState, a: Animal, x: number, y: number): void {
  const back = reach(s, a.x, a.y, SEARCH);
  const to = Math.floor(y) * s.w + Math.floor(x);
  a.way = back[to] >= 0 ? wayTo(back, to) : undefined;
  const j = DIRS[a.id % 8];
  const r = 0.6 + (a.id % 3) * 0.5;
  const fx = x + j[0] * r;
  const fy = y + j[1] * r;
  const ok = walkable(s, Math.floor(fx), Math.floor(fy));
  a.homeX = ok ? fx : x;
  a.homeY = ok ? fy : y;
  // Walking to where it stands, it takes the first turn of its way next tick (or, with none, makes straight for it).
  a.tx = a.way ? a.x : a.homeX;
  a.ty = a.way ? a.y : a.homeY;
  a.state = 'walk';
  a.t = secs(YEAR.walk);
}

/** The living deer of each herd that keeps a town's year, by herd, in id order. */
function herdsOf(s: GameState): Map<number, Animal[]> {
  const out = new Map<number, Animal[]>();
  for (const a of s.animals) {
    if (a.kind !== 'deer' || a.town === undefined || a.hp <= 0) continue;
    const h = a.herd ?? a.id;
    const list = out.get(h);
    if (list) list.push(a);
    else out.set(h, [a]);
  }
  return out;
}

/** Turn a direction by 45° steps (the rules keep no trigonometry). */
function turn(x: number, y: number, k: number): [number, number] {
  let ax = x;
  let ay = y;
  const steps = ((k % 8) + 8) % 8;
  for (let n = 0; n < steps; n++) [ax, ay] = [(ax - ay) * 0.7071, (ax + ay) * 0.7071];
  return [ax, ay];
}

/** Autumn on the Herd Plains: every home herd treks out to grazing `YEAR.out` tiles from its town, toward the open middle. */
function trekOut(s: GameState): void {
  const mx = s.w / 2;
  const my = s.h / 2;
  for (const herd of herdsOf(s).values()) {
    const lead = herd[0];
    const p = s.players[lead.town!];
    // Toward the middle; a town at the middle sends its herds the way they already lie.
    let dx = mx - p.startX;
    let dy = my - p.startY;
    if (dx * dx + dy * dy < 4) {
      dx = (lead.origX ?? lead.homeX) - p.startX;
      dy = (lead.origY ?? lead.homeY) - p.startY;
    }
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-3) continue;
    const back = reach(s, lead.x, lead.y, SEARCH);
    let to: [number, number] | null = null;
    // As near the middle's way as the herd can walk to: then a little to either side, and nearer.
    for (const k of [0, 1, -1, 2, -2, 3, -3]) {
      const [vx, vy] = turn(dx / d, dy / d, k);
      for (let r = YEAR.out; r >= YEAR.out - YEAR.trek && !to; r -= 2) {
        const x = p.startX + vx * r;
        const y = p.startY + vy * r;
        if (open(s, x, y) && reached(s, back, x, y)) to = [x, y];
      }
      if (to) break;
    }
    if (!to) continue;
    for (const a of herd) send(s, a, to[0], to[1]);
  }
}

/** Spring on the Herd Plains: the home herds walk home, each deer with `YEAR.calves` calves. */
function comeHome(s: GameState): void {
  for (const herd of herdsOf(s).values()) {
    const lead = herd[0];
    const ox = lead.origX ?? lead.homeX;
    const oy = lead.origY ?? lead.homeY;
    const calves = Math.max(0, Math.min(herd.length * YEAR.calves, YEAR.herdMax - herd.length));
    for (let k = 0; k < calves; k++) {
      const mother = herd[k % herd.length];
      const c = spawnAnimal(s, mother.x, mother.y);
      c.herd = lead.herd ?? lead.id;
      c.origX = ox;
      c.origY = oy;
      c.town = lead.town;
      herd.push(c);
    }
    for (const a of herd) send(s, a, ox, oy);
  }
}

/** The best yard by a town for the Deep Wood's winter deer, and where its deer come in from; null if none. */
function yardFor(s: GameState, town: number): { x: number; y: number; ex: number; ey: number } | null {
  const p = s.players[town];
  const sx = Math.floor(p.startX);
  const sy = Math.floor(p.startY);
  let best: { x: number; y: number; ex: number; ey: number } | null = null;
  let bestTrees = YEAR.trees - 1;
  const R = YEAR.yardMax;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const dd = dx * dx + dy * dy;
      if (dd < YEAR.yardMin * YEAR.yardMin || dd > R * R) continue;
      const x = sx + dx;
      const y = sy + dy;
      if (!open(s, x + 0.5, y + 0.5, town) || s.res[y * s.w + x] !== R_NONE) continue;
      let trees = 0;
      for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) if (s.res[(y + oy) * s.w + x + ox] === R_TREE) trees++;
      if (trees <= bestTrees) continue;
      // The deer come in from outside, as far out as `YEAR.from`, by a way they can walk.
      const back = reach(s, x + 0.5, y + 0.5, YEAR.from + 2);
      const d = Math.sqrt(dd);
      const ux = dx / d;
      const uy = dy / d;
      let entry: [number, number] | null = null;
      for (const k of [0, 1, -1, 2, -2, 3, -3]) {
        const [vx, vy] = turn(ux, uy, k);
        for (let t = YEAR.from; t >= YEAR.enter && !entry; t -= 2) {
          const ex = x + 0.5 + vx * t;
          const ey = y + 0.5 + vy * t;
          if (open(s, ex, ey, town) && reached(s, back, ex, ey)) entry = [ex, ey];
        }
        if (entry) break;
      }
      if (!entry) continue;
      bestTrees = trees;
      best = { x: x + 0.5, y: y + 0.5, ex: entry[0], ey: entry[1] };
    }
  }
  return best;
}

/** Winter in the Deep Wood: deer come in to a yard by every town, the same deer each year while they live. */
function yardIn(s: GameState): void {
  const herds = [...herdsOf(s).values()];
  for (const p of s.players) {
    if (p.defeated) continue;
    const yard = yardFor(s, p.id);
    if (!yard) continue;
    const herd = herds.find((h) => h[0].town === p.id) ?? [];
    for (let k = herd.length; k < YEAR.yard; k++) {
      const a = spawnAnimal(s, yard.ex, yard.ey);
      a.herd = herd.length ? (herd[0].herd ?? herd[0].id) : a.id;
      a.origX = herd.length ? herd[0].origX : yard.ex;
      a.origY = herd.length ? herd[0].origY : yard.ey;
      a.town = p.id;
      herd.push(a);
    }
    for (const a of herd) send(s, a, yard.x, yard.y);
  }
}

/** Spring in the Deep Wood: the yarded deer go back out to where they came in. */
function yardOut(s: GameState): void {
  for (const herd of herdsOf(s).values()) {
    const lead = herd[0];
    for (const a of herd) send(s, a, lead.origX ?? lead.homeX, lead.origY ?? lead.homeY);
  }
}
