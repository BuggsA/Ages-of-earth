import { ATTRITION, BORDERS, domainOf, secs } from './data';
import { isEnemy, maxHp } from './world';
import type { GameState } from './types';

/** Who owns each tile (player index, or -1 for no one's land). Pure: reads the state, changes nothing. */
export function borderMap(s: GameState): Int8Array {
  const owner = new Int8Array(s.w * s.h).fill(-1);
  const best = new Float32Array(s.w * s.h).fill(Infinity);
  for (const e of s.ents) {
    if (e.kind !== 'building' || !e.built || e.hp <= 0) continue;
    const radius = BORDERS[e.type];
    if (!radius) continue;
    const cx = e.tx + e.size / 2;
    const cy = e.ty + e.size / 2;
    const reach = radius + e.size / 2;
    const x0 = Math.max(0, Math.floor(cx - reach));
    const x1 = Math.min(s.w - 1, Math.floor(cx + reach));
    const y0 = Math.max(0, Math.floor(cy - reach));
    const y1 = Math.min(s.h - 1, Math.floor(cy + reach));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d = dx * dx + dy * dy;
        if (d > reach * reach || d >= best[y * s.w + x]) continue;
        best[y * s.w + x] = d;
        owner[y * s.w + x] = e.owner;
      }
    }
  }
  return owner;
}

/** Who owns one tile (same rule as `borderMap`, without building the whole map), or -1. */
export function landOwnerAt(s: GameState, x: number, y: number): number {
  let owner = -1;
  let best = Infinity;
  for (const e of s.ents) {
    if (e.kind !== 'building' || !e.built || e.hp <= 0) continue;
    const radius = BORDERS[e.type];
    if (!radius) continue;
    const reach = radius + e.size / 2;
    const dx = x + 0.5 - (e.tx + e.size / 2);
    const dy = y + 0.5 - (e.ty + e.size / 2);
    const d = dx * dx + dy * dy;
    if (d > reach * reach || d >= best) continue;
    best = d;
    owner = e.owner;
  }
  return owner;
}

/** Whether some land of `team` lies within the supply reach of tile (x, y). */
export function suppliedAt(s: GameState, own: Int8Array, team: number, x: number, y: number): boolean {
  const reach = ATTRITION.deep;
  for (let dy = -reach; dy <= reach; dy += 2) {
    for (let dx = -reach; dx <= reach; dx += 2) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= s.w || ty >= s.h || dx * dx + dy * dy > reach * reach) continue;
      const o = own[ty * s.w + tx];
      if (o >= 0 && s.players[o].team === team) return true;
    }
  }
  return false;
}

const EXEMPT = new Set(['citizen', 'priest', 'trader']);

/** Armies far from their own border, deep in an enemy's, wear down. Called every tick; works on a timer. */
export function attrition(s: GameState): void {
  if (s.tick === 0 || s.tick < s.peaceUntil || s.tick % secs(ATTRITION.every) !== 0) return;
  let own: Int8Array | null = null;
  for (const u of s.ents) {
    if (u.kind !== 'unit' || u.hp <= 0 || u.inside || EXEMPT.has(u.type) || domainOf(u.type) !== 'land') continue;
    own ??= borderMap(s);
    const x = Math.floor(u.x);
    const y = Math.floor(u.y);
    const here = own[y * s.w + x];
    if (here < 0 || !isEnemy(s, u.owner, here)) continue;
    const supplied = suppliedAt(s, own, s.players[u.owner].team, x, y);
    if (!supplied) u.hp -= Math.max(1, maxHp(s, u) * ATTRITION.loss);
  }
}
