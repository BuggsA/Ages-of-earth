import { AGES, BREACH, DYKE, INUND, POLDER, RIVERS, domainOf, secs } from './data';
import { ageDef, ageOf, asleep } from './ages';
import { landOwnerAt } from './borders';
import { nearestWalkable, stampBuilding } from './grid';
import type { Building, GameState, Player } from './types';
import { B_RES, B_TERRAIN, R_FISH, R_NONE, T_GRASS, T_ROCK, T_SAND, T_WATER } from './types';

/**
 * The water layer (#701, the Water Road). The map's water was fixed at the start of a match until the Age of Dykes: a people raises
 * dykes across the shallows (a bank its own people walk along and nobody else passes, `stampBuilding`), and windmills behind them pump
 * the water out, a tile at a time, nearest first, into polder: land where the sea was (`T_GRASS`, marked in `GameState.polder`), its
 * corners raised just over the water line so the renderer shows the water stepping back. Water flows four ways only, so a dyke line
 * that steps diagonally still holds. A mill pumps only a small basin (a lake, or a bay a dyke has shut off): water that reaches a map
 * edge, or more than `POLDER.most` tiles of it, is the open sea. Drained land is everyone's: a strait drained is a land bridge.
 * The numbers are `DYKE` and `POLDER`. A dyke that falls lets the sea back in (`floodStep`, #701 s3, `BREACH`); sluices and canals are
 * the road's later steps.
 */

/** Whether this tile was dug out into a channel (the Age of Rivers): water a land unit wades and no ship sails. */
export const isChannel = (s: GameState, tile: number): boolean => !!s.channel && s.channel[tile] === 1;

/** Whether a spring head (#701 s1) lies on this tile: a channel dug beside it fills from it. */
export const isSpring = (s: GameState, tile: number): boolean => !!s.springs && s.springs.includes(tile);

/** Whether water lies here, or a spring head that will give it: what a ditch fills from, and what waters a field. */
const source = (s: GameState, tile: number): boolean => s.terrain[tile] === T_WATER || isSpring(s, tile);

/** Whether an open sluice has let the water over this tile of low ground (#701 s4, the Water Line): water a land unit wades and a boat sails. */
export const isInund = (s: GameState, tile: number): boolean => !!s.inund && s.inund[tile] !== 0;

/** Whether this tile was pumped out into polder. */
export const isPolder = (s: GameState, tile: number): boolean => !!s.polder && s.polder[tile] === 1;

/** Whether a water tile is shallow enough to raise a dyke in: every corner at `DYKE.depth` or higher. */
export function shallow(s: GameState, tile: number): boolean {
  if (s.terrain[tile] !== T_WATER) return false;
  const x = tile % s.w;
  const y = (tile - x) / s.w;
  const W = s.w + 1;
  const h = s.height;
  const i = y * W + x;
  return h[i] >= DYKE.depth && h[i + 1] >= DYKE.depth && h[i + W] >= DYKE.depth && h[i + W + 1] >= DYKE.depth;
}

/** Why a dyke can't stand on this tile, as the land sees it: deep water, or dry land with no water beside it. Null where it can. */
export function dykeSpot(s: GameState, tx: number, ty: number): 'deep' | 'dry' | null {
  const i = ty * s.w + tx;
  if (s.terrain[i] === T_WATER) return shallow(s, i) ? null : 'deep';
  if (s.terrain[i] === T_ROCK) return null;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if ((dx || dy) && x >= 0 && y >= 0 && x < s.w && y < s.h && s.terrain[y * s.w + x] === T_WATER) return null;
    }
  return 'dry';
}

/** Shallow water tiles within `DYKE.home` of where a people began: what its coast door counts. */
export function shallowsNear(s: GameState, p: Player): number {
  const cx = Math.floor(p.startX);
  const cy = Math.floor(p.startY);
  const r = DYKE.home;
  let n = 0;
  for (let y = Math.max(0, cy - r); y <= Math.min(s.h - 1, cy + r); y++)
    for (let x = Math.max(0, cx - r); x <= Math.min(s.w - 1, cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r && shallow(s, y * s.w + x)) n++;
    }
  return n;
}

/** Whether a people's coast opens the Age of Dykes: enough shallows by its town. */
export const coastHeld = (s: GameState, p: Player): boolean => shallowsNear(s, p) >= DYKE.need;

/** Water that flows: open water with no dyke (or any building) on it. A sluice's flood is not: it comes and goes with the sluice. */
const wet = (s: GameState, i: number): boolean => s.terrain[i] === T_WATER && s.bldAt[i] === 0 && !isInund(s, i);
/** What a mill's pull passes through: water, and the polder it has already won (not while a sluice has it under water). */
const pull = (s: GameState, i: number): boolean => wet(s, i) || (isPolder(s, i) && s.bldAt[i] === 0 && !isInund(s, i));

const FOUR = [1, 0, -1, 0, 0, 1, 0, -1];

/**
 * The water a windmill pumps: the water within `POLDER.reach` of its footprint, reached through water and polder four ways, in the
 * order it is reached (nearest first). Each body it touches is judged on its own, in tile order: the first that is a basin (no map
 * edge, at most `POLDER.most` water tiles) and still holds water is the one. Empty when there is none: the open sea, or all dry.
 */
