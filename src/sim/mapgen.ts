import { AMOUNT, BOAR, BOG_IRON, CAVE, LANDMARKS, RARE, MAMMOTH, MAP_SIZES, RELIC, RUINS, TRADE, WOLF } from './data';
import { fbm, mulberry32, type Rng } from './rng';
import type { Cave, LandmarkKind, MapSize, MapType, RareId, RuinFind } from './types';
import { B_RES, B_TERRAIN, R_BERRY, R_BLOODIRON, R_BOG, R_SALT, R_SALTPETRE, R_FISH, R_GOLD, R_NONE, R_STONE, R_TREE, T_GRASS, T_ROCK, T_SAND, T_WATER } from './types';

/**
 * World generation: rolling grassland with lakes, rocky ridges and woods (more or less of each by map
 * type), and starting spots for two to four players that are flat, open and fair: each gets berries, a
 * herd of deer, gold, stone and a wood line at the same distances. Only integer hashing and arithmetic
 * are used, so every browser builds the same world.
 */

interface Recipe {
  water: number;
  rockE: number;
  ridge: number;
  relief: number;
  forest: number;
  forest2: number;
  scatter: number;
  herds: number;
  berries: number;
}

const RECIPES: Record<MapType, Recipe> = {
  continental: { water: 0.34, rockE: 0.6, ridge: 0.6, relief: 1, forest: 0.6, forest2: 0.56, scatter: 0.88, herds: 1, berries: 1 },
  highlands: { water: 0.26, rockE: 0.53, ridge: 0.55, relief: 1.7, forest: 0.62, forest2: 0.58, scatter: 0.9, herds: 1, berries: 1 },
  lakes: { water: 0.43, rockE: 0.68, ridge: 0.66, relief: 0.9, forest: 0.62, forest2: 0.58, scatter: 0.9, herds: 1, berries: 1 },
  forest: { water: 0.3, rockE: 0.62, ridge: 0.62, relief: 1, forest: 0.48, forest2: 0.45, scatter: 0.78, herds: 0.8, berries: 1 },
  plains: { water: 0.27, rockE: 0.72, ridge: 0.7, relief: 0.6, forest: 0.72, forest2: 0.69, scatter: 0.95, herds: 2, berries: 1.6 },
  sea: { water: 0.3, rockE: 0.72, ridge: 0.7, relief: 0.8, forest: 0.6, forest2: 0.56, scatter: 0.88, herds: 1, berries: 1 },
};

/** How much of the middle of the map an inland sea takes (as a fraction of the map's width). */
const SEA_RADIUS = 0.25;

export interface MapData {
  w: number;
  h: number;
  terrain: Uint8Array;
  height: Float32Array;
  res: Uint8Array;
  amount: Int32Array;
  block: Uint8Array;
  starts: { x: number; y: number }[];
  /** Where deer graze at the start. */
  deer: { x: number; y: number }[];
  /** Where relics lie at the start (tile centers). */
  relics: { x: number; y: number }[];
  /** Where the trading posts stand (the centers of their middle tiles). */
  posts: { x: number; y: number }[];
  /** Whether this world holds bog iron (#39). */
  bogIron: boolean;
  /** Which rare ores this world holds (#356). */
  rares: RareId[];
  /** Cave mouths (#356). */
  caves: Cave[];
  /** Ancient ruins (#64): where they stand (tile centers) and what lies under each. */
  ruins: { x: number; y: number; find: RuinFind }[];
  /** The wild (#171): mammoths, and wolves by their dens. Empty on campaign maps. */
  wild: { kind: 'mammoth' | 'wolf' | 'boar'; x: number; y: number }[];
  /** Contested landmarks: where they stand (tile centers) and what each is. */
  landmarks: { x: number; y: number; kind: LandmarkKind }[];
}

const DIR8 = [
  [1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071], [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071],
] as const;

