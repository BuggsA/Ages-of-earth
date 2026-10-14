import { BEACON, BUILDINGS } from './data';
import type { GameState } from './types';
import { statsOf } from './world';

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

export function updateVision(s: GameState): void {
  for (const p of s.players) p.vis.fill(0);
  for (const e of s.ents) {
    if (e.hp <= 0) continue;
    const p = s.players[e.owner];
    let r: number;
    if (e.kind === 'unit') r = statsOf(s, e).sight;
    else r = e.built ? BUILDINGS[e.type].sight + e.size / 2 + (e.beacon !== undefined && s.tick < e.beacon ? BEACON.sight : 0) : 2 + e.size / 2;
    const cx = Math.floor(e.x);
    const cy = Math.floor(e.y);
    const d = disc(r);
    for (let k = 0; k < d.length; k += 2) {
      const x = cx + d[k];
      const y = cy + d[k + 1];
      if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
      const i = y * s.w + x;
      p.vis[i] = 1;
      p.seen[i] = 1;
    }
  }
  // A lit beacon is seen by everyone: the ground around it shows to every rival.
  for (const e of s.ents) {
    if (e.kind !== 'building' || e.beacon === undefined || s.tick >= e.beacon || e.hp <= 0) continue;
    const d = disc(BEACON.exposed + e.size / 2);
    const cx = Math.floor(e.x);
    const cy = Math.floor(e.y);
    for (const p of s.players) {
      if (p.id === e.owner) continue;
      for (let k = 0; k < d.length; k += 2) {
        const x = cx + d[k];
        const y = cy + d[k + 1];
        if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
        p.vis[y * s.w + x] = 1;
        p.seen[y * s.w + x] = 1;
      }
    }
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