export function basinOf(s: GameState, b: { tx: number; ty: number; size: number }): number[] {
  const { w, h } = s;
  const r = POLDER.reach;
  const seen = new Set<number>();
  for (let y = Math.max(0, b.ty - r); y < Math.min(h, b.ty + b.size + r); y++)
    for (let x = Math.max(0, b.tx - r); x < Math.min(w, b.tx + b.size + r); x++) {
      const start = y * w + x;
      if (seen.has(start) || !pull(s, start)) continue;
      const order: number[] = [start];
      seen.add(start);
      let water = 0;
      let open = false;
      for (let k = 0; k < order.length && !open; k++) {
        const t = order[k];
        const tx = t % w;
        const ty = (t - tx) / w;
        if (s.terrain[t] === T_WATER) {
          water++;
          if (tx === 0 || ty === 0 || tx === w - 1 || ty === h - 1 || water > POLDER.most) open = true;
        }
        for (let d = 0; d < 8; d += 2) {
          const nx = tx + FOUR[d];
          const ny = ty + FOUR[d + 1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (seen.has(n) || !pull(s, n)) continue;
          seen.add(n);
          order.push(n);
        }
      }
      if (open || water === 0) continue;
      return order.filter((t) => s.terrain[t] === T_WATER);
    }
  return [];
}

/**
 * Whether a windmill works now: finished, standing, and its people in the Age of Dykes, or it is the mill the people kept when it left
 * (the age's keepsake, #555 s11). Any other mill sleeps outside the age (`asleep`).
 */
export function pumps(s: GameState, b: Building): boolean {
  return b.type === 'windmill' && b.built && b.hp > 0 && (!!ageDef(s.players[b.owner]).pumps || b.keep === 'dykes') && !asleep(s, b);
}

/** Why a finished windmill stands still, or null while it pumps. */
export function millIdle(s: GameState, b: Building): string | null {
  if (!ageDef(s.players[b.owner]).pumps && b.keep !== 'dykes') return 'Windmills pump only in the Age of Dykes, or the one your people kept on leaving it';
  if (!basinOf(s, b).length) return 'No water to pump here: raise it by a lake, or by a bay your dykes have shut off from the open sea';
  return null;
}

/** Pump one tile dry: it becomes polder, land for anyone, its fish lost and its corners raised over the water line. */
export function drain(s: GameState, tile: number, owner: number, mill: number): void {
  const { w } = s;
  s.terrain[tile] = T_GRASS;
  (s.polder ??= new Uint8Array(w * s.h))[tile] = 1;
  if (s.inund) s.inund[tile] = 0;
  // A channel pumped out is land again, walked at full pace.
  if (s.channel) s.channel[tile] = 0;
  if (s.res[tile] === R_FISH) {
    s.res[tile] = R_NONE;
    s.amount[tile] = 0;
    s.block[tile] &= ~B_RES;
  }
  s.block[tile] &= ~B_TERRAIN;
  const x = tile % w;
  const y = (tile - x) / w;
  const W = w + 1;
  for (const c of [y * W + x, y * W + x + 1, (y + 1) * W + x, (y + 1) * W + x + 1]) if (s.height[c] < POLDER.ground) s.height[c] = POLDER.ground;
  s.blockVersion++;
  const p = s.players[owner];
  p.stats.drained = (p.stats.drained ?? 0) + 1;
  s.events.push({ k: 'drained', owner, mill, tile, x: x + 0.5, y: y + 0.5 });
}

/**
 * Every `POLDER.every` seconds each working windmill (in id order, each on its own beat) pumps the nearest tile of its basin dry,
 * passing over one a boat floats on: a boat is never left aground.
 */
export function pumpStep(s: GameState): void {
  if (s.tick % 5 !== 0) return;
  const period = secs(POLDER.every);
  let afloat: Set<number> | null = null;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'windmill' || (s.tick + e.id * 5) % period !== 0 || !pumps(s, e)) continue;
    const basin = basinOf(s, e);
    if (!basin.length) continue;
    if (!afloat) {
      afloat = new Set();
      for (const u of s.ents) if (u.kind === 'unit' && u.hp > 0 && domainOf(u.type) === 'water') afloat.add(Math.floor(u.y) * s.w + Math.floor(u.x));
    }
    const tile = basin.find((t) => !afloat!.has(t));
    if (tile === undefined) continue;
    drain(s, tile, e.owner, e.id);
    e.pumped = s.tick;
  }
}

// ---- The breach (#701 s3): the sea taking back the polder ----------

/**
 * Whether a finished, standing dyke holds this tile: the only thing that keeps the sea out (a dyke site does not). A sluice (#701 s4)
 * holds it too, open or shut, from the moment it is laid out: it is built behind a cofferdam, and open, it lets out only the shallow
 * flood of the Water Line (`sluiceStep`), never the sea.
 */
function banked(s: GameState, i: number): boolean {
  const id = s.bldAt[i];
  if (id === 0) return false;
  const b = s.byId.get(id);
  return !!b && b.kind === 'building' && ((b.type === 'dyke' && b.built) || b.type === 'sluice') && b.hp > 0;
}

