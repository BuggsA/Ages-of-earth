import * as THREE from 'three';
import { FLOCK, secs } from '../sim/data';
import { seasonOf } from '../sim/seasons';
import type { GameState } from '../sim/types';
import { heightAt } from './terrain';

const LIFT = 0.025;
const STUBBLE = new THREE.Color('#9c8458');

/**
 * Grass cropped by the flocks (#308): each bare tile a patch of dry stubble over the meadow, strongest
 * when fresh and fading as it grows back, so a grazed-out camp shows at a glance. Only where the viewer
 * has explored; redrawn about once a second.
 */
export class GrazeView {
  readonly mesh: THREE.Mesh;
  private key = '';

  constructor() {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({
      vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.receiveShadow = true;
    this.mesh.visible = false;
  }

  update(s: GameState, viewer: number, reveal: boolean): void {
    const g = s.grazed;
    this.mesh.visible = !!g;
    if (!g) return;
    const key = `${s.tick >> 4}:${viewer}:${reveal}`;
    if (key === this.key) return;
    this.key = key;
    const seen = s.players[viewer]?.seen;
    const full = secs(FLOCK.regrow / seasonOf(s).grass);
    const pos: number[] = [];
    const rgba: number[] = [];
    for (let i = 0; i < g.length; i++) {
      const left = g[i] - s.tick;
      if (left <= 0 || (!reveal && seen && !seen[i])) continue;
      const x = i % s.w;
      const y = Math.floor(i / s.w);
      // Mottled, and edge to edge with its neighbours, so a grazed meadow reads as one worn patch, not a grid.
      const j = ((i * 2654435761) >>> 0) / 4294967296;
      const a = (0.12 + 0.34 * Math.min(1, left / full)) * (0.75 + j * 0.5);
      const corner = (cx: number, cy: number) => {
        pos.push(cx, heightAt(s, cx, cy) + LIFT, cy);
        rgba.push(STUBBLE.r, STUBBLE.g, STUBBLE.b, a);
      };
      corner(x, y); corner(x, y + 1); corner(x + 1, y + 1);
      corner(x, y); corner(x + 1, y + 1); corner(x + 1, y);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(rgba), 4));
    geo.computeVertexNormals();
    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
  }
}
