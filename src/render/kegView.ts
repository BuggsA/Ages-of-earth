import * as THREE from 'three';
import { TICK_HZ } from '../sim/data';
import type { GameState } from '../sim/types';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';
import { UNIT_SCALE } from './unitsView';

/**
 * Powder kegs (#577, the Age of Sappers): a squat oak keg bound in dark iron hoops, a twist of fuse from its bung with the
 * spark at its end. Laid at a rival building it sits by the wall and shivers as the fuse burns down; a sapper on its way
 * carries one on the shoulder. Drawn where the viewer sees now.
 */

function kegGeometry(): THREE.BufferGeometry {
  const k = new Kit();
  // The keg: staves bulging at the middle, a darker head on top.
  k.lathe([[0, 0], [0.17, 0], [0.21, 0.12], [0.22, 0.2], [0.21, 0.28], [0.17, 0.4], [0, 0.4]], 9, '#8a5a32');
  k.cyl(0.165, 0.165, 0.02, 9, '#6e4526', 0, 0.405, 0);
  for (const y of [0.06, 0.2, 0.34]) k.cyl(y === 0.2 ? 0.226 : 0.205, y === 0.2 ? 0.226 : 0.205, 0.03, 9, '#33302c', 0, y, 0);
  // The fuse, twisting up out of the bung, and its spark.
  const fuse = k.cyl(0.012, 0.012, 0.2, 4, '#d9c79a', 0.05, 0.4, 0);
  fuse.rotation.z = -0.5;
  k.octa(0.045, '#ffd34a', 0.1, 0.6, 0);
  k.octa(0.025, '#fff6c8', 0.11, 0.62, 0.01);
  return bake(k.root);
}

export class KegView {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  private ensure(n: number): THREE.InstancedMesh {
    if (!this.mesh || this.mesh.instanceMatrix.count < n) {
      if (this.mesh) this.group.remove(this.mesh);
      this.mesh = new THREE.InstancedMesh(kegGeometry(), bakedMaterial, Math.max(8, n * 2));
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.mesh.frustumCulled = false;
      this.group.add(this.mesh);
    }
    return this.mesh;
  }

  /** `sees`: the spot is in sight now; `carrierAt`: where a unit is drawn (null when out of sight). */
  update(s: GameState, sees: (x: number, y: number) => boolean, carrierAt: (id: number) => THREE.Vector3 | null): void {
    const laid = s.kegs ?? [];
    const carried = s.ents.filter((e) => e.kind === 'unit' && e.hp > 0 && !e.inside && e.order.k === 'keg');
    const mesh = this.ensure(laid.length + carried.length);
    let a = 0;
    for (const k of laid) {
      if (!sees(k.x, k.y)) continue;
      // The last seconds of the fuse: the keg shivers.
      const left = (k.at - s.tick) / TICK_HZ;
      const shake = left < 3 ? Math.sin(s.tick * 2.3 + k.id) * 0.04 * (3 - left) : 0;
      this.q.setFromAxisAngle(this.up, (k.id % 8) * (Math.PI / 4) + shake);
      this.p.set(k.x + shake * 0.3, heightAt(s, k.x, k.y), k.y);
      this.m.compose(this.p, this.q, this.sc.setScalar(1.2));
      mesh.setMatrixAt(a++, this.m);
    }
    for (const u of carried) {
      if (u.kind !== 'unit') continue;
      const at = carrierAt(u.id);
      if (!at) continue;
      this.q.setFromAxisAngle(this.up, Math.atan2(u.fx, u.fy));
      this.p.set(at.x - u.fy * 0.12, at.y + 0.74 * UNIT_SCALE, at.z + u.fx * 0.12);
      this.m.compose(this.p, this.q, this.sc.setScalar(0.5 * UNIT_SCALE));
      mesh.setMatrixAt(a++, this.m);
    }
    mesh.count = a;
    mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    if (this.mesh) this.mesh.count = 0;
  }
}