/** Water that runs on: water with no finished dyke on it (a sluice's flood is not the sea's). */
const runs = (s: GameState, i: number): boolean => s.terrain[i] === T_WATER && !banked(s, i) && !isInund(s, i);

/**
 * Whether the water on this tile is the open sea, as a mill judges it (`basinOf`): its body (four ways, through water no finished dyke
 * holds) touches a map edge or passes `POLDER.most` tiles. `known` keeps what each body was found to be, so a step asks each once.
 */
export function seaAt(s: GameState, start: number, known: Map<number, boolean> = new Map()): boolean {
  const k = known.get(start);
  if (k !== undefined) return k;
  const { w, h } = s;
  const out = [start];
  const seen = new Set(out);
  let open = false;
  for (let q = 0; q < out.length && !open; q++) {
    const t = out[q];
    if (known.get(t)) {
      open = true;
      break;
    }
    const tx = t % w;
    const ty = (t - tx) / w;
    if (tx === 0 || ty === 0 || tx === w - 1 || ty === h - 1 || out.length > POLDER.most) {
      open = true;
      break;
    }
    for (let d = 0; d < 8; d += 2) {
      const n = (ty + FOUR[d + 1]) * w + tx + FOUR[d];
      if (seen.has(n) || !runs(s, n)) continue;
      seen.add(n);
      out.push(n);
    }
  }
  // Closed, `out` is the whole body; open, every tile of it is the sea's too.
  for (const t of out) known.set(t, open);
  return open;
}