function shuffle<T>(rng: Rng, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** `deposits` false leaves out what only some seeds hold (bog iron, ruins): campaign maps stay as they were made. `veins` adds the deep veins (#356); `createGame` turns it on for ordinary matches. */
export function generateMap(seed: number, size: MapSize, players = 2, type: MapType = 'continental', deposits = true, veins = false): MapData {
  const R = RECIPES[type];
  const WL = R.water;
  const n = MAP_SIZES[size].n;
  const w = n;
  const h = n;
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const terrain = new Uint8Array(w * h);
  const res = new Uint8Array(w * h);
  const amount = new Int32Array(w * h);
  const salt = Math.floor(rng() * 100000);

  // Starting spots: two across a diagonal or straight across, three in a triangle, four in the corners.
  const layouts: number[][][] =
    players <= 2
      ? [
          [[-0.31, -0.31], [0.31, 0.31]],
          [[-0.31, 0.31], [0.31, -0.31]],
          [[-0.36, 0], [0.36, 0]],
          [[0, -0.36], [0, 0.36]],
        ]
      : players === 3
        ? [
            [[0, -0.35], [0.303, 0.175], [-0.303, 0.175]],
            [[0, 0.35], [-0.303, -0.175], [0.303, -0.175]],
          ]
        : [
            [[-0.32, -0.32], [0.32, -0.32], [0.32, 0.32], [-0.32, 0.32]],
            [[-0.36, 0], [0, -0.36], [0.36, 0], [0, 0.36]],
          ];
  const layout = layouts[Math.floor(rng() * layouts.length)];
  const flip = rng() < 0.5;
  const starts = layout.slice(0, players).map(([ox, oy]) => ({
    x: Math.floor(w / 2 + ox * w + (rng() - 0.5) * 0.04 * w),
    y: Math.floor(h / 2 + oy * h + (rng() - 0.5) * 0.04 * h),
  }));
  if (flip) starts.reverse();

  const startDist = (x: number, y: number) => {
    let d = Infinity;
    for (const s of starts) {
      const dx = x + 0.5 - s.x;
      const dy = y + 0.5 - s.y;
      d = Math.min(d, Math.sqrt(dx * dx + dy * dy));
    }
    return d;
  };

  // Elevation and ridges.
  const elev = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let e = fbm(x / 24, y / 24, salt, 4);
      const ridge = fbm(x / 13, y / 13, salt + 7, 3);
      const d = startDist(x, y);
      if (type === 'sea') {
        // A great sea in the middle with a ragged coast, and dry land all round it.
        const cx = x + 0.5 - w / 2;
        const cy = y + 0.5 - h / 2;
        const r = Math.sqrt(cx * cx + cy * cy) / w;
        const coast = SEA_RADIUS + (fbm(x / 10, y / 10, salt + 61, 2) - 0.5) * 0.08;
        if (r < coast) e = Math.min(e, WL - 0.02 - (coast - r) * 1.5);
        else e = Math.max(e, WL + 0.03 + (r - coast) * 0.4);
      }
      // Starting spots are kept as open, middling ground.
      const keep = d < 12 ? 1 : d < 20 ? (20 - d) / 8 : 0;
      e = e * (1 - keep) + 0.5 * keep;
      elev[i] = e;
      if (e < WL) terrain[i] = T_WATER;
      else if (e > R.rockE && ridge > R.ridge && keep === 0) terrain[i] = T_ROCK;
      else terrain[i] = T_GRASS;
    }
  }

  // Everyone must be able to walk to everyone: carve a way if lakes or ridges cut them off.
  const passable = (i: number) => terrain[i] !== T_WATER && terrain[i] !== T_ROCK;
  const flood = (from: number): Uint8Array => {
    const seen = new Uint8Array(w * h);
    const queue = [from];
    seen[from] = 1;
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      const x = i % w;
      const y = (i - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (seen[ni] || !passable(ni)) continue;
        seen[ni] = 1;
        queue.push(ni);
      }
    }
    return seen;
  };
  const s0 = starts[0].y * w + starts[0].x;
  for (let k = 1; k < starts.length; k++) {
    const reach = flood(s0);
    const sk = starts[k].y * w + starts[k].x;
    if (reach[sk]) continue;
    const steps = Math.ceil(Math.max(Math.abs(starts[k].x - starts[0].x), Math.abs(starts[k].y - starts[0].y)) * 1.5);
    for (let t = 0; t <= steps; t++) {
      const cx = Math.round(starts[0].x + ((starts[k].x - starts[0].x) * t) / steps);
      const cy = Math.round(starts[0].y + ((starts[k].y - starts[0].y) * t) / steps);
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const i = y * w + x;
          if (!passable(i)) {
            terrain[i] = T_GRASS;
            elev[i] = Math.max(elev[i], WL + 0.02);
          }
        }
      }
    }
  }
  // Land nobody can reach is folded into the lake or ridge around it.
  const reach = flood(s0);
  for (let i = 0; i < w * h; i++) {
    if (!passable(i) || reach[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    let rock = 0;
    let water = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const t = terrain[ny * w + nx];
        if (t === T_ROCK) rock++;
        else if (t === T_WATER) water++;
      }
    }
    terrain[i] = rock > water ? T_ROCK : T_WATER;
  }

  // Beaches.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (terrain[i] !== T_GRASS) continue;
      let wet = false;
      for (let dy = -1; dy <= 1 && !wet; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && terrain[ny * w + nx] === T_WATER) {
            wet = true;
            break;
          }
        }
      }
      if (wet) terrain[i] = T_SAND;
    }
  }

  // Heights at tile corners.
  const W = w + 1;
  const height = new Float32Array(W * (h + 1));
  for (let y = 0; y <= h; y++) {
    for (let x = 0; x <= w; x++) {
      let water = 0;
      let rock = 0;
      let count = 0;
      let e = 0;
      for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const tx = x + dx;
        const ty = y + dy;
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
        const i = ty * w + tx;
        count++;
        e += elev[i];
        if (terrain[i] === T_WATER) water++;
        else if (terrain[i] === T_ROCK) rock++;
      }
      e /= count;
      const detail = fbm(x / 5, y / 5, salt + 31, 2);
      let hgt: number;
      if (water === count) hgt = -0.55 - (WL - Math.min(WL, e)) * 6 - detail * 0.2;
      else if (water > 0) hgt = -0.06 + detail * 0.05;
      else {
        // Rolling ground: broad swells from the elevation, smaller hummocks on top.
        const swell = fbm(x / 11, y / 11, salt + 51, 2);
        hgt = 0.2 + ((e - WL) * 4.6 + (swell - 0.5) * 0.9) * R.relief + (detail - 0.5) * 0.4;
        if (rock > 0) hgt += (rock / count) * (1.4 + fbm(x / 3, y / 3, salt + 41, 2) * 2.6);
      }
      height[y * W + x] = hgt;
    }
  }

  // Resources.
  const free = (x: number, y: number, keepOut = 6) =>
    x > 1 && y > 1 && x < w - 2 && y < h - 2 && (terrain[y * w + x] === T_GRASS || terrain[y * w + x] === T_SAND) && res[y * w + x] === R_NONE && startDist(x, y) > keepOut;
  const put = (x: number, y: number, kind: number) => {
    const i = y * w + x;
    res[i] = kind;
    amount[i] = kind === R_TREE ? AMOUNT.tree : kind === R_BERRY ? AMOUNT.berry : kind === R_STONE ? AMOUNT.stone : AMOUNT.gold;
  };
  /** Grow a clump of `count` tiles from a center, each next to one already placed. */
  const cluster = (cx: number, cy: number, kind: number, count: number, keepOut = 6): number => {
    if (!free(cx, cy, keepOut)) {
      let found = false;
      for (let r = 1; r <= 3 && !found; r++) {
        for (let dy = -r; dy <= r && !found; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (free(cx + dx, cy + dy, keepOut)) {
              cx += dx;
              cy += dy;
              found = true;
              break;
            }
          }
        }
      }
      if (!found) return 0;
    }
    const tiles = [[cx, cy]];
    put(cx, cy, kind);
    let guard = 0;
    while (tiles.length < count && guard++ < count * 20) {
      const [bx, by] = tiles[Math.floor(rng() * tiles.length)];
      const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rng() * 4)];
      const nx = bx + dx;
      const ny = by + dy;
      if (!free(nx, ny, keepOut)) continue;
      put(nx, ny, kind);
      tiles.push([nx, ny]);
    }
    return tiles.length;
  };

  // Woods across the map.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const f = fbm(x / 9, y / 9, salt + 3, 3);
      const d = startDist(x, y);
      if (d < 10) continue;
      if ((f > R.forest || (f > R.forest2 && fbm(x / 3, y / 3, salt + 13, 2) > 0.6)) && free(x, y, 10)) put(x, y, R_TREE);
      else if (fbm(x / 2, y / 2, salt + 17, 1) > R.scatter && free(x, y, 8)) put(x, y, R_TREE);
    }
  }

  // The same kit around every start, at the same distances, in shuffled directions.
  const order = shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7]);
  for (const s of starts) {
    const pick = (k: number) => DIR8[order[k % 8]];
    const at = (k: number, d: number) => [Math.round(s.x + pick(k)[0] * d), Math.round(s.y + pick(k)[1] * d)];
    const [bx, by] = at(0, 7);
    cluster(bx, by, R_BERRY, 7, 5);
    const [gx, gy] = at(2, 10);
    cluster(gx, gy, R_GOLD, 4, 5);
    const [sx, sy] = at(5, 10);
    cluster(sx, sy, R_STONE, 4, 5);
    const [g2x, g2y] = at(3, 19);
    cluster(g2x, g2y, R_GOLD, 4, 5);
    // A wood line of its own, unless the woods are already close.
    let near = 0;
    for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) if (res[(s.y + dy) * w + s.x + dx] === R_TREE) near++;
    if (near < 30) {
      const [fx, fy] = at(7, 12);
      cluster(fx, fy, R_TREE, 26, 8);
      const [f2x, f2y] = at(6, 13);
      cluster(f2x, f2y, R_TREE, 14, 8);
    }
  }

  // More players, more to go round.
  const more = 0.6 + players * 0.2;
  // Deer: a herd near every start, more out in the wild.
  const deer: { x: number; y: number }[] = [];
  const herd = (cx: number, cy: number, count: number) => {
    let placed = 0;
    for (let k = 0; k < count * 6 && placed < count; k++) {
      const x = cx + Math.floor(rng() * 5) - 2;
      const y = cy + Math.floor(rng() * 5) - 2;
      if (!free(x, y, 6)) continue;
      if (deer.some((d) => d.x === x + 0.5 && d.y === y + 0.5)) continue;
      deer.push({ x: x + 0.5, y: y + 0.5 });
      placed++;
    }
  };
  for (const st of starts) {
    const d = DIR8[order[4 % 8]];
    herd(Math.round(st.x + d[0] * 13), Math.round(st.y + d[1] * 13), 4);
  }
  for (let k = 0, guard = 0; k < Math.round((n / 30) * R.herds * more) && guard < 200; guard++) {
    const x = 6 + Math.floor(rng() * (w - 12));
    const y = 6 + Math.floor(rng() * (h - 12));
    if (startDist(x, y) < 18 || !free(x, y, 18)) continue;
    herd(x, y, 3 + Math.floor(rng() * 3));
    k++;
  }

  // More to fight over in the open.
  const extra = (kind: number, count: number, tiles: number) => {
    for (let k = 0, guard = 0; k < count && guard < count * 40; guard++) {
      const x = 4 + Math.floor(rng() * (w - 8));
      const y = 4 + Math.floor(rng() * (h - 8));
      if (startDist(x, y) < 16 || !free(x, y, 16)) continue;
      if (cluster(x, y, kind, tiles, 16) > 0) k++;
    }
  };
  extra(R_GOLD, Math.round((n / 22) * more), 4);
  extra(R_STONE, Math.round((n / 28) * more), 4);
  extra(R_BERRY, Math.round((n / 26) * more * R.berries), 6);

  // Woods can wall players off from each other too: cut a road through wherever they do.
  for (let k = 1; k < starts.length; k++) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const seen = new Uint8Array(w * h);
      const queue = [s0];
      seen[s0] = 1;
      for (let q = 0; q < queue.length; q++) {
        const i = queue[q];
        const x = i % w;
        const y = (i - x) / w;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (seen[ni] || !passable(ni) || res[ni] !== R_NONE) continue;
          seen[ni] = 1;
          queue.push(ni);
        }
      }
      const sk = starts[k].y * w + starts[k].x;
      if (seen[sk]) break;
      // A road, bent through a point off to one side so there is a second way after the first.
      const mx = (starts[0].x + starts[k].x) / 2 + (attempt === 1 ? (starts[k].y - starts[0].y) * 0.3 : 0);
      const my = (starts[0].y + starts[k].y) / 2 - (attempt === 1 ? (starts[k].x - starts[0].x) * 0.3 : 0);
      for (const [ax, ay, bx, by] of [[starts[0].x, starts[0].y, mx, my], [mx, my, starts[k].x, starts[k].y]]) {
        const steps = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 1.5) + 1;
        for (let t = 0; t <= steps; t++) {
          const cx = Math.round(ax + ((bx - ax) * t) / steps);
          const cy = Math.round(ay + ((by - ay) * t) / steps);
          for (let dy = -1; dy <= 2; dy++) {
            for (let dx = -1; dx <= 2; dx++) {
              const x = cx + dx;
              const y = cy + dy;
              if (x < 0 || y < 0 || x >= w || y >= h) continue;
              const i = y * w + x;
              if (res[i] === R_TREE) {
                res[i] = R_NONE;
                amount[i] = 0;
              }
            }
          }
        }
      }
    }
  }

  // Fish: shoals in open water near a shore, in lakes and seas big enough to sail (and some near every
  // start where there is such water). They use their own dice, so the rest of the land is unchanged.
  const frng = mulberry32(seed ^ 0x5eaf15);
  const body = new Int32Array(w * h).fill(-1);
  const bodySize: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (terrain[i] !== T_WATER || body[i] >= 0) continue;
    const id = bodySize.length;
    let count = 0;
    const queue = [i];
    body[i] = id;
    for (let q = 0; q < queue.length; q++) {
      const c = queue[q];
      count++;
      const cx = c % w;
      const cy = (c - cx) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (terrain[ni] !== T_WATER || body[ni] >= 0) continue;
        body[ni] = id;
        queue.push(ni);
      }
    }
    bodySize.push(count);
  }
  const landNear = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && terrain[ny * w + nx] !== T_WATER) return true;
    }
    return false;
  };
  /** A water tile fit for a shoal: in big water, not hugging the shore, but near one. */
  const fishable = (x: number, y: number) => {
    if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) return false;
    const i = y * w + x;
    if (terrain[i] !== T_WATER || res[i] !== R_NONE || bodySize[body[i]] < 60) return false;
    return !landNear(x, y, 1) && landNear(x, y, 4);
  };
  const shoal = (cx: number, cy: number, count: number) => {
    let placed = 0;
    for (let k = 0; k < count * 8 && placed < count; k++) {
      const x = cx + Math.floor(frng() * 5) - 2;
      const y = cy + Math.floor(frng() * 5) - 2;
      if (!fishable(x, y)) continue;
      // Shoals keep a tile apart so boats can get between them.
      let crowded = false;
      for (let dy = -1; dy <= 1 && !crowded; dy++) for (let dx = -1; dx <= 1; dx++) if (res[(y + dy) * w + x + dx] === R_FISH) crowded = true;
      if (crowded) continue;
      res[y * w + x] = R_FISH;
      amount[y * w + x] = AMOUNT.fish;
      placed++;
    }
    return placed;
  };
  // Near every start, if there is sailable water within reach: the nearest fit spot.
  for (const st of starts) {
    let best = -1;
    let bestD = 26 * 26;
    for (let y = Math.max(0, st.y - 26); y < Math.min(h, st.y + 26); y++) {
      for (let x = Math.max(0, st.x - 26); x < Math.min(w, st.x + 26); x++) {
        if (!fishable(x, y)) continue;
        const d = (x - st.x) * (x - st.x) + (y - st.y) * (y - st.y);
        if (d < bestD) {
          bestD = d;
          best = y * w + x;
        }
      }
    }
    if (best >= 0) shoal(best % w, Math.floor(best / w), 4);
  }
  // And scattered over the open water.
  const shoals = Math.round((n / (type === 'sea' ? 7 : 22)) * more);
  for (let k = 0, guard = 0; k < shoals && guard < shoals * 60; guard++) {
    const x = 2 + Math.floor(frng() * (w - 4));
    const y = 2 + Math.floor(frng() * (h - 4));
    if (!fishable(x, y)) continue;
    if (shoal(x, y, 2 + Math.floor(frng() * 2)) > 0) k++;
  }

  const relics = placeRelics(seed, size, w, h, terrain, res, starts);
  const posts = placePosts(seed, size, w, h, terrain, height, res, amount, starts, relics, type === 'sea');
  const bogIron = deposits && placeBogIron(seed, w, h, terrain, res, amount, starts, deer, relics, posts);
  const ruins = deposits ? placeRuins(seed, size, w, h, terrain, res, starts, deer, relics, posts) : [];
  const wild = deposits ? placeWild(seed, size, w, h, terrain, res, starts, deer, relics, posts, ruins) : [];
  const landmarks = deposits ? placeLandmarks(seed, w, h, terrain, res, starts, deer, relics, posts, ruins, wild) : [];

  const rares = deposits && veins ? placeRares(seed, w, h, terrain, res, amount, starts, [...deer, ...relics, ...posts, ...ruins, ...wild.map((x) => ({ x: x.x, y: x.y })), ...landmarks.map((x) => ({ x: x.x, y: x.y }))]) : [];

  const caves = deposits && veins && rares.length ? placeCaves(seed, size, w, h, terrain, res, amount, starts, rares, wild) : [];

  // Resources nobody could stand next to are cleared away.
  const block = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (terrain[i] === T_WATER || terrain[i] === T_ROCK) block[i] |= B_TERRAIN;
    if (res[i] !== R_NONE) block[i] |= B_RES;
  }

  return { w, h, terrain, height, res, amount, block, starts, deer, relics, posts, bogIron, rares, caves, ruins, wild, landmarks };
}

