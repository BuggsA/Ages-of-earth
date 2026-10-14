import type { GameState } from '../sim/types';

/**
 * Waymarks (#152): what the viewer last saw of ruins and relics. Ground under fog shows the picture as
 * it was when last in sight, not the live truth, so a scout is worth sending back. Held in the client,
 * never simulation state, saves or commands: it is rebuilt as the viewer sees things.
 */
export interface RelicMark { x: number; y: number; hidden: boolean }

export class Waymarks {
  /** Ruin id -> who dug it when last seen (-1 while it stood). */
  ruins = new Map<number, number>();
  /** Relic id -> where it lay when last seen; `hidden` when it was carried or in a Temple. */
  relics = new Map<number, RelicMark>();

  reset(): void {
    this.ruins.clear();
    this.relics.clear();
  }

  /** Refresh memory from what the viewer sees now. A thing on explored ground never watched is learned as it is. */
  update(s: GameState, viewer: number): void {
    const p = s.players[viewer];
    const at = (x: number, y: number): number => Math.floor(y) * s.w + Math.floor(x);
    for (const r of s.ruins ?? []) {
      const i = at(r.x, r.y);
      if (p.vis[i] || (p.seen[i] && !this.ruins.has(r.id))) this.ruins.set(r.id, r.by);
    }
    for (const r of s.relics) {
      const i = at(r.x, r.y);
      if (p.vis[i] || (p.seen[i] && !this.relics.has(r.id))) this.relics.set(r.id, { x: r.x, y: r.y, hidden: !!(r.carrier || r.temple) });
    }
  }
}
