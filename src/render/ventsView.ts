import * as THREE from 'three';
import type { GameState } from '../sim/types';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';
import { vent } from './deepModels';

/**
 * Vents of the earth's heat (#884, the Age of Deep Forges): one by every town and a few out on the map, drawn once the viewer has seen
 * the tile and while no Vent Forge stands over it. Neutral, everyone's; the model is `vent` in `deepModels.ts`.
 */
export class VentsView {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);

  /** `seenTile`: ever seen by the viewer (or everything shown, as in a replay). */
  update(s: GameState, seenTile: (x: number, y: number) => boolean): void {
    const vents = s.vents ?? [];
    if (!this.mesh) {
      if (!vents.length) return;
      const k = new Kit();
      vent(k);
      this.mesh = new THREE.InstancedMesh(bake(k.root), bakedMaterial, 16);
      this.mesh.receiveShadow = true;
      this.mesh.frustumCulled = false;
      this.group.add(this.mesh);
    }
    let n = 0;
    for (const t of vents) {
      if (n >= 16) break;
      const x = (t % s.w) + 0.5;
      const y = Math.floor(t / s.w) + 0.5;
      // A forge, or its foundation, stands over it: the forge draws the vent.
      if (s.bldAt[t] || !seenTile(x, y)) continue;
      this.q.setFromAxisAngle(this.up, (t % 6) * (Math.PI / 3));
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
