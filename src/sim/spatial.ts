import type { GameState, Unit } from './types';

/**
 * A bucket grid of living units, rebuilt every tick, for "who is near here" questions: pushing apart,
 * picking fights, towers aiming. Each bucket is a linked list through flat arrays (no allocation per
 * tick), filled in id order so every lookup is deterministic.
 */
export const CELL = 4;

export class Spatial {
  private cols = 0;
  private rows = 0;
  private head = new Int32Array(0);
  private next = new Int32Array(0);
  private tail = new Int32Array(0);
  private units: Unit[] = [];

  rebuild(s: GameState): void {
    const cols = Math.ceil(s.w / CELL);
    const rows = Math.ceil(s.h / CELL);
    if (cols !== this.cols || rows !== this.rows) {
      this.cols = cols;
      this.rows = rows;
      this.head = new Int32Array(cols * rows);
      this.tail = new Int32Array(cols * rows);
    }
    this.head.fill(-1);
    this.units.length = 0;
    // Units sheltering inside buildings are out of reach.
    for (const e of s.ents) if (e.kind === 'unit' && e.hp > 0 && !e.inside) this.units.push(e);
    if (this.next.length < this.units.length) this.next = new Int32Array(this.units.length * 2);
    // Append at the tail so each bucket keeps id order.
    for (let k = 0; k < this.units.length; k++) {
      const u = this.units[k];
      const c = this.cell(u.x, u.y);
      this.next[k] = -1;
      if (this.head[c] < 0) this.head[c] = k;
      else this.next[this.tail[c]] = k;
      this.tail[c] = k;
    }
  }

  private cell(x: number, y: number): number {
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / CELL)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(y / CELL)));
    return cy * this.cols + cx;
  }

  /** Call `fn` for every unit whose bucket overlaps the circle (callers check the exact distance). */
  near(x: number, y: number, r: number, fn: (u: Unit) => void): void {
    const x0 = Math.max(0, Math.floor((x - r) / CELL));
    const x1 = Math.min(this.cols - 1, Math.floor((x + r) / CELL));
    const y0 = Math.max(0, Math.floor((y - r) / CELL));
    const y1 = Math.min(this.rows - 1, Math.floor((y + r) / CELL));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        for (let k = this.head[cy * this.cols + cx]; k >= 0; k = this.next[k]) fn(this.units[k]);
      }
    }
  }
}
