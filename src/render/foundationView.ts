import * as THREE from 'three';
import { BUILDINGS } from '../sim/data';
import type { BuildingType, GameState } from '../sim/types';
import { heightAt } from './terrain';
import { WATER_Y } from './water';

/** Presentation limit, not balance: the most foundations drawn at once. */
export const MAX_FOUNDATIONS = 32;
const LIFT = 0.06;
const COLOR = new THREE.Color('#d9c9a0');

export interface FoundationSite {
  type: BuildingType;
  tx: number;
  ty: number;
  size: number;
}

/** The viewer's own remembered footprints (the Age of Reclaimers, `reclaim.ts`): only theirs, never a rival's. */
export function foundationSites(s: GameState, viewer: number): FoundationSite[] {
  const out: FoundationSite[] = [];
  for (const f of s.fallen ?? []) {
    if (f.owner !== viewer || f.until <= s.tick) continue;
    out.push({ type: f.type, tx: f.tx, ty: f.ty, size: BUILDINGS[f.type].size });
    if (out.length >= MAX_FOUNDATIONS) break;
  }
  return out;
}

/** A faint outline with corner ticks on the ground where a reclaiming people's building fell, so the site can be found and raised again. */
export class FoundationView {
  readonly mesh: THREE.LineSegments;
  private positions = new THREE.BufferAttribute(new Float32Array(MAX_FOUNDATIONS * 4 * 24 * 2 * 3), 3);
  private key = '';

  constructor() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.positions.setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    this.mesh = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      color: COLOR, transparent: true, opacity: 0.6, depthWrite: false, fog: false, toneMapped: false,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }

  /** Redraw about twice a second; the list only changes when a building falls or is raised. */
  update(s: GameState, viewer: number, visible: (x: number, y: number) => boolean): void {
    const sites = foundationSites(s, viewer);
    const key = `${s.tick >> 3}:${viewer}:${sites.length}`;
    if (key === this.key) return;
    this.key = key;
    let n = 0;
    const put = (x: number, y: number) => this.positions.setXYZ(n++, x, Math.max(WATER_Y, heightAt(s, x, y)) + LIFT, y);
    for (const f of sites) {
      if (!visible(f.tx + f.size / 2, f.ty + f.size / 2)) continue;
      const x0 = f.tx + 0.05, y0 = f.ty + 0.05, x1 = f.tx + f.size - 0.05, y1 = f.ty + f.size - 0.05;
      // Each side in one-tile steps so the outline follows the ground; every other step is drawn, to read as laid stones.
      for (const [ax, ay, bx, by] of [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]]) {
        const steps = f.size * 2;
        for (let i = 0; i < steps; i += 2) {
          put(ax + (bx - ax) * i / steps, ay + (by - ay) * i / steps);
          put(ax + (bx - ax) * (i + 1) / steps, ay + (by - ay) * (i + 1) / steps);
        }
      }
    }
    this.mesh.geometry.setDrawRange(0, n);
    this.positions.needsUpdate = true;
  }
}
