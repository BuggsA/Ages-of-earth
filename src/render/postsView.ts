import * as THREE from 'three';
import { TRADE } from '../sim/data';
import type { GameState } from '../sim/types';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';

/**
 * Trading posts: a caravanserai plaza of packed earth round a well, with striped pavilions over
 * stalls of rugs, jars and spices, a resting camel and tall pennants, all in neutral colours (they
 * belong to nobody). Drawn once the viewer has seen the spot; the fog greys them like the land.
 */

const EARTH = '#c2a77a';
const STONE = '#a89a86';
const POLE = '#6b4a2e';
const CLOTH = '#efe4c8';

/** A pavilion: four poles, a two-tone roof with a striped valance, a counter of wares beneath. */
function pavilion(k: Kit, x: number, z: number, turn: number, a: string, b: string): void {
  const g = k.group(x, 0, z);
  g.rotation.y = turn;
  for (const [px, pz] of [[-0.42, -0.32], [0.42, -0.32], [-0.42, 0.32], [0.42, 0.32]]) k.cyl(0.025, 0.03, 0.85, 5, POLE, px, 0, pz, g);
  k.pyramid(1.0, 0.32, 0.8, a, 0, 0.85, 0, g);
  k.pyramid(0.5, 0.18, 0.4, b, 0, 1.08, 0, g);
  for (let i = 0; i < 5; i++) {
    const c = i % 2 ? a : b;
    k.box(0.2, 0.09, 0.02, c, -0.4 + i * 0.2, 0.76, 0.4, g);
    k.box(0.2, 0.09, 0.02, c, -0.4 + i * 0.2, 0.76, -0.4, g);
  }
  // A counter, and wares on it and before it.
  k.box(0.7, 0.28, 0.24, '#8a6440', 0, 0, -0.12, g);
  k.box(0.72, 0.03, 0.26, CLOTH, 0, 0.28, -0.12, g);
  for (const [dx, c] of [[-0.24, '#b05a30'], [-0.08, '#e0a030'], [0.08, '#6e5a3a'], [0.24, '#5a8a3a']] as [number, string][]) {
    k.cyl(0.06, 0.05, 0.05, 7, '#b08a4e', dx, 0.31, -0.12, g);
    k.sphere(0.05, c, dx, 0.37, -0.12, g, 5).scale.set(1, 0.5, 1);
  }
  k.lathe([[0, 0], [0.07, 0.02], [0.09, 0.12], [0.05, 0.22], [0.06, 0.25]], 8, '#b8673a', 0.2, 0, 0.2, g);
  k.lathe([[0, 0], [0.06, 0.02], [0.08, 0.1], [0.04, 0.19], [0.05, 0.21]], 8, '#d8b07a', 0.36, 0, 0.14, g);
  k.glow(k.sphere(0.04, '#ffd27a', 0.42, 0.66, 0.32, g, 5));
}

function camel(k: Kit, x: number, z: number, turn: number): void {
  const g = k.group(x, 0, z);
  g.rotation.y = turn;
  const coat = '#c89a62';
  for (const [lx, lz] of [[-0.06, 0.16], [0.06, 0.16], [-0.06, -0.16], [0.06, -0.16]]) k.box(0.045, 0.36, 0.05, coat, lx, 0, lz, g);
  k.box(0.18, 0.16, 0.46, coat, 0, 0.36, 0, g);
  k.sphere(0.11, coat, 0, 0.55, -0.02, g, 6).scale.set(0.8, 0.9, 1.2);
  // A saddle blanket, the long neck and the head.
  k.box(0.2, 0.04, 0.2, '#a83a2e', 0, 0.5, 0.12, g);
  const neck = k.box(0.07, 0.3, 0.08, coat, 0, 0.42, 0.26, g);
  neck.rotation.x = 0.5;
  k.box(0.08, 0.08, 0.18, coat, 0, 0.66, 0.38, g);
  k.box(0.03, 0.18, 0.03, '#5a4632', 0, 0.3, -0.24, g).rotation.x = -0.3;
}

