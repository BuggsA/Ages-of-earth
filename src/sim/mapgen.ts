import { AMOUNT, MAP_SIZES } from './data';
import { fbm, mulberry32, type Rng } from './rng';
import type { MapSize } from './types';
import { B_RES, B_TERRAIN, R_BERRY, R_GOLD, R_NONE, R_STONE, R_TREE, T_GRASS, T_ROCK, T_SAND, T_WATER } from './types';

/**
 * World generation: rolling grassland with lakes, rocky ridges and woods, and two starting spots that
 * are flat, open and fair: each gets berries, a gold mine, a stone quarry and a wood line at the same
 * distances. Only integer hashing and arithmetic are used, so every browser builds the same world.
 */

export interface MapData {
  w: number;
  h: number;
  terrain: Uint8Array;
  height: Float32Array;
  res: Uint8Array;
  amount: Int32Array;
  block: Uint8Array;
  starts: { x: number; y: number }[];
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

export function generateMap(seed: number, size: MapSize, players = 2): MapData {
  const n = MAP_SIZES[size].n;
  const w = n;
  const h = n;
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const terrain = new Uint8Array(w * h);
  const res = new Uint8Array(w * h);
  const amount = new Int32Array(w * h);
  const salt = Math.floor(rng() * 100000);

  // Starting spots: across a diagonal or straight across, chosen by the seed.
  const layouts = [
    [[-0.31, -0.31], [0.31, 0.31]],
    [[-0.31, 0.31], [0.31, -0.31]],
    [[-0.36, 0], [0.36, 0]],
    [[0, -0.36], [0, 0.36]],
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
      // Starting spots are kept as open, middling ground.
      const keep = d < 12 ? 1 : d < 20 ? (20 - d) / 8 : 0;
      e = e * (1 - keep) + 0.5 * keep;
      elev[i] = e;
      if (e < 0.34) terrain[i] = T_WATER;
      else if (e > 0.6 && ridge > 0.6 && keep === 0) terrain[i] = T_ROCK;
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
            elev[i] = Math.max(elev[i], 0.36);
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
      if (water === count) hgt = -0.55 - (0.34 - Math.min(0.34, e)) * 6 - detail * 0.2;
      else if (water > 0) hgt = -0.06 + detail * 0.05;
      else {
        // Rolling ground: broad swells from the elevation, smaller hummocks on top.
        const swell = fbm(x / 11, y / 11, salt + 51, 2);
        hgt = 0.2 + (e - 0.34) * 4.6 + (swell - 0.5) * 0.9 + (detail - 0.5) * 0.4;
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
      if ((f > 0.6 || (f > 0.56 && fbm(x / 3, y / 3, salt + 13, 2) > 0.6)) && free(x, y, 10)) put(x, y, R_TREE);
      else if (fbm(x / 2, y / 2, salt + 17, 1) > 0.88 && free(x, y, 8)) put(x, y, R_TREE);
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

  // More to fight over in the open.
  const extra = (kind: number, count: number, tiles: number) => {
    for (let k = 0, guard = 0; k < count && guard < count * 40; guard++) {
      const x = 4 + Math.floor(rng() * (w - 8));
      const y = 4 + Math.floor(rng() * (h - 8));
      if (startDist(x, y) < 16 || !free(x, y, 16)) continue;
      if (cluster(x, y, kind, tiles, 16) > 0) k++;
    }
  };
  extra(R_GOLD, Math.round(n / 22), 4);
  extra(R_STONE, Math.round(n / 28), 4);
  extra(R_BERRY, Math.round(n / 26), 6);

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

  // Resources nobody could stand next to are cleared away.
  const block = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (terrain[i] === T_WATER || terrain[i] === T_ROCK) block[i] |= B_TERRAIN;
    if (res[i] !== R_NONE) block[i] |= B_RES;
  }

  return { w, h, terrain, height, res, amount, block, starts };
}