/** Where a town's people can walk to without cutting a tree (or, with `axes`, by cutting their way). */
function reachFrom(w: number, h: number, terrain: Uint8Array, res: Uint8Array, st: { x: number; y: number }, axes = false): Uint8Array {
  const seen = new Uint8Array(w * h);
  const from = st.y * w + st.x;
  const queue = [from];
  seen[from] = 1;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (seen[ni] || (res[ni] !== R_NONE && !(axes && res[ni] === R_TREE)) || (terrain[ni] !== T_GRASS && terrain[ni] !== T_SAND)) continue;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  return seen;
}

/**
 * Relics, fairly: one for each player at the same distance from home and the same turn off the line to
 * the middle of the map, then a few more out where the land is as far from the two nearest towns as
 * from each other. Every one stands in open ground that can be walked to from every town. They roll
 * their own dice, so the rest of the map is the same as it would be without them.
 */
function placeRelics(seed: number, size: MapSize, w: number, h: number, terrain: Uint8Array, res: Uint8Array, starts: { x: number; y: number }[]): { x: number; y: number }[] {
  const rng = mulberry32(seed ^ 0x2e11c5);
  const land = (x: number, y: number) => x >= 2 && y >= 2 && x < w - 2 && y < h - 2 && (terrain[y * w + x] === T_GRASS || terrain[y * w + x] === T_SAND);
  const reaches = starts.map((st) => reachFrom(w, h, terrain, res, st));
  const out: { x: number; y: number }[] = [];
  const spaced = (x: number, y: number) => out.every((r) => (r.x - x) * (r.x - x) + (r.y - y) * (r.y - y) >= RELIC.spacing * RELIC.spacing);
  const fit = (x: number, y: number, k: number) => land(x, y) && reaches[k][y * w + x] === 1 && spaced(x, y);
  // Open ground (nothing growing or mined right beside it) is better, where there is some.
  const open = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!land(x + dx, y + dy) || res[(y + dy) * w + x + dx] !== R_NONE) return false;
    return true;
  };
  const dists = (x: number, y: number) => starts.map((st) => Math.sqrt((x + 0.5 - st.x) * (x + 0.5 - st.x) + (y + 0.5 - st.y) * (y + 0.5 - st.y)));
  // One for each player, `home` tiles out (give or take a little), nearest the spot turned the same way
  // off the line to the middle for everyone, and nearer that town than any other.
  const turn = rng() < 0.5 ? 1 : -1;
  starts.forEach((st, k) => {
    const mx = w / 2 - st.x;
    const my = h / 2 - st.y;
    const ml = Math.sqrt(mx * mx + my * my) || 1;
    // Half way between the line to the middle and square to it.
    const ax = mx / ml - (turn * my) / ml;
    const ay = my / ml + (turn * mx) / ml;
    const al = Math.sqrt(ax * ax + ay * ay);
    const tx = st.x + (ax / al) * RELIC.home;
    const ty = st.y + (ay / al) * RELIC.home;
    for (let pass = 0; pass < 8; pass++) {
      const band = 2 + (pass >> 1) * 2;
      const needOpen = pass % 2 === 0;
      let best: { x: number; y: number } | null = null;
      let bestD = Infinity;
      const R = RELIC.home + band;
      for (let y = Math.max(2, st.y - R); y <= Math.min(h - 3, st.y + R); y++) {
        for (let x = Math.max(2, st.x - R); x <= Math.min(w - 3, st.x + R); x++) {
          if (!fit(x, y, k) || (needOpen && !open(x, y))) continue;
          const ds = dists(x, y);
          if (Math.abs(ds[k] - RELIC.home) > band || ds.some((d, j) => j !== k && d <= ds[k])) continue;
          const d = (x + 0.5 - tx) * (x + 0.5 - tx) + (y + 0.5 - ty) * (y + 0.5 - ty);
          if (d < bestD) {
            bestD = d;
            best = { x, y };
          }
        }
      }
      if (best) {
        out.push(best);
        break;
      }
    }
  });
  // More between the towns, each about as far from its two nearest towns, and well away from all.
  const extra = RELIC.extra[size];
  for (let fair = RELIC.fair, placed = 0; fair <= RELIC.fair * 3 && placed < extra; fair += RELIC.fair) {
    const candidates: number[] = [];
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        // Somewhere every town can walk to.
        if (!land(x, y) || reaches.some((r) => r[y * w + x] !== 1) || (fair === RELIC.fair && !open(x, y))) continue;
        const ds = dists(x, y).sort((a, b) => a - b);
        if (ds[0] < RELIC.home + 2 || ds[1] - ds[0] > fair) continue;
        candidates.push(y * w + x);
      }
    }
    for (let guard = 0; placed < extra && candidates.length && guard < extra * 40; guard++) {
      const i = candidates[Math.floor(rng() * candidates.length)];
      const x = i % w;
      const y = (i - x) / w;
      if (!spaced(x, y)) continue;
      out.push({ x, y });
      placed++;
    }
  }
  return out.map((r) => ({ x: r.x + 0.5, y: r.y + 0.5 }));
}

