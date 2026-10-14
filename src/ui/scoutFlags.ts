import type { GameState } from '../sim/types';

/** Personal map notes, never simulation state or network commands. */
export type ScoutFlagKind = 'plan' | 'danger';
export interface ScoutFlag { x: number; y: number; kind: ScoutFlagKind }
export type FlagResult = 'planted' | 'changed' | 'removed' | 'unexplored';

export const MAX_SCOUT_FLAGS = 6;
const NEAR_SQ = 2.2 * 2.2;

export class ScoutFlags {
  private marks: ScoutFlag[] = [];

  get all(): readonly ScoutFlag[] { return this.marks; }
  reset(): void { this.marks = []; }

  /** Toggle an explored location, switching a flag's kind if the requested kind differs. */
  toggle(s: Pick<GameState, 'w' | 'h' | 'players'>, viewer: number, x: number, y: number, kind: ScoutFlagKind = 'plan'): FlagResult {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 'unexplored';
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= s.w || ty >= s.h) return 'unexplored';
    if (!s.players[viewer]?.seen[ty * s.w + tx]) return 'unexplored';
    const at = { x: tx + 0.5, y: ty + 0.5 };
    const nearby = this.marks.findIndex((f) => (f.x - at.x) ** 2 + (f.y - at.y) ** 2 <= NEAR_SQ);
    if (nearby >= 0) {
      const existing = this.marks[nearby];
      if (existing.kind !== kind) {
        this.marks[nearby] = { ...existing, kind };
        return 'changed';
      }
      this.marks.splice(nearby, 1);
      return 'removed';
    }
    if (this.marks.length === MAX_SCOUT_FLAGS) this.marks.shift();
    this.marks.push({ ...at, kind });
    return 'planted';
  }
}
