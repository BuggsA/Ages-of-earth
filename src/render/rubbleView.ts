import * as THREE from 'three';
import type { GameState } from '../sim/types';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';

/**
 * Rubble (#503): what a fallen building leaves for a salvaging people to strip. A low heap of broken stone, a
 * snapped beam and a few scattered planks, in neutral colours (it belongs to nobody once it falls). Drawn
 * only where the viewer sees it now, and only when the viewer's own people can strip it.
 */

export function rubbleGeometry(): THREE.BufferGeometry {
  const k = new Kit();
  k.blob(0.5, '#8d8576', 0, 0, 0).scale.set(1, 0.4, 0.85);
  for (const [x, z, r, c] of [[0.5, 0.2, 0.2, '#a39a86'], [-0.45, 0.25, 0.17, '#7a7266'], [0.1, -0.5, 0.18, '#9a917e'], [-0.2, 0.55, 0.12, '#a39a86']] as [number, number, number, string][]) k.rock(r, c, x, 0, z);
  const beam = k.box(0.9, 0.07, 0.09, '#7a5a3a', 0, 0.2, 0.05);
  beam.rotation.set(0.1, 0.5, 0.35);
  k.box(0.5, 0.04, 0.08, '#8a6a46', -0.3, 0.05, -0.4).rotation.y = -0.4;
  k.box(0.42, 0.04, 0.08, '#8a6a46', 0.55, 0.05, -0.15).rotation.y = 1.1;
  return bake(k.root);
}

export class RubbleView {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);

  /** `show`: whether the viewer's people can strip rubble at all; `sees`: the spot is in sight now. */
  update(s: GameState, show: boolean, sees: (x: number, y: number) => boolean): void {
    const rubble = show ? (s.rubble ?? []) : [];
    const n = Math.max(4, rubble.length);
    if (!this.mesh || this.mesh.instanceMatrix.count < n) {
      if (this.mesh) this.group.remove(this.mesh);
      this.mesh = new THREE.InstancedMesh(rubbleGeometry(), bakedMaterial, n);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.mesh.frustumCulled = false;
      this.group.add(this.mesh);
    }
    let a = 0;
    for (const r of rubble) {
      if (!sees(r.x, r.y)) continue;
      this.q.setFromAxisAngle(this.up, (r.id % 8) * (Math.PI / 4));
      this.p.set(r.x, heightAt(s, r.x, r.y), r.y);
      this.m.compose(this.p, this.q, this.one);
      this.mesh.setMatrixAt(a++, this.m);
    }
    this.mesh.count = a;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    if (this.mesh) this.mesh.count = 0;
  }
}
