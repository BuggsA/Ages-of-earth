import { kinBonus } from './landmarks';
import { BEACON, BUILDINGS, LANDMARKS, TELEGRAPH } from './data';
import { inField } from './ages';
import { modsOf } from './stats';
import type { GameState } from './types';
import { statsOf } from './world';
import { pollenMul } from './bloom';

/** Fog of war: which tiles each player sees now, and which they have ever seen. */

const discs = new Map<number, Int16Array>();

/** Tile offsets within a radius, as [dx, dy, dx, dy, ...]. */
function disc(r: number): Int16Array {
  const key = Math.round(r * 2);
  let d = discs.get(key);
  if (d) return d;
  const out: number[] = [];
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= r * r + 0.5) out.push(dx, dy);
  d = Int16Array.from(out);
  discs.set(key, d);
  return d;
}

const rowsOf = new Map<Int16Array, Int16Array>();

/** The same disc as rows, [dy, half-width, dy, half-width, ...]: each row of a disc is one unbroken run of tiles. */
function rows(d: Int16Array): Int16Array {
  let out = rowsOf.get(d);
  if (out) return out;
  const half = new Map<number, number>();
  for (let k = 0; k < d.length; k += 2) half.set(d[k + 1], Math.max(half.get(d[k + 1]) ?? 0, Math.abs(d[k])));
  const list: number[] = [];
  for (const [dy, m] of half) list.push(dy, m);
  out = Int16Array.from(list);
  rowsOf.set(d, out);
  return out;
}

/** Marks a disc around a tile as seen now and ever, for one player: run by run, clipped to the map once a row. */
function stamp(s: GameState, vis: Uint8Array, seen: Uint8Array, cx: number, cy: number, d: Int16Array): void {
  const r = rows(d);
  for (let k = 0; k < r.length; k += 2) {
    const y = cy + r[k];
    if (y < 0 || y >= s.h) continue;
    const x0 = Math.max(0, cx - r[k + 1]);
    const x1 = Math.min(s.w - 1, cx + r[k + 1]);
    if (x0 > x1) continue;
    const row = y * s.w;
    vis.fill(1, row + x0, row + x1 + 1);
    seen.fill(1, row + x0, row + x1 + 1);
  }
}

export function updateVision(s: GameState): void {
  for (const p of s.players) p.vis.fill(0);
  for (const e of s.ents) {
    if (e.hp <= 0) continue;
    const p = s.players[e.owner];
    let r: number;
    if (e.kind === 'unit') r = statsOf(s, e).sight;
    else r = e.built ? BUILDINGS[e.type].sight + e.size / 2 + (e.beacon !== undefined && s.tick < e.beacon ? BEACON.sight : 0) : 2 + e.size / 2;
    // Wireless Telegraphy: ships and finished Docks inside a Tower's field see farther over the water.
    if ((e.kind === 'unit' ? statsOf(s, e).cls === 'ship' : e.type === 'dock' && e.built) && modsOf(s, e.owner).telegraph && inField(s, e)) r += TELEGRAPH.sight;
    // A pollen storm (the Age of the Bloom) halves the sight of a rival's soldiers and towers near a Bloom people's Heart Tree.
    r *= pollenMul(s, e);
    const cx = Math.floor(e.x);
    const cy = Math.floor(e.y);
    stamp(s, p.vis, p.seen, cx, cy, disc(r));
  }
  // A Lookout Crag shows its keeper the land all round it.
  for (const m of s.landmarks ?? []) {
    if (m.kind !== 'crag' || m.owner < 0) continue;
    const p = s.players[m.owner];
    const d = disc(Math.round(kinBonus(s, m.owner, 'crag', LANDMARKS.crag.sight)));
    const cx = Math.floor(m.x);
    const cy = Math.floor(m.y);
    stamp(s, p.vis, p.seen, cx, cy, d);
  }
  // A lit beacon is seen by everyone: the ground around it shows to every rival.
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.beacon === undefined || s.tick >= e.beacon || e.hp <= 0) continue;
    const d = disc(BEACON.exposed + e.size / 2);
    const cx = Math.floor(e.x);
    const cy = Math.floor(e.y);
    for (const p of s.players) {
      if (p.id === e.owner) continue;
      stamp(s, p.vis, p.seen, cx, cy, d);
    }
  }
  // A warhead's blast clears the fog for everyone over its radius for a while (#752): all can watch what burned and what stands.
  for (const b of s.blasts ?? []) {
    const d = disc(b.r);
    const cx = Math.floor(b.x);
    const cy = Math.floor(b.y);
    for (const p of s.players) stamp(s, p.vis, p.seen, cx, cy, d);
  }
  // Allies share what they see.
  for (let a = 0; a < s.players.length; a++) {
    const pa = s.players[a];
    for (let b = a + 1; b < s.players.length; b++) {
      const pb = s.players[b];
      if (pa.team !== pb.team) continue;
      const n = pa.vis.length;
      for (let i = 0; i < n; i++) {
        const v = pa.vis[i] | pb.vis[i];
        pa.vis[i] = v;
        pb.vis[i] = v;
        const sn = pa.seen[i] | pb.seen[i];
        pa.seen[i] = sn;
        pb.seen[i] = sn;
      }
    }
  }
}

/** Whether a player sees a point now. */
export function sees(s: GameState, player: number, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= s.w || ty >= s.h) return false;
  return s.players[player].vis[ty * s.w + tx] === 1;
}

/** Whether a player sees any tile of a footprint now. */
export function seesRect(s: GameState, player: number, tx: number, ty: number, size: number): boolean {
  const vis = s.players[player].vis;
  for (let y = ty; y < ty + size; y++) for (let x = tx; x < tx + size; x++) if (x >= 0 && y >= 0 && x < s.w && y < s.h && vis[y * s.w + x]) return true;
  return false;
}
