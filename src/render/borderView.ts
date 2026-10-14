import * as THREE from 'three';
import { borderMap } from '../sim/borders';
import type { GameState } from '../sim/types';
import { heightAt } from './terrain';
import { WATER_Y } from './water';

const LIFT = 0.07;
const INSET = 0.08;

/** Each player's land drawn as a coloured line along its edge, only where the viewer has explored. */
export class BorderView {
  readonly mesh: THREE.LineSegments;
  private positions = new THREE.BufferAttribute(new Float32Array(0), 3);
  private colors = new THREE.BufferAttribute(new Float32Array(0), 3);
  private key = '';
  private col: THREE.Color[] = [];

  constructor() {
    this.mesh = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false, fog: false, toneMapped: false,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
  }

  setColors(colors: string[]): void {
    this.col = colors.map((c) => new THREE.Color(c));
    this.key = '';
  }

  /** Redraw about once a second (the claim only changes when buildings finish or fall). */
  update(s: GameState, viewer: number, reveal: boolean, on: boolean): void {
    this.mesh.visible = on;
    if (!on) return;
    const key = `${s.tick >> 4}:${viewer}:${reveal}`;
    if (key === this.key) return;
    this.key = key;
    const own = borderMap(s);
    const seen = s.players[viewer].seen;
    const shown = (x: number, y: number) => x >= 0 && y >= 0 && x < s.w && y < s.h && (reveal || seen[y * s.w + x] > 0);
    const pos: number[] = [];
    const rgb: number[] = [];
    const edge = (o: number, x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => {
      const c = this.col[o] ?? this.col[0];
      for (const [x, y] of [[x0, y0], [x1, y1]]) {
        const px = x - nx * INSET;
        const py = y - ny * INSET;
        pos.push(px, Math.max(WATER_Y, heightAt(s, px, py)) + LIFT, py);
        rgb.push(c.r, c.g, c.b);
      }
    };
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const o = own[y * s.w + x];
        if (o < 0 || !shown(x, y)) continue;
        const differs = (nx: number, ny: number) => {
          const inside = nx >= 0 && ny >= 0 && nx < s.w && ny < s.h;
          return inside ? own[ny * s.w + nx] !== o : true;
        };
        if (differs(x - 1, y)) edge(o, x, y, x, y + 1, -1, 0);
        if (differs(x + 1, y)) edge(o, x + 1, y, x + 1, y + 1, 1, 0);
        if (differs(x, y - 1)) edge(o, x, y, x + 1, y, 0, -1);
        if (differs(x, y + 1)) edge(o, x, y + 1, x + 1, y + 1, 0, 1);
      }
    }
    const g = new THREE.BufferGeometry();
    this.positions = new THREE.BufferAttribute(new Float32Array(pos), 3);
    this.colors = new THREE.BufferAttribute(new Float32Array(rgb), 3);
    g.setAttribute('position', this.positions);
    g.setAttribute('color', this.colors);
    this.mesh.geometry.dispose();
    this.mesh.geometry = g;
  }
}