/**
 * Trading posts, fairly: near the edge of the map, about as far from their two nearest towns, well away
 * from every town and from each other, on fairly level open ground that every town can walk to. Trees
 * on the plaza are cleared; nothing else is touched. They roll their own dice, so the rest of the map
 * (relics included) is the same as it would be without them.
 */
function placePosts(
  seed: number,
  size: MapSize,
  w: number,
  h: number,
  terrain: Uint8Array,
  height: Float32Array,
  res: Uint8Array,
  amount: Int32Array,
  starts: { x: number; y: number }[],
  relics: { x: number; y: number }[],
  shore = false,
): { x: number; y: number }[] {
  const rng = mulberry32(seed ^ 0x7ade05);
  const n = Math.min(w, h);
  // The plaza and a tile round it.
  const R = TRADE.plaza + 1;
  // Somewhere every town can walk to; failing that (in deep woods), cut their way to.
  const open = starts.map((st) => reachFrom(w, h, terrain, res, st));
  let reaches = open;
  const site = (x: number, y: number) => {
    let reached = false;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const i = (y + dy) * w + x + dx;
        if (terrain[i] !== T_GRASS && terrain[i] !== T_SAND) return false;
        // Trees make way for the plaza; berries and mines don't.
        if (res[i] !== R_NONE && res[i] !== R_TREE) return false;
        if (!reached && reaches.every((r) => r[i] === 1)) reached = true;
      }
    }
    if (!reached) return false;
    // Level enough for the stalls.
    let lo = Infinity;
    let hi = -Infinity;
    for (let dy = -TRADE.plaza; dy <= TRADE.plaza + 1; dy++) {
      for (let dx = -TRADE.plaza; dx <= TRADE.plaza + 1; dx++) {
        const v = height[(y + dy) * (w + 1) + x + dx];
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    return hi - lo <= 1.1;
  };
  // On a sea map the posts stand on the shore, so ships can call there: open water a few tiles off.
  const harbor = (x: number, y: number) => {
    const r = TRADE.sea.reach - 1;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h || dx * dx + dy * dy > r * r) continue;
        if (terrain[yy * w + xx] === T_WATER) return true;
      }
    }
    return false;
  };
  const out: { x: number; y: number }[] = [];
  const want = TRADE.posts[size];
  // Looser and looser: a wider band along the edge, less even distances, then cutting through woods.
  const passes: [number, number, boolean, boolean?][] = [...(shore ? ([[1, 0, false, true], [2, 3, false, true], [3, 9, true, true]] as [number, number, boolean, boolean][]) : []), [1, 0, false], [2, 3, false], [1, 0, true], [2, 3, true], [3, 9, true], [4, 99, true]];
  for (const [looser, wider, axes, coastal] of passes) {
    if (out.length >= want) break;
    const fair = TRADE.fair * looser;
    const edge = TRADE.edge + wider;
    if (axes && reaches === open) reaches = starts.map((st) => reachFrom(w, h, terrain, res, st, true));
    const candidates: number[] = [];
    for (let y = R + 1; y < h - R - 1; y++) {
      for (let x = R + 1; x < w - R - 1; x++) {
        const e = Math.min(x, y, w - 1 - x, h - 1 - y);
        if (e < 3 || (coastal ? !harbor(x, y) : e > edge)) continue;
        const ds = starts.map((st) => Math.sqrt((x + 0.5 - st.x) * (x + 0.5 - st.x) + (y + 0.5 - st.y) * (y + 0.5 - st.y))).sort((a, b) => a - b);
        if (ds[0] < TRADE.far * n || (ds.length > 1 && ds[1] - ds[0] > fair)) continue;
        if (relics.some((r) => (r.x - x - 0.5) * (r.x - x - 0.5) + (r.y - y - 0.5) * (r.y - y - 0.5) < 25)) continue;
        if (!site(x, y)) continue;
        candidates.push(y * w + x);
      }
    }
    const apart = TRADE.spacing * n;
    for (let guard = 0; out.length < want && candidates.length && guard < want * 60; guard++) {
      const i = candidates[Math.floor(rng() * candidates.length)];
      const x = i % w;
      const y = (i - x) / w;
      if (out.some((p) => (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) < apart * apart)) continue;
      out.push({ x, y });
    }
  }
  for (const p of out) {
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const i = (p.y + dy) * w + p.x + dx;
        if (res[i] === R_TREE) {
          res[i] = R_NONE;
          amount[i] = 0;
        }
      }
    }
  }
  return out.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
}