function pennant(k: Kit, x: number, z: number, h: number, color: string): void {
  k.cyl(0.03, 0.04, h, 6, POLE, x, 0, z);
  k.sphere(0.05, '#d8b040', x, h + 0.02, z, undefined, 5);
  const flag = k.box(0.02, 0.22, 0.6, color, x, h - 0.3, z + 0.3);
  flag.rotation.x = 0.08;
  k.box(0.02, 0.1, 0.25, color, x, h - 0.25, z + 0.7);
}

function postGeometry(): THREE.BufferGeometry {
  const k = new Kit();
  const half = TRADE.plaza + 0.6;
  // Packed earth, sunk a little so it meets the ground all round, and a kerb of stones.
  k.box(half * 2, 0.26, half * 2, EARTH, 0, -0.2, 0);
  for (let i = 0; i < 8; i++) {
    const t = -half + 0.2 + (i / 7) * (half * 2 - 0.4);
    for (const [x, z] of [[t, -half], [t, half], [-half, t], [half, t]]) k.rock(0.09, STONE, x, 0.04, z);
  }
  // The well in the middle, with its little roof.
  k.cyl(0.3, 0.34, 0.3, 10, STONE, 0, 0, 0);
  k.cyl(0.24, 0.24, 0.02, 10, '#2a4a5a', 0, 0.28, 0);
  for (const x of [-0.26, 0.26]) k.box(0.05, 0.62, 0.05, POLE, x, 0.28, 0);
  k.box(0.6, 0.04, 0.05, POLE, 0, 0.86, 0);
  k.prism(0.7, 0.2, 0.5, '#8a5a3a', 0, 0.9, 0);
  k.cyl(0.05, 0.04, 0.08, 6, '#8a6440', 0.05, 0.6, 0);
  // Pavilions on three sides, rugs and goods between them.
  pavilion(k, -0.95, -0.85, 0.3, '#a8683a', CLOTH);
  pavilion(k, 0.95, -0.8, -0.35, '#5e6a48', CLOTH);
  pavilion(k, -1.0, 0.9, Math.PI - 0.4, '#c9a45a', '#6e4a30');
  k.box(0.5, 0.03, 0.34, '#8a5a3a', 0.6, 0.05, 0.5).rotation.y = 0.4;
  k.box(0.46, 0.05, 0.3, '#4a4a3a', 0.62, 0.08, 0.52).rotation.y = 0.5;
  for (const [x, z] of [[0.15, 1.15], [0.35, 1.2], [0.25, 1.0]]) k.sphere(0.12, '#d8c08a', x, 0.08, z, undefined, 6).scale.set(1, 0.75, 1);
  k.box(0.26, 0.24, 0.26, '#a07a4a', 1.15, 0.05, 0.1);
  k.box(0.2, 0.18, 0.2, '#8a6440', 1.2, 0.29, 0.12);
  camel(k, 1.05, 1.0, -0.6);
  pennant(k, 1.35, -1.35, 3.0, '#e8dcb8');
  pennant(k, -1.45, 0.0, 2.2, '#8a6a44');
  return bake(k.root);
}

export class PostsView {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);

  update(s: GameState, seenTile: (x: number, y: number) => boolean): void {
    const n = Math.max(4, s.posts.length);
    if (!this.mesh || this.mesh.instanceMatrix.count < n) {
      if (this.mesh) this.group.remove(this.mesh);
      this.mesh = new THREE.InstancedMesh(postGeometry(), bakedMaterial, n);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.mesh.frustumCulled = false;
      this.group.add(this.mesh);
    }
    let count = 0;
    for (const post of s.posts) {
      if (!seenTile(post.x, post.y)) continue;
      const gy = heightAt(s, post.x, post.y);
      // Each faces its own way, so no two look the same.
      this.q.setFromAxisAngle(this.up, (post.id % 4) * (Math.PI / 2));
      this.p.set(post.x, gy, post.y);
      this.m.compose(this.p, this.q, this.one);
      this.mesh.setMatrixAt(count++, this.m);
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    if (this.mesh) this.mesh.count = 0;
  }
}
