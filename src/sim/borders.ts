import { BORDERS } from './data';
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