/**
 * Bog iron (#39), on some seeds and not others: the seed's own dice decide, then each town gets a
 * patch of the same size, the same distance out, turned the same way off the line to the middle of the
 * map, nearer that town than any other and walkable from it. If any town can't have one, no town
 * does: a world either holds bog iron for everyone or for nobody. It rolls its own dice and only puts
 * ore on empty ground, so the rest of the map is the same as it would be without it.
 */
function placeBogIron(
  seed: number,
  w: number,
  h: number,
  terrain: Uint8Array,
  res: Uint8Array,
  amount: Int32Array,
  starts: { x: number; y: number }[],
  deer: { x: number; y: number }[],
  relics: { x: number; y: number }[],
  posts: { x: number; y: number }[],
): boolean {
  const rng = mulberry32(seed ^ 0xb0619e);
  if (rng() >= BOG_IRON.chance) return false;
  const near = (list: { x: number; y: number }[], x: number, y: number, r: number) =>
    list.some((p) => (p.x - x - 0.5) * (p.x - x - 0.5) + (p.y - y - 0.5) * (p.y - y - 0.5) < r * r);
  // Open ground, clear of relics, trading posts and grazing deer.
  const free = (x: number, y: number) =>
    x >= 2 && y >= 2 && x < w - 2 && y < h - 2 && (terrain[y * w + x] === T_GRASS || terrain[y * w + x] === T_SAND) && res[y * w + x] === R_NONE &&
    !near(relics, x, y, 3) && !near(posts, x, y, TRADE.plaza + 4) && !near(deer, x, y, 1.5);
  const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // Room for a whole patch: enough open ground joined to the spot.
  const room = (x: number, y: number) => {
    const seen = [y * w + x];
    for (let q = 0; q < seen.length && seen.length < BOG_IRON.tiles; q++) {
      const i = seen[q];
      for (const [dx, dy] of STEPS) {
        const nx = (i % w) + dx;
        const ny = Math.floor(i / w) + dy;
        if (free(nx, ny) && !seen.includes(ny * w + nx)) seen.push(ny * w + nx);
      }
    }
    return seen.length >= BOG_IRON.tiles;
  };
  const reaches = starts.map((st) => reachFrom(w, h, terrain, res, st));
  const turn = rng() < 0.5 ? 1 : -1;
  const home = BOG_IRON.home;
  const centers: { x: number; y: number }[] = [];
  for (let k = 0; k < starts.length; k++) {
    const st = starts[k];
    const mx = w / 2 - st.x;
    const my = h / 2 - st.y;
    const ml = Math.sqrt(mx * mx + my * my) || 1;
    // Square to the line to the middle: off to one side of the town, not on the way to a rival.
    const tx = st.x + ((-turn * my) / ml) * home;
    const ty = st.y + ((turn * mx) / ml) * home;
    let best: { x: number; y: number } | null = null;
    for (let band = 2; band <= 8 && !best; band += 2) {
      let bestD = Infinity;
      const R = home + band;
      for (let y = Math.max(2, st.y - R); y <= Math.min(h - 3, st.y + R); y++) {
        for (let x = Math.max(2, st.x - R); x <= Math.min(w - 3, st.x + R); x++) {
          if (!free(x, y) || reaches[k][y * w + x] !== 1 || !room(x, y)) continue;
          const ds = starts.map((o) => Math.sqrt((x + 0.5 - o.x) * (x + 0.5 - o.x) + (y + 0.5 - o.y) * (y + 0.5 - o.y)));
          if (Math.abs(ds[k] - home) > band || ds.some((d, j) => j !== k && d <= ds[k] + 4)) continue;
          const d = (x + 0.5 - tx) * (x + 0.5 - tx) + (y + 0.5 - ty) * (y + 0.5 - ty);
          if (d < bestD) {
            bestD = d;
            best = { x, y };
          }
        }
      }
    }
    if (!best) return false;
    centers.push(best);
  }
  // Grow every patch to the same size where there is room, a tile at a time beside one already laid.
  const patches = centers.map((): { x: number; y: number }[] => []);
  const lay = (tiles: { x: number; y: number }[], x: number, y: number) => {
    res[y * w + x] = R_BOG;
    amount[y * w + x] = AMOUNT.bog;
    tiles.push({ x, y });
  };
  centers.forEach((c, k) => lay(patches[k], c.x, c.y));
  for (let n = 1; n < BOG_IRON.tiles; n++) {
    for (const tiles of patches) {
      let laid = false;
      for (let guard = 0; guard < 40 && !laid; guard++) {
        const b = tiles[Math.floor(rng() * tiles.length)];
        const [dx, dy] = STEPS[Math.floor(rng() * 4)];
        if (!free(b.x + dx, b.y + dy)) continue;
        lay(tiles, b.x + dx, b.y + dy);
        laid = true;
      }
      // Cramped: the first open tile beside the patch, in order (the room check promised one).
      for (let t = 0; t < tiles.length && !laid; t++) {
        for (const [dx, dy] of STEPS) {
          if (!free(tiles[t].x + dx, tiles[t].y + dy)) continue;
          lay(tiles, tiles[t].x + dx, tiles[t].y + dy);
          laid = true;
          break;
        }
      }
    }
  }
  return true;
}