/** The polder tiles the sea reaches this step: polder no finished dyke stands on, four-ways beside open sea, in tile order. */
export function floodFront(s: GameState, known: Map<number, boolean> = new Map()): number[] {
  const out: number[] = [];
  if (!s.polder) return out;
  const { w, h } = s;
  for (let i = 0; i < w * h; i++) {
    if (s.polder[i] !== 1 || banked(s, i)) continue;
    const x = i % w;
    const y = (i - x) / w;
    for (let d = 0; d < 8; d += 2) {
      const nx = x + FOUR[d];
      const ny = y + FOUR[d + 1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (runs(s, n) && seaAt(s, n, known)) {
        out.push(i);
        break;
      }
    }
  }
  return out;
}

/**
 * The sea takes back a tile of polder (the inverse of `drain`): sea again, sailed and not walked, its corners sunk to `BREACH.bank` (to
 * `BREACH.bed` where water lies all round), and whatever stands on it drowned. Returns how many buildings it drowned.
 */
export function flood(s: GameState, tile: number): number {
  const { w, h } = s;
  s.terrain[tile] = T_WATER;
  s.polder![tile] = 0;
  // The sea over a sluice's flood: deep water now, not the Water Line's.
  if (s.inund) s.inund[tile] = 0;
  s.block[tile] |= B_TERRAIN;
  const x = tile % w;
  const y = (tile - x) / w;
  const W = w + 1;
  for (let cy = y; cy <= y + 1; cy++)
    for (let cx = x; cx <= x + 1; cx++) {
      let all = true;
      for (let ty = cy - 1; ty <= cy && all; ty++) for (let tx = cx - 1; tx <= cx; tx++) if (tx < 0 || ty < 0 || tx >= w || ty >= h || s.terrain[ty * w + tx] !== T_WATER) all = false;
      const c = cy * W + cx;
      const to = all ? BREACH.bed : BREACH.bank;
      if (s.height[c] > to) s.height[c] = to;
    }
  let drowned = 0;
  const b = s.byId.get(s.bldAt[tile]);
  if (b && b.kind === 'building' && b.hp > 0) {
    b.hp = 0;
    drowned++;
  }
  s.blockVersion++;
  s.flooded = (s.flooded ?? 0) + 1;
  s.events.push({ k: 'flooded', owner: landOwnerAt(s, x + 0.5, y + 0.5), tile, x: x + 0.5, y: y + 0.5, drowned });
  return drowned;
}

/**
 * Every `BREACH.every` seconds the sea runs one tile on (#701 s3): each tile of polder four-ways beside open sea (a dyke breached, cut
 * or never finished; a channel dug in from the sea) floods, all at once, in tile order. Those standing there are swept to the nearest dry
 * ground, hurt, or drowned where there is none within `BREACH.sweep` tiles. Once a finished dyke shuts the gap, the flood stops where it
 * is, and a windmill can pump the water out again.
 */
export function floodStep(s: GameState): void {
  if (!s.polder || s.tick % secs(BREACH.every) !== 0) return;
  const front = floodFront(s);
  if (!front.length) return;
  const wet = new Set(front);
  for (const t of front) flood(s, t);
  for (const u of s.ents) {
    if (u.kind !== 'unit' || u.hp <= 0 || u.inside || domainOf(u.type) !== 'land' || !wet.has(Math.floor(u.y) * s.w + Math.floor(u.x))) continue;
    const to = nearestWalkable(s, u.x, u.y, BREACH.sweep, s.players[u.owner]?.team ?? -1);
    if (to < 0) {
      u.hp = 0;
      continue;
    }
    u.x = (to % s.w) + 0.5;
    u.y = Math.floor(to / s.w) + 0.5;
    u.hp = Math.max(0, u.hp - BREACH.unit);
  }
}

/**
 * What a dyke holds back (#701 s3): the tiles of polder its fall would flood, now or as the water runs on. Zero for a dyke on land, one
 * with no open sea beside it, or one already breached round. Bounded: the dry side is searched to `4 × POLDER.most` tiles.
 */
export function heldBack(s: GameState, b: Building): number {
  const { w, h } = s;
  const t = b.ty * w + b.tx;
  if (b.type !== 'dyke' || s.terrain[t] !== T_WATER || !s.polder) return 0;
  const known = new Map<number, boolean>();
  const near: number[] = [];
  let sea = false;
  for (let d = 0; d < 8; d += 2) {
    const nx = b.tx + FOUR[d];
    const ny = b.ty + FOUR[d + 1];
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const n = ny * w + nx;
    if (runs(s, n) && seaAt(s, n, known)) sea = true;
    else if (runs(s, n) || (isPolder(s, n) && !banked(s, n))) near.push(n);
  }
  if (!sea || !near.length) return 0;
  // The dry side: polder and the still water among it, reached from beside the dyke without crossing it.
  const out = [...near];
  const seen = new Set<number>([t, ...near]);
  let n = 0;
  for (let q = 0; q < out.length && out.length <= 4 * POLDER.most; q++) {
    const c = out[q];
    if (isPolder(s, c)) n++;
    const cx = c % w;
    const cy = (c - cx) / w;
    for (let d = 0; d < 8; d += 2) {
      const nx = cx + FOUR[d];
      const ny = cy + FOUR[d + 1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const m = ny * w + nx;
      if (seen.has(m) || banked(s, m) || !(isPolder(s, m) || runs(s, m))) continue;
      // The open sea is not the dry side: a dyke already breached round holds nothing back.
      if (runs(s, m) && seaAt(s, m, known)) return 0;
      seen.add(m);
      out.push(m);
    }
  }
  return n;
}

/** Whether a Farm stands on polder: most of its footprint pumped out of the sea. It works `POLDER.farm` times as fast. */
export function polderField(s: GameState, b: Building): boolean {
  if (!s.polder) return false;
  let n = 0;
  for (let y = b.ty; y < b.ty + b.size; y++) for (let x = b.tx; x < b.tx + b.size; x++) if (s.polder[y * s.w + x] === 1) n++;
  return n * 2 > b.size * b.size;
}

/** A dyke line and the basin it shuts off (#701): what the computer builds toward. `line` is empty for a lake that needs none. */
export interface DykePlan {
  /** Ends of the line, on land, as a wall drag takes them; the dykes go on the water tiles between. */
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** The water tiles of the line, in order. */
  line: number[];
  /** The water tiles it shuts off, nearest the line first. */
  basin: number[];
  score: number;
}

/** The four-way water body (with the given tiles as banks) that holds `start`: its tiles, or null once it is open sea. */
function body(s: GameState, start: number, banks: Set<number>): number[] | null {
  const { w, h } = s;
  const out = [start];
  const seen = new Set(out);
  for (let k = 0; k < out.length; k++) {
    const t = out[k];
    const tx = t % w;
    const ty = (t - tx) / w;
    if (tx === 0 || ty === 0 || tx === w - 1 || ty === h - 1 || out.length > POLDER.most) return null;
    for (let d = 0; d < 8; d += 2) {
      const n = (ty + FOUR[d + 1]) * w + tx + FOUR[d];
      if (seen.has(n) || banks.has(n) || !wet(s, n)) continue;
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/** The four straight ways a dyke line is tried. */
const DIRS4 = [1, 0, 0, 1, 1, 1, 1, -1];

/**
 * The best dyke near a point (#701), for the computer: every shallow tile within `reach` is tried as the middle of a straight line (four
 * ways) running to land on both sides within `AI_DYKE.line` water tiles, all of them shallow; the line (as `walls` lays it between its
 * two shore ends) must shut off a basin of `least` to `POLDER.most` water tiles. A lake small enough to pump needs no line. Scored by
 * tiles won less `cost` for each dyke; ties go to the first found, in tile order. Null when there is none.
 */
export function dykePlan(s: GameState, cx: number, cy: number, reach: number, opts: { line: number; least: number; cost: number }, walls: (x0: number, y0: number, x1: number, y1: number) => { x: number; y: number }[]): DykePlan | null {
  const { w, h } = s;
  let best: DykePlan | null = null;
  const tried = new Set<string>();
  const lakes = new Set<number>();
  const x0 = Math.max(1, Math.floor(cx - reach));
  const x1 = Math.min(w - 2, Math.floor(cx + reach));
  const y0 = Math.max(1, Math.floor(cy - reach));
  const y1 = Math.min(h - 2, Math.floor(cy + reach));
  const consider = (p: DykePlan) => {
    if (!best || p.score > best.score) best = p;
  };
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const t = y * w + x;
      if (!wet(s, t)) continue;
      const dx0 = x - cx;
      const dy0 = y - cy;
      if (dx0 * dx0 + dy0 * dy0 > reach * reach) continue;
      // A lake to pump as it is.
      if (!lakes.has(t)) {
        const lake = body(s, t, new Set());
        if (lake) {
          for (const l of lake) lakes.add(l);
          if (lake.length >= opts.least) consider({ from: { x, y }, to: { x, y }, line: [], basin: lake, score: lake.length });
        }
      }
      if (!shallow(s, t)) continue;
      for (let d = 0; d < 8; d += 2) {
        const ddx = DIRS4[d];
        const ddy = DIRS4[d + 1];
        const end = (sgn: number): { x: number; y: number } | null => {
          for (let k = 1; k <= opts.line; k++) {
            const ex = x + ddx * k * sgn;
            const ey = y + ddy * k * sgn;
            if (ex < 1 || ey < 1 || ex >= w - 1 || ey >= h - 1) return null;
            const e = ey * w + ex;
            if (s.terrain[e] !== T_WATER) return s.terrain[e] === T_ROCK || s.bldAt[e] !== 0 ? null : { x: ex, y: ey };
            if (!shallow(s, e) || s.bldAt[e] !== 0) return null;
          }
          return null;
        };
        const a = end(-1);
        const b = a && end(1);
        if (!a || !b) continue;
        const key = `${a.x},${a.y},${b.x},${b.y}`;
        if (tried.has(key)) continue;
        tried.add(key);
        const tiles = walls(a.x, a.y, b.x, b.y);
        const line: number[] = [];
        let ok = true;
        for (const p of tiles) {
          const i = p.y * w + p.x;
          if (s.terrain[i] !== T_WATER) continue;
          if (!shallow(s, i) || s.bldAt[i] !== 0 || s.res[i] !== R_NONE) ok = false;
          line.push(i);
        }
        if (!ok || !line.length || line.length > opts.line + 2) continue;
        const banks = new Set(line);
        // Each side of the line on its own: the basin is the side that is not the sea.
        let done = false;
        for (const i of line) {
          if (done) break;
          const lx = i % w;
          const ly = (i - lx) / w;
          for (let q = 0; q < 8 && !done; q += 2) {
            const n = (ly + FOUR[q + 1]) * w + lx + FOUR[q];
            if (banks.has(n) || !wet(s, n) || lakes.has(n)) continue;
            const side = body(s, n, banks);
            if (!side || side.length < opts.least) continue;
            consider({ from: a, to: b, line, basin: side, score: side.length - opts.cost * line.length });
            done = true;
          }
        }
      }
    }
  return best;
}

// ---- The Age of Rivers (#701 s1): channels dug from the water, and the fields along them ----------

/**
 * Whether water (or a spring head) lies within `RIVERS.wet` tiles of a footprint: a Farm there is watered. With `ditches`, a Channel of `owner`'s being
 * dug (or dug and waiting for the water) counts as the water it will be, so a field can be laid out beside the line as it goes.
 */
export function wateredAt(s: GameState, tx: number, ty: number, size: number, ditches = false, owner = -1): boolean {
  const r = RIVERS.wet;
  for (let y = Math.max(0, ty - r); y < Math.min(s.h, ty + size + r); y++)
    for (let x = Math.max(0, tx - r); x < Math.min(s.w, tx + size + r); x++) {
      const i = y * s.w + x;
      if (source(s, i)) return true;
      if (ditches && s.bldAt[i] !== 0) {
        const b = s.byId.get(s.bldAt[i]);
        if (b && b.kind === 'building' && b.type === 'channel' && b.owner === owner) return true;
      }
    }
  return false;
}

/**
 * The Age of Rivers' door: a people standing in it lays no Farm without water within `RIVERS.wet` tiles (a channel it is digging counts).
 * Its own age only: a Golden Age weaves the watered fields in, never the door.
 */
export function parched(s: GameState, owner: number, tx: number, ty: number, size: number): boolean {
  const p = s.players[owner];
  if (!p || !AGES[ageOf(p)].rivers) return false;
  return !wateredAt(s, tx, ty, size, true, owner);
}

/** How fast a Farm works for where it lies: polder (#701) at `POLDER.farm`, a watered field in the Age of Rivers at `RIVERS.farm`. */
export function fieldBoost(s: GameState, b: Building): number {
  // Under a sluice's flood (#701 s4) a field yields nothing until the water goes.
  if (drowned(s, b)) return 0;
  let k = polderField(s, b) ? POLDER.farm : 1;
  const p = s.players[b.owner];
  if (p && ageDef(p).rivers && wateredAt(s, b.tx, b.ty, b.size)) k = Math.max(k, RIVERS.farm);
  return k;
}

/**
 * How fast a land unit wades here: `RIVERS.wade` in a channel (a dyke over one is walked as a crown), in a sluice's flood (#701 s4)
 * `INUND.wade`, or `INUND.siege` for a siege engine; 1 elsewhere.
 */
export function wading(s: GameState, x: number, y: number, siege = false): number {
  const i = Math.floor(y) * s.w + Math.floor(x);
  if (s.inund && s.inund[i] !== 0) return siege ? INUND.siege : INUND.wade;
  if (!s.channel) return 1;
  return s.channel[i] === 1 && s.bldAt[i] === 0 ? RIVERS.wade : 1;
}

/**
 * Let the water into a dug tile (the inverse of `drain`): it becomes a channel, `T_WATER` that land units wade (no `B_TERRAIN`) and no
 * ship sails, any polder it was forgotten, and its corners sink to `RIVERS.bank`, or to `RIVERS.bed` where water lies all round them.
 */
export function dig(s: GameState, tile: number, owner: number): void {
  const { w, h } = s;
  s.terrain[tile] = T_WATER;
  (s.channel ??= new Uint8Array(w * h))[tile] = 1;
  if (s.polder) s.polder[tile] = 0;
  s.block[tile] &= ~B_TERRAIN;
  const x = tile % w;
  const y = (tile - x) / w;
  const W = w + 1;
  for (let cy = y; cy <= y + 1; cy++)
    for (let cx = x; cx <= x + 1; cx++) {
      let all = true;
      for (let ty = cy - 1; ty <= cy && all; ty++) for (let tx = cx - 1; tx <= cx; tx++) if (tx < 0 || ty < 0 || tx >= w || ty >= h || s.terrain[ty * w + tx] !== T_WATER) all = false;
      const c = cy * W + cx;
      const to = all ? RIVERS.bed : RIVERS.bank;
      if (s.height[c] > to) s.height[c] = to;
    }
  const p = s.players[owner];
  if (p) p.stats.dug = (p.stats.dug ?? 0) + 1;
  s.events.push({ k: 'dug', owner, tile, x: x + 0.5, y: y + 0.5 });
}

/**
 * Every `RIVERS.fill` seconds the water runs one tile on: each finished Channel (a dug ditch) with water (or a spring head) four-ways
 * beside it fills, in id order, all at once, so water let in this step runs on only at the next. The ditch gives way to the water and
 * is gone; a spring head it was dug from opens into the channel with it.
 */
export function ditchStep(s: GameState): void {
  if (s.tick % secs(RIVERS.fill) !== 0) return;
  let full: Building[] | null = null;
  const { w, h } = s;
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'channel' || !e.built || e.hp <= 0) continue;
    for (let d = 0; d < 8; d += 2) {
      const x = e.tx + FOUR[d];
      const y = e.ty + FOUR[d + 1];
      if (x >= 0 && y >= 0 && x < w && y < h && source(s, y * w + x)) {
        (full ??= []).push(e);
        break;
      }
    }
  }
  if (!full) return;
  for (const b of full) {
    stampBuilding(s, b, false);
    s.byId.delete(b.id);
    for (let d = 0; d < 8; d += 2) {
      const t = (b.ty + FOUR[d + 1]) * w + b.tx + FOUR[d];
      if (isSpring(s, t)) {
        s.springs = s.springs!.filter((x) => x !== t);
        dig(s, t, b.owner);
      }
    }
    dig(s, b.ty * w + b.tx, b.owner);
  }
  const gone = new Set<number>(full.map((b) => b.id));
  s.ents = s.ents.filter((e) => !gone.has(e.id));
}

/** A channel the computer means to dig (#701 s1): the ditch tiles from the water's edge toward home, in digging order. */
export interface ChannelPlan {
  /** Ends of the line, as a wall drag takes them: `from` beside the water, `to` the end nearest home. */
  from: { x: number; y: number };
  to: { x: number; y: number };
  tiles: number[];
}

/** Sixteen ways a channel is tried, as steps of about one tile (no trigonometry in the rules). */
const DIRS16 = [
  [1, 0], [0.924, 0.383], [0.707, 0.707], [0.383, 0.924], [0, 1], [-0.383, 0.924], [-0.707, 0.707], [-0.924, 0.383],
  [-1, 0], [-0.924, -0.383], [-0.707, -0.707], [-0.383, -0.924], [0, -1], [0.383, -0.924], [0.707, -0.707], [0.924, -0.383],
];

/**
 * The channel the computer digs (#701 s1): from the land tile beside the water (or a spring head) nearest home, within `reach` of it, the straight line
 * (of sixteen ways, at most `most` tiles) that waters the most ground near home: each tile is worth more the nearer it runs to home,
 * full within `stop` tiles. A line ends at the first tile a Channel can't go on (as `fits` says), so a town grown in the way is dug
 * round, not through. Ties go to the first way tried. Null when no water lies within reach, or no line runs three tiles.
 */
export function channelPlan(
  s: GameState,
  cx: number,
  cy: number,
  opts: { reach: number; stop: number; most: number },
  line: (x0: number, y0: number, x1: number, y1: number) => { x: number; y: number }[],
  fits: (x: number, y: number) => boolean,
): ChannelPlan | null {
  const { w, h } = s;
  const r = opts.reach;
  let best = -1;
  let bestD = Infinity;
  for (let y = Math.max(1, Math.floor(cy - r)); y <= Math.min(h - 2, Math.floor(cy + r)); y++)
    for (let x = Math.max(1, Math.floor(cx - r)); x <= Math.min(w - 2, Math.floor(cx + r)); x++) {
      const i = y * w + x;
      if (s.terrain[i] === T_WATER || !fits(x, y)) continue;
      let shore = false;
      for (let d = 0; d < 8; d += 2) if (source(s, (y + FOUR[d + 1]) * w + x + FOUR[d])) shore = true;
      if (!shore) continue;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  if (best < 0) return null;
  const fx = best % w;
  const fy = (best - fx) / w;
  let out: ChannelPlan | null = null;
  let top = 0;
  for (const [ux, uy] of DIRS16) {
    const ex = Math.max(1, Math.min(w - 2, Math.floor(fx + 0.5 + ux * opts.most)));
    const ey = Math.max(1, Math.min(h - 2, Math.floor(fy + 0.5 + uy * opts.most)));
    const tiles: number[] = [];
    let end = { x: fx, y: fy };
    let worth = 0;
    for (const p of line(fx, fy, ex, ey)) {
      if (s.terrain[p.y * w + p.x] === T_WATER || !fits(p.x, p.y)) break;
      tiles.push(p.y * w + p.x);
      end = p;
      const dx = p.x + 0.5 - cx;
      const dy = p.y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      worth += d <= opts.stop ? 1 : opts.stop / d;
    }
    if (tiles.length >= 3 && worth > top) {
      top = worth;
      out = { from: { x: fx, y: fy }, to: end, tiles };
    }
  }
  return out;
}

// ---- The Age of the Water Line (#701 s4): sluices that let the water out over the low ground, and back ----------

/** Whether a Farm lies under a sluice's flood: most of its footprint. It yields nothing until the water goes. */
export function drowned(s: GameState, b: Building): boolean {
  if (!s.inund || b.type !== 'farm') return false;
  let n = 0;
  for (let y = b.ty; y < b.ty + b.size; y++) for (let x = b.tx; x < b.tx + b.size; x++) if (s.inund[y * s.w + x] !== 0) n++;
  return n * 2 > b.size * b.size;
}

/**
 * Whether a sluice can be worked: standing, finished, and its people in the Age of the Water Line (or a Golden Age that wove it in),
 * or it is the sluice the people kept on leaving (the age's keepsake). Any other sluice sleeps, shut, outside the age.
 */
export function sluiceWorks(s: GameState, b: Building): boolean {
  return b.type === 'sluice' && b.built && b.hp > 0 && (!!ageDef(s.players[b.owner]).sluices || b.keep === 'waterline') && !asleep(s, b);
}

/** Whether still water (sea, lake or channel, not a flood and nothing built on it) lies four-ways beside a sluice: what it lets out. */
export function sluiceFed(s: GameState, b: Building): boolean {
  for (let d = 0; d < 8; d += 2) {
    const x = b.tx + FOUR[d];
    const y = b.ty + FOUR[d + 1];
    if (x >= 0 && y >= 0 && x < s.w && y < s.h && wet(s, y * s.w + x)) return true;
  }
  return false;
}

/** Whether a sluice is letting the water out now: open, working, and with water beside it. */
export const lets = (s: GameState, b: Building): boolean => !!b.open && sluiceWorks(s, b) && sluiceFed(s, b);

/** Why a people can't open or shut this sluice now, or null. */
export function sluiceProblem(s: GameState, b: Building): string | null {
  if (b.type !== 'sluice') return 'Not a sluice';
  if (!b.built) return 'The sluice is not finished';
  if (!sluiceWorks(s, b)) return `Sluices open only in the ${AGES.waterline.name}, or the one your people kept on leaving it`;
  return null;
}

/** The highest corner of a tile. */
function topOf(s: GameState, t: number): number {
  const x = t % s.w;
  const y = (t - x) / s.w;
  const W = s.w + 1;
  const h = s.height;
  const i = y * W + x;
  return Math.max(h[i], h[i + 1], h[i + W], h[i + W + 1]);
}

/**
 * How high a sluice's water climbs: `INUND.rise` over its lowest bank (the lowest land four-ways beside it), or over `POLDER.ground`
 * where none is land. The flood runs over the ground up to that line, so a sluice on a channel through high meadow floods the meadow
 * round it, and a rise in the land stands out of the water.
 */
export function waterTop(s: GameState, b: { tx: number; ty: number }): number {
  let bank = Infinity;
  for (let d = 0; d < 8; d += 2) {
    const x = b.tx + FOUR[d];
    const y = b.ty + FOUR[d + 1];
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
    const n = y * s.w + x;
    // Ground the flood already lies on is still the bank it was: its heights are as they were.
    if (s.terrain[n] !== T_WATER || isInund(s, n)) bank = Math.min(bank, topOf(s, n));
  }
  return (bank === Infinity ? POLDER.ground : bank) + INUND.rise;
}

/**
 * Whether a sluice's flood can run over this tile, its water up to `top`: open meadow or sand (or polder, always) lying no higher, with
 * no tree, deposit, spring or building on it; a Farm goes under. Rock, woods, rises and towns stand out of the water.
 */
export function floodable(s: GameState, t: number, top = POLDER.ground + INUND.rise): boolean {
  const k = s.terrain[t];
  if ((k !== T_GRASS && k !== T_SAND) || s.res[t] !== R_NONE || isSpring(s, t)) return false;
  if (s.bldAt[t] !== 0) {
    const b = s.byId.get(s.bldAt[t]);
    if (!b || b.kind !== 'building' || b.type !== 'farm') return false;
  }
  return isPolder(s, t) || topOf(s, t) <= top;
}

/**
 * The ground a sluice's flood covers when it has run its full course: every tile reached from the sluice, four ways, through low
 * ground (`floodable`) or water already let out, within `INUND.reach` steps, in the order reached.
 */
export function waterLine(s: GameState, b: { tx: number; ty: number }): number[] {
  const { w, h } = s;
  const top = waterTop(s, b);
  const start = b.ty * w + b.tx;
  const out: number[] = [];
  let ring = [start];
  const seen = new Set(ring);
  for (let r = 0; r < INUND.reach && ring.length; r++) {
    const next: number[] = [];
    for (const t of ring) {
      const tx = t % w;
      const ty = (t - tx) / w;
      for (let d = 0; d < 8; d += 2) {
        const nx = tx + FOUR[d];
        const ny = ty + FOUR[d + 1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (seen.has(n) || !(isInund(s, n) || floodable(s, n, top))) continue;
        seen.add(n);
        next.push(n);
        out.push(n);
      }
    }
    ring = next;
  }
  return out;
}

/**
 * Let the water over a tile of low ground (#701 s4): `T_WATER` a land unit wades and a gun-barge sails, knee-deep over the ground as it
 * lies (its heights are not touched: the renderer draws the sheet of water over it).
 */
export function inundate(s: GameState, tile: number, owner: number): void {
  const { w, h } = s;
  (s.inund ??= new Uint8Array(w * h))[tile] = s.terrain[tile] + 1;
  s.terrain[tile] = T_WATER;
  const x = tile % w;
  const y = (tile - x) / w;
  // Walkability is unchanged (waded, no B_TERRAIN), but boats may now pass: routes are drawn again.
  s.blockVersion++;
  s.inundated = (s.inundated ?? 0) + 1;
  s.events.push({ k: 'inundated', owner, tile, x: x + 0.5, y: y + 0.5, wet: true });
}

/** The water leaves a flooded tile (the inverse of `inundate`): the ground it had comes back as it was. */
export function ebb(s: GameState, tile: number): void {
  const { w } = s;
  s.terrain[tile] = s.inund![tile] - 1;
  s.inund![tile] = 0;
  const x = tile % w;
  const y = (tile - x) / w;
  s.blockVersion++;
  s.inundated = (s.inundated ?? 0) + 1;
  s.events.push({ k: 'inundated', owner: landOwnerAt(s, x + 0.5, y + 0.5), tile, x: x + 0.5, y: y + 0.5, wet: false });
}

/**
 * Every `INUND.every` seconds the Water Line moves a ring (#701 s4). From each open sluice with water beside it (in id order) the
 * flood runs one tile on, four ways, over the low ground of its `waterLine`; flooded ground no open sluice reaches drains a ring from
 * its edges in. A tile a boat floats on stays wet while water lies beside it, so the boat can still get out; once it is the last, it
 * drains, and the boat runs aground and is lost.
 */
export function sluiceStep(s: GameState): void {
  if (s.tick % secs(INUND.every) !== 0) return;
  const { w, h } = s;
  const want = new Map<number, number>();
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.type !== 'sluice' || !lets(s, e)) continue;
    for (const t of waterLine(s, e)) if (!want.has(t)) want.set(t, e.owner);
    // The sluice's own tile seeds the spread.
    want.set(e.ty * w + e.tx, e.owner);
  }
  if (!want.size && !s.inund) return;
  const near = (t: number, ok: (n: number) => boolean): boolean => {
    const x = t % w;
    const y = (t - x) / w;
    for (let d = 0; d < 8; d += 2) {
      const nx = x + FOUR[d];
      const ny = y + FOUR[d + 1];
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && ok(ny * w + nx)) return true;
    }
    return false;
  };
  const sluiceAt = (n: number): boolean => {
    const b = s.byId.get(s.bldAt[n]);
    return !!b && b.kind === 'building' && b.type === 'sluice' && want.get(n) !== undefined;
  };
  // Rise: low ground the water wants, beside water already out or the sluice letting it.
  const rise: number[] = [];
  // (Each sluice's `waterLine` judged how high its water climbs; here only what stands on the tile now.)
  for (const [t, owner] of want) if (floodable(s, t, Infinity) && near(t, (n) => isInund(s, n) || sluiceAt(n))) rise.push(t, owner);
  // Fall: flooded ground no open sluice reaches, from its edges in.
  const fall: number[] = [];
  if (s.inund) {
    let boats: Set<number> | null = null;
    for (let t = 0; t < w * h; t++) {
      if (s.inund[t] === 0 || want.has(t) || !near(t, (n) => !isInund(s, n))) continue;
      if (!boats) {
        boats = new Set();
        for (const u of s.ents) if (u.kind === 'unit' && u.hp > 0 && domainOf(u.type) === 'water') boats.add(Math.floor(u.y) * w + Math.floor(u.x));
      }
      if (boats.has(t) && near(t, (n) => s.terrain[n] === T_WATER)) continue;
      fall.push(t);
    }
  }
  for (let i = 0; i < rise.length; i += 2) inundate(s, rise[i], rise[i + 1]);
  if (!fall.length) return;
  const dry = new Set(fall);
  for (const t of fall) ebb(s, t);
  for (const u of s.ents) if (u.kind === 'unit' && u.hp > 0 && domainOf(u.type) === 'water' && dry.has(Math.floor(u.y) * w + Math.floor(u.x))) u.hp = 0;
}
