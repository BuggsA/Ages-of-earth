import * as THREE from 'three';
import { BUILDINGS, RECLAIM, secs } from '../sim/data';
import type { BuildingType, Fallen, GameState } from '../sim/types';
import { heightAt } from './terrain';
import { WATER_Y } from './water';

/** Presentation limit, not balance: the most foundations drawn at once. */
export const MAX_FOUNDATIONS = 32;
const LIFT = 0.06;
const COLOR = new THREE.Color('#d9c9a0');
/** Keep an old site readable until its rebuild window actually closes. */
const MIN_ALPHA = 0.2;

export interface FoundationSite {
  type: BuildingType;
  tx: number;
  ty: number;
  size: number;
}

/** Apply the same ownership, expiry and presentation cap to the site list and its drawing. */
function liveFoundations(s: GameState, viewer: number): Fallen[] {
  const out: Fallen[] = [];
  for (const f of s.fallen ?? []) {
    if (f.owner !== viewer || f.until <= s.tick) continue;
    out.push(f);
    if (out.length >= MAX_FOUNDATIONS) break;
  }
  return out;
}

/** The viewer's own remembered footprints (the Age of Reclaimers, `reclaim.ts`): only theirs, never a rival's. */
export function foundationSites(s: GameState, viewer: number): FoundationSite[] {
  return liveFoundations(s, viewer).map((f) => ({ type: f.type, tx: f.tx, ty: f.ty, size: BUILDINGS[f.type].size }));
}

/** A faint outline with corner ticks on the ground where a reclaiming people's building fell, so the site can be found and raised again. */
export class FoundationView {
  readonly mesh: THREE.LineSegments;
  private positions = new THREE.BufferAttribute(new Float32Array(MAX_FOUNDATIONS * 4 * 24 * 2 * 3), 3);
  private colors = new THREE.BufferAttribute(new Float32Array(this.positions.count * 4), 4);
  private key = '';

  constructor() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.positions.setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', this.colors.setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    this.mesh = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false, fog: false, toneMapped: false,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  /** Refresh the per-site fade about twice a second, using match ticks so pausing freezes it. */
  update(s: GameState, viewer: number, visible: (x: number, y: number) => boolean): void {
    const sites = liveFoundations(s, viewer);
    const key = `${s.tick >> 3}:${viewer}:${sites.length}`;
    if (key === this.key) return;
    this.key = key;
    let n = 0;
    const put = (x: number, y: number, alpha: number) => {
      this.positions.setXYZ(n, x, Math.max(WATER_Y, heightAt(s, x, y)) + LIFT, y);
      this.colors.setXYZW(n++, COLOR.r, COLOR.g, COLOR.b, alpha);
    };
    for (const f of sites) {
      const size = BUILDINGS[f.type].size;
      if (!visible(f.tx + size / 2, f.ty + size / 2)) continue;
      const remaining = Math.min(1, (f.until - s.tick) / secs(RECLAIM.window));
      const alpha = MIN_ALPHA + (1 - MIN_ALPHA) * remaining;
      const x0 = f.tx + 0.05, y0 = f.ty + 0.05, x1 = f.tx + size - 0.05, y1 = f.ty + size - 0.05;
      // Each side in one-tile steps so the outline follows the ground; every other step is drawn, to read as laid stones.
      for (const [ax, ay, bx, by] of [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]]) {
        const steps = size * 2;
        for (let i = 0; i < steps; i += 2) {
          put(ax + (bx - ax) * i / steps, ay + (by - ay) * i / steps, alpha);
          put(ax + (bx - ax) * (i + 1) / steps, ay + (by - ay) * (i + 1) / steps, alpha);
        }
      }
    }
    this.mesh.geometry.setDrawRange(0, n);
    this.positions.needsUpdate = true;
    this.colors.needsUpdate = true;
  }
}