const RARE_TILE: Record<RareId, number> = { salt: R_SALT, saltpetre: R_SALTPETRE, bloodiron: R_BLOODIRON };

/**
 * Deep veins (#356): for each rare ore the seed's own dice say whether this world holds it at all, then its veins are
 * laid out between the towns, on open ground every town can walk to, clear of every town, of what else lies on the map
 * and of each other. They roll their own dice (a seed per ore) and only mark empty ground, so the rest of the map is the
 * same as it would be without them. A vein that finds no room is left out: a world never promises a vein it cannot show.
 */
function placeRares(
  seed: number,
  w: number,
  h: number,
  terrain: Uint8Array,
  res: Uint8Array,
  amount: Int32Array,
  starts: { x: number; y: number }[],
  keepOff: { x: number; y: number }[],
): RareId[] {
  const reaches = starts.map((st) => reachFrom(w, h, terrain, res, st));
  const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const found: RareId[] = [];
  const laid: { x: number; y: number }[] = [];
  const far = (list: { x: number; y: number }[], x: number, y: number, r: number) =>
    list.every((p) => (p.x - x - 0.5) * (p.x - x - 0.5) + (p.y - y - 0.5) * (p.y - y - 0.5) >= r * r);
  const free = (x: number, y: number) =>
    x >= 2 && y >= 2 && x < w - 2 && y < h - 2 && (terrain[y * w + x] === T_GRASS || terrain[y * w + x] === T_SAND) && res[y * w + x] === R_NONE && far(keepOff, x, y, 3);
  RARES_ORDER.forEach((id, n) => {
    const rng = mulberry32(seed ^ (0x7a4e5 + n * 0x9e37));
    if (rng() >= RARE[id].chance) return;
    const cfg = RARE[id];
    let made = 0;
    for (let guard = 0; guard < 300 && made < cfg.veins; guard++) {
      const x = 2 + Math.floor(rng() * (w - 4));
      const y = 2 + Math.floor(rng() * (h - 4));
      if (!free(x, y) || reaches.some((r) => r[y * w + x] !== 1)) continue;
      if (!far(starts, x, y, cfg.away) || !far(laid, x, y, cfg.apart)) continue;
      const tiles = [{ x, y }];
      for (let g = 0; g < 60 && tiles.length < cfg.tiles; g++) {
        const b = tiles[Math.floor(rng() * tiles.length)];
        const [dx, dy] = STEPS[Math.floor(rng() * 4)];
        if (free(b.x + dx, b.y + dy) && !tiles.some((t) => t.x === b.x + dx && t.y === b.y + dy)) tiles.push({ x: b.x + dx, y: b.y + dy });
      }
      for (const t of tiles) {
        res[t.y * w + t.x] = RARE_TILE[id];
        amount[t.y * w + t.x] = cfg.amount;
      }
      laid.push({ x, y });
      made++;
    }
    if (made > 0) found.push(id);
  });
  return found;
}
const RARES_ORDER: RareId[] = ['salt', 'saltpetre', 'bloodiron'];

/**
 * Caves (#356): see `CAVE`. They roll their own dice and mark empty open ground, as the veins do. The ore of each is dealt
 * from the world's ores in turn from a seeded start, so two caves never hold the same ore while another is unshown. A den
 * cave's wolves are added to `wild` on the open tiles beside it.
 */
function placeCaves(
  seed: number,
  size: MapSize,
  w: number,
  h: number,
  terrain: Uint8Array,
  res: Uint8Array,
  amount: Int32Array,
  starts: { x: number; y: number }[],
  rares: RareId[],
  wild: { kind: 'mammoth' | 'wolf' | 'boar'; x: number; y: number }[],
): Cave[] {
  const rng = mulberry32(seed ^ 0xca7e5);
  const reaches = starts.map((st) => reachFrom(w, h, terrain, res, st));
  const open = (x: number, y: number) =>
    x >= 2 && y >= 2 && x < w - 2 && y < h - 2 && (terrain[y * w + x] === T_GRASS || terrain[y * w + x] === T_SAND) && res[y * w + x] === R_NONE;
  const far = (list: { x: number; y: number }[], x: number, y: number, r: number) =>
    list.every((p) => (p.x - x - 0.5) * (p.x - x - 0.5) + (p.y - y - 0.5) * (p.y - y - 0.5) >= r * r);
  const out: Cave[] = [];
  const at: { x: number; y: number }[] = [];
  const first = Math.floor(rng() * rares.length);
  for (let guard = 0; guard < 400 && out.length < CAVE.count[size]; guard++) {
    const x = 2 + Math.floor(rng() * (w - 4));
    const y = 2 + Math.floor(rng() * (h - 4));
    if (!open(x, y) || reaches.some((r) => r[y * w + x] !== 1)) continue;
    if (!far(starts, x, y, CAVE.away) || !far(at, x, y, CAVE.apart)) continue;
    // Anything else already on the map keeps its distance: no ore, tree or beast within 2 tiles.
    let crowded = false;
    for (let dy = -2; dy <= 2 && !crowded; dy++) for (let dx = -2; dx <= 2; dx++) if (res[(y + dy) * w + x + dx] !== R_NONE) crowded = true;
    if (crowded || wild.some((b) => (b.x - x - 0.5) * (b.x - x - 0.5) + (b.y - y - 0.5) * (b.y - y - 0.5) < 36)) continue;
    const ore = rares[(first + out.length) % rares.length];
    const den = rng() < CAVE.den;
    res[y * w + x] = RARE_TILE[ore];
    amount[y * w + x] = RARE[ore].amount * CAVE.rich;
    at.push({ x, y });
    out.push({ tile: y * w + x, ore, den });
    if (den) for (let k = 0; k < WOLF.pack; k++) wild.push({ kind: 'wolf', x: x + 0.5 + (k - 1) * 0.8, y: y + 1.6 + (k === 1 ? 0.5 : 0) });
  }
  return out;
}

/**
 * Ancient ruins (#64), fairly: out between the towns, each about as far from its two nearest towns,
 * well away from every town, from relics, trading posts and each other, on open ground every town can
 * walk to. What lies under each is dealt from a shuffled hand of the four finds, so a small map's two
 * ruins never hold the same thing. They roll their own dice and touch nothing, so the rest of the map
 * is the same as it would be without them.
 */
