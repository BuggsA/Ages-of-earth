import * as THREE from 'three';
import type { GameState } from '../sim/types';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';

/**
 * Spring heads (#701 s1, the Water Road): where water wells up out of the ground by a town with no lake or shore near. A ring of
 * mossy stones round a small bright pool, water spilling over a lip, reeds and a few flowers: neutral, everyone's, drawn once the
 * viewer has seen the tile. When a channel is dug from it, it opens into the water and is gone.
 */
function springModel(): THREE.BufferGeometry {
  const k = new Kit();
  // The ground worn round it, then the pool, a shade brighter where the water wells up in the middle.
  k.cyl(0.62, 0.68, 0.03, 9, '#6b5a3c', 0, -0.01, 0);
  k.cyl(0.42, 0.44, 0.03, 9, '#3f7f9e', 0, 0.01, 0);
  k.cyl(0.16, 0.18, 0.031, 7, '#7fc4d8', 0.04, 0.012, -0.03);
  // The ring of stones, one missing where the water spills out.
  const stones: [number, number, number][] = [[0.48, 0, 0.12], [0.34, 0.34, 0.1], [0, 0.5, 0.13], [-0.36, 0.34, 0.11], [-0.5, 0, 0.12], [-0.34, -0.36, 0.1], [0.02, -0.5, 0.11]];
  stones.forEach(([x, z, r], i) => k.rock(r, i % 2 ? '#8d8a82' : '#76736b', x, 0.02, z));
  for (const [x, z] of [[0.35, 0.36], [-0.5, 0.02]]) k.blob(0.06, '#5f7a3a', x, 0.1, z).scale.set(1.4, 0.4, 1.4);
  // The spill over the lip, running out to the south-east.
  k.box(0.18, 0.02, 0.32, '#5d9fbd', 0.38, 0.0, -0.4).rotation.y = 0.7;
  // Reeds and a few flowers.
  for (const [x, z, h] of [[-0.62, 0.3, 0.36], [-0.56, 0.42, 0.28], [0.58, 0.32, 0.32], [0.18, 0.62, 0.3]]) k.cone(0.025, h, 3, '#6f8a45', x, 0, z);
  for (const [x, z] of [[-0.66, -0.2], [0.62, 0.05]]) k.sphere(0.035, '#f2e48a', x, 0.05, z);
  return bake(k.root);
}

export class SpringsView {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private one = new THREE.Vector3(1.3, 1.3, 1.3);
  private up = new THREE.Vector3(0, 1, 0);

  /** `seenTile`: ever seen by the viewer (or everything shown, as in a replay). */
  update(s: GameState, seenTile: (x: number, y: number) => boolean): void {
    const springs = s.springs ?? [];
    if (!this.mesh) {
      if (!springs.length) return;
      this.mesh = new THREE.InstancedMesh(springModel(), bakedMaterial, 8);
      this.mesh.receiveShadow = true;
      this.mesh.frustumCulled = false;
      this.group.add(this.mesh);
    }
    let n = 0;
    for (const t of springs) {
      if (n >= 8) break;
      const x = (t % s.w) + 0.5;
      const y = Math.floor(t / s.w) + 0.5;
      if (!seenTile(x, y)) continue;
      this.q.setFromAxisAngle(this.up, (t % 4) * (Math.PI / 2));
      this.p.set(x, heightAt(s, x, y), y);
      this.m.compose(this.p, this.q, this.one);
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    if (this.mesh) this.mesh.count = 0;
  }
}
