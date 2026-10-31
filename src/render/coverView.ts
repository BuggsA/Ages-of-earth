import * as THREE from 'three';
import { walkable } from '../sim/grid';
import { inWoods } from '../sim/terrain';
import { R_TREE, type GameState } from '../sim/types';
import { heightAt } from './terrain';

/**
 * Forest cover (#934): hovering a wood traces the edge of its cover on the ground, a soft pale line that fades out from the
 * pointer. Inside it a soldier is hidden from rivals beyond a few tiles (`terrain.ts`). The edge is traced by marching squares
 * over tile centres (a tile counts when trees stand on it, or it is open ground in a wood), so it runs on the diagonal and reads
 * as the wood's shape, not a staircase. Built again only when the hovered tile or the trees change.
 */

/** How far from the pointer the edge is traced, in tiles. */
const REACH = 9;
/** The line's width, in tiles, and its lift off the ground. */
const WIDTH = 0.07;
const LIFT = 0.06;
const COLOR = new THREE.Color('#eaffd6');

/** Edge segments for each marching-squares case: pairs of edge midpoints, 0 top, 1 right, 2 bottom, 3 left. */
const CASES: number[][] = [[], [3, 0], [0, 1], [3, 1], [1, 2], [3, 0, 1, 2], [0, 2], [3, 2], [2, 3], [0, 2], [0, 1, 2, 3], [1, 2], [3, 1], [0, 1], [3, 0], []];
const MID: number[][] = [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]];

export class CoverView {
  readonly mesh: THREE.Mesh;
  private key = '';

  constructor() {
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Trace the cover round the hovered point, if it lies in a wood the viewer has seen; else hide. */
  update(s: GameState, viewer: number, at: { x: number; y: number } | null, reveal: boolean): void {
    const tx = at ? Math.floor(at.x) : -1;
    const ty = at ? Math.floor(at.y) : -1;
    const here = tx >= 0 && ty >= 0 && tx < s.w && ty < s.h ? ty * s.w + tx : -1;
    const seen = (i: number) => reveal || s.players[viewer].seen[i] === 1;
    const wooded = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < s.w && y < s.h && seen(y * s.w + x) && (s.res[y * s.w + x] === R_TREE || (walkable(s, x, y) && inWoods(s, x + 0.5, y + 0.5)));
    if (here < 0 || !wooded(tx, ty)) {
      this.mesh.visible = false;
      this.key = '';
      return;
    }
    const key = `${here}:${s.blockVersion}`;
    this.mesh.visible = true;
    if (key === this.key) return;
    this.key = key;
    const n = 2 * REACH + 2;
    const field = new Uint8Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) field[j * n + i] = wooded(tx - REACH + i, ty - REACH + j) ? 1 : 0;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const point = (cx: number, cy: number, e: number): [number, number] => [cx + 0.5 + MID[e][0], cy + 0.5 + MID[e][1]];
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const c = field[j * n + i] | (field[j * n + i + 1] << 1) | (field[(j + 1) * n + i + 1] << 2) | (field[(j + 1) * n + i] << 3);
        const segs = CASES[c];
        for (let k = 0; k < segs.length; k += 2) {
          const cx = tx - REACH + i;
          const cy = ty - REACH + j;
          const [x0, y0] = point(cx, cy, segs[k]);
          const [x1, y1] = point(cx, cy, segs[k + 1]);
          this.ribbon(s, pos, col, idx, x0, y0, x1, y1, at!);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    g.setIndex(idx);
    this.mesh.geometry.dispose();
    this.mesh.geometry = g;
  }

  /** One flat strip from (x0, y0) to (x1, y1) on the ground, fading out with distance from the pointer. */
  private ribbon(s: GameState, pos: number[], col: number[], idx: number[], x0: number, y0: number, x1: number, y1: number, at: { x: number; y: number }): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * WIDTH * 0.5;
    const ny = (dx / l) * WIDTH * 0.5;
    const base = pos.length / 3;
    for (const [x, y] of [[x0 + nx, y0 + ny], [x0 - nx, y0 - ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny]]) {
      pos.push(x, heightAt(s, x, y) + LIFT, y);
      const d = Math.hypot(x - at.x, y - at.y) / REACH;
      col.push(COLOR.r, COLOR.g, COLOR.b, 0.55 * Math.max(0, 1 - d * d));
    }
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
}