function placeRuins(
  seed: number,
  size: MapSize,
  w: number,
  h: number,
  terrain: Uint8Array,
  res: Uint8Array,
  starts: { x: number; y: number }[],
  deer: { x: number; y: number }[],
  relics: { x: number; y: number }[],
  posts: { x: number; y: number }[],
): { x: number; y: number; find: RuinFind }[] {
  const rng = mulberry32(seed ^ 0x5a1e0b);
  const land = (x: number, y: number) => x >= 2 && y >= 2 && x < w - 2 && y < h - 2 && (terrain[y * w + x] === T_GRASS || terrain[y * w + x] === T_SAND);
  const near = (list: { x: number; y: number }[], x: number, y: number, r: number) =>
    list.some((p) => (p.x - x - 0.5) * (p.x - x - 0.5) + (p.y - y - 0.5) * (p.y - y - 0.5) < r * r);
  const open = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!land(x + dx, y + dy) || res[(y + dy) * w + x + dx] !== R_NONE) return false;
    return true;
  };
  const reaches = starts.map((st) => reachFrom(w, h, terrain, res, st));
  const out: { x: number; y: number }[] = [];
  const want = RUINS.count[size];
  // Looser and looser: less even distances, then only the ruin's own tile and its neighbours clear.
  for (let pass = 0; pass < 4 && out.length < want; pass++) {
    const fair = RUINS.fair * (1 + pass);
    const room = pass < 2 ? 2 : 1;
    const candidates: number[] = [];
    for (let y = 3; y < h - 3; y++) {
      for (let x = 3; x < w - 3; x++) {
        if (!open(x, y, room) || reaches.some((r) => r[y * w + x] !== 1)) continue;
        const ds = starts.map((st) => Math.sqrt((x + 0.5 - st.x) * (x + 0.5 - st.x) + (y + 0.5 - st.y) * (y + 0.5 - st.y))).sort((a, b) => a - b);
        if (ds[0] < RUINS.home || (ds.length > 1 && ds[1] - ds[0] > fair)) continue;
        if (near(relics, x, y, 4) || near(posts, x, y, TRADE.plaza + 4) || near(deer, x, y, 2)) continue;
        candidates.push(y * w + x);
      }
    }
    for (let guard = 0; out.length < want && candidates.length && guard < want * 60; guard++) {
      const i = candidates[Math.floor(rng() * candidates.length)];
      const x = i % w;
      const y = (i - x) / w;
      if (out.some((p) => (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) < RUINS.spacing * RUINS.spacing)) continue;
      out.push({ x, y });
    }
  }
  // Deal the finds: a fresh shuffled hand of all four for every four ruins.
  const finds: RuinFind[] = [];
  while (finds.length < out.length) {
    const hand: RuinFind[] = ['hoard', 'lore', 'map', 'relic'];
    for (let i = hand.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [hand[i], hand[j]] = [hand[j], hand[i]];
    }
    finds.push(...hand);
  }
  return out.map((p, k) => ({ x: p.x + 0.5, y: p.y + 0.5, find: finds[k] }));
}

/**
 * The wild (#171). A mammoth for every town, the same distance out (`MAMMOTH.home`) in a direction of its
 * own, and a few more out in the open; then wolf dens, each about as far from its two nearest towns,
 * beside a patch of the wild gold where there is one. Everything stands on open ground every town can
 * walk to. They roll their own dice and touch no tile, so the rest of the map is as it was.
 */
function placeWild(
  seed: number,
  size: MapSize,
  w: number,
  h: number,
  terrain: Uint8Array,
  res: Uint8Array,
  starts: { x: number; y: number }[],
  deer: { x: number; y: number }[],
  relics: { x: number; y: number }[],
  posts: { x: number; y: number }[],
  ruins: { x: number; y: number }[],
): { kind: 'mammoth' | 'wolf' | 'boar'; x: number; y: number }[] {
  const rng = mulberry32(seed ^ 0x3a7e0f);
  const land = (x: number, y: number) => x >= 2 && y >= 2 && x < w - 2 && y < h - 2 && (terrain[y * w + x] === T_GRASS || terrain[y * w + x] === T_SAND);
  const near = (list: { x: number; y: number }[], x: number, y: number, r: number) =>
    list.some((p) => (p.x - x - 0.5) * (p.x - x - 0.5) + (p.y - y - 0.5) * (p.y - y - 0.5) < r * r);
  const open = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!land(x + dx, y + dy) || res[(y + dy) * w + x + dx] !== R_NONE) return false;
    return true;
  };
  const reaches = starts.map((st) => reachFrom(w, h, terrain, res, st));
  const dists = (x: number, y: number) => starts.map((st) => Math.sqrt((x + 0.5 - st.x) * (x + 0.5 - st.x) + (y + 0.5 - st.y) * (y + 0.5 - st.y)));
  const clear = (x: number, y: number) =>
    open(x, y, 1) && reaches.every((r) => r[y * w + x] === 1) && !near(relics, x, y, 4) && !near(posts, x, y, TRADE.plaza + 4) && !near(ruins, x, y, 5) && !near(deer, x, y, 3);
  const out: { kind: 'mammoth' | 'wolf' | 'boar'; x: number; y: number }[] = [];
  const pick = (list: number[]): number => list[Math.floor(rng() * list.length)];

  // A mammoth for every town: on a ring `home` tiles out, nearer that town than any other.
  for (let k = 0; k < starts.length; k++) {
    const st = starts[k];
    const ring: number[] = [];
    const R = MAMMOTH.home;
    for (let y = st.y - R - 2; y <= st.y + R + 2; y++) {
      for (let x = st.x - R - 2; x <= st.x + R + 2; x++) {
        if (!land(x, y)) continue;
        const ds = dists(x, y);
        if (ds[k] < R - 1 || ds[k] > R + 1.5 || ds.some((d, j) => j !== k && d < ds[k] + 4)) continue;
        if (!clear(x, y) || near(out, x, y, 6)) continue;
        ring.push(y * w + x);
      }
    }
    if (!ring.length) continue;
    const i = pick(ring);
    out.push({ kind: 'mammoth', x: (i % w) + 0.5, y: Math.floor(i / w) + 0.5 });
  }

  // A boar on guard by a berry patch, a way out from each town (more in the open on bigger maps).
  const patchNear = (x: number, y: number) => {
    for (let dy = -BOAR.near; dy <= BOAR.near; dy++) for (let dx = -BOAR.near; dx <= BOAR.near; dx++) if (res[(y + dy) * w + x + dx] === R_BERRY) return true;
    return false;
  };
  const boarSpots = (k: number | null): number[] => {
    const list: number[] = [];
    for (let y = 3; y < h - 3; y++) {
      for (let x = 3; x < w - 3; x++) {
        if (!land(x, y) || !patchNear(x, y)) continue;
        const ds = dists(x, y);
        const m = ds.indexOf(Math.min(...ds));
        if (k !== null ? m !== k || ds[k] < BOAR.min || ds[k] > BOAR.max : ds[m] < BOAR.max + 2) continue;
        if (!clear(x, y) || near(out, x, y, 5)) continue;
        list.push(y * w + x);
      }
    }
    return list;
  };
  for (let k = 0; k < starts.length; k++) {
    for (let n = 0; n < BOAR.count; n++) {
      const list = boarSpots(k);
      if (!list.length) break;
      const i = pick(list);
      out.push({ kind: 'boar', x: (i % w) + 0.5, y: Math.floor(i / w) + 0.5 });
    }
  }
  for (let n = 0; n < BOAR.extra[size]; n++) {
    const list = boarSpots(null);
    if (!list.length) break;
    const i = pick(list);
    out.push({ kind: 'boar', x: (i % w) + 0.5, y: Math.floor(i / w) + 0.5 });
  }

  // Open ground out between the towns, about as far from the two nearest.
  const between = (home: number, fair: number): number[] => {
    const list: number[] = [];
    for (let y = 3; y < h - 3; y++) {
      for (let x = 3; x < w - 3; x++) {
        if (!land(x, y)) continue;
        const ds = dists(x, y).sort((a, b) => a - b);
        if (ds[0] < home || (ds.length > 1 && ds[1] - ds[0] > fair)) continue;
        if (!clear(x, y)) continue;
        list.push(y * w + x);
      }
    }
    return list;
  };

  // More mammoths in the open.
  const wide = between(MAMMOTH.home + 5, 8);
  for (let n = 0, guard = 0; n < MAMMOTH.extra[size] && wide.length && guard < 200; guard++) {
    const i = pick(wide);
    const x = i % w;
    const y = (i - x) / w;
    if (near(out, x, y, 12)) continue;
    out.push({ kind: 'mammoth', x: x + 0.5, y: y + 0.5 });
    n++;
  }

  // Wolf dens, by wild gold where some lies near enough.
  const spots = between(WOLF.home, WOLF.fair);
  const byGold = spots.filter((i) => {
    const x = i % w;
    const y = (i - x) / w;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (res[(y + dy) * w + x + dx] === R_GOLD) return true;
    return false;
  });
  const dens: { x: number; y: number }[] = [];
  for (const list of [byGold, spots]) {
    for (let guard = 0; dens.length < WOLF.dens[size] && list.length && guard < 300; guard++) {
      const i = pick(list);
      const x = i % w;
      const y = (i - x) / w;
      if (near(dens, x, y, WOLF.spacing) || near(out, x, y, 8)) continue;
      dens.push({ x: x + 0.5, y: y + 0.5 });
    }
  }
  for (const d of dens) {
    for (let k = 0; k < WOLF.pack; k++) out.push({ kind: 'wolf', x: d.x + (k - 1) * 0.6, y: d.y + (k === 1 ? 0.5 : 0) });
  }
  return out;
}

/**
 * Contested landmarks, fairly: one more than there are towns (so two rivals can't each take one and never
 * meet), out between the towns, each about as far from its two nearest, clear of everything else placed
 * out there, on open ground every town can walk to. Kinds are dealt from shuffled hands of all three.
 * They roll their own dice and touch no tile, so the rest of the map is as it was.
 */
function placeLandmarks(
  seed: number,
  w: number,
  h: number,
  terrain: Uint8Array,
  res: Uint8Array,
  starts: { x: number; y: number }[],
  deer: { x: number; y: number }[],
  relics: { x: number; y: number }[],
  posts: { x: number; y: number }[],
  ruins: { x: number; y: number }[],
  wild: { kind: string; x: number; y: number }[],
): { x: number; y: number; kind: LandmarkKind }[] {
  const rng = mulberry32(seed ^ 0x1a4d3a);
  const land = (x: number, y: number) => x >= 2 && y >= 2 && x < w - 2 && y < h - 2 && (terrain[y * w + x] === T_GRASS || terrain[y * w + x] === T_SAND);
  const near = (list: { x: number; y: number }[], x: number, y: number, r: number) =>
    list.some((p) => (p.x - x - 0.5) * (p.x - x - 0.5) + (p.y - y - 0.5) * (p.y - y - 0.5) < r * r);
  const open = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!land(x + dx, y + dy) || res[(y + dy) * w + x + dx] !== R_NONE) return false;
    return true;
  };
  const reaches = starts.map((st) => reachFrom(w, h, terrain, res, st));
  const wolves = wild.filter((b) => b.kind === 'wolf');
  const beasts = wild.filter((b) => b.kind !== 'wolf');
  const out: { x: number; y: number }[] = [];
  const want = Math.min(LANDMARKS.max, starts.length + 1);
  const nearest = new Map<number, number>();
  // Looser and looser: less even distances, then only the landmark's own tile and its neighbours clear.
  for (let pass = 0; pass < 4 && out.length < want; pass++) {
    const fair = LANDMARKS.fair * (1 + pass);
    const room = pass < 2 ? 2 : 1;
    const candidates: number[] = [];
    for (let y = 3; y < h - 3; y++) {
      for (let x = 3; x < w - 3; x++) {
        if (!open(x, y, room) || reaches.some((r) => r[y * w + x] !== 1)) continue;
        const ds = starts.map((st) => Math.sqrt((x + 0.5 - st.x) * (x + 0.5 - st.x) + (y + 0.5 - st.y) * (y + 0.5 - st.y))).sort((a, b) => a - b);
        if (ds[0] < LANDMARKS.home || (pass < 3 && ds[0] > LANDMARKS.far + pass * 6) || (ds.length > 1 && ds[1] - ds[0] > fair)) continue;
        if (near(relics, x, y, 5) || near(posts, x, y, TRADE.plaza + 6) || near(ruins, x, y, 8) || near(wolves, x, y, 10) || near(beasts, x, y, 4) || near(deer, x, y, 3)) continue;
        candidates.push(y * w + x);
        nearest.set(y * w + x, ds[0]);
      }
    }
    // The nearer a spot to the towns (on the fair line between them), the likelier: not out in a far corner.
    candidates.sort((a, b) => nearest.get(a)! - nearest.get(b)! || a - b);
    const pool = candidates.slice(0, Math.max(12, Math.ceil(candidates.length / 3)));
    for (let guard = 0; out.length < want && pool.length && guard < want * 60; guard++) {
      const i = pool[Math.floor(rng() * pool.length)];
      const x = i % w;
      const y = (i - x) / w;
      if (out.some((p) => (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) < LANDMARKS.spacing * LANDMARKS.spacing)) continue;
      out.push({ x, y });
    }
  }
  const kinds: LandmarkKind[] = [];
  // The grove stands where a flint scatter would, on half the hands (its own stream, so the draws above are as they were).
  const grng = mulberry32(seed ^ 0x6a07e5);
  while (kinds.length < out.length) {
    const hand: LandmarkKind[] = ['spring', 'crag', 'cairn', 'flint'];
    for (let i = hand.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [hand[i], hand[j]] = [hand[j], hand[i]];
    }
    if (grng() < 0.5) hand[hand.indexOf('flint')] = 'grove';
    // The ford takes a crag's place on a third of the hands (a later draw of the same stream).
    if (grng() < 0.34) hand[hand.indexOf('crag')] = 'ford';
    kinds.push(...hand);
  }
  return out.map((p, k) => ({ x: p.x + 0.5, y: p.y + 0.5, kind: kinds[k] }));
}
