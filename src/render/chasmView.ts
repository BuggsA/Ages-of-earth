import * as THREE from 'three';
import type { GameState } from '../sim/types';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';
import { chasm, seam } from './deepModels';

/**
 * Chasms and the cracks charging toward them (#900, the Age of Faults). A chasm tile is drawn once the viewer has seen it; a charging
 * crack's seam is drawn for every people wherever it runs (the tremor is felt by all), throbbing as it charges. Models in `deepModels.ts`.
 */
export class ChasmView {
  readonly group = new THREE.Group();
  private pits: THREE.InstancedMesh | null = null;
  private seams: THREE.InstancedMesh | null = null;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);

  /** An instanced mesh of `make`'s model holding at least `n`, grown by doubling. */
  private sized(mesh: THREE.InstancedMesh | null, n: number, make: (k: Kit) => void): THREE.InstancedMesh {
    if (mesh && mesh.instanceMatrix.count >= n) return mesh;
    const cap = Math.max(64, mesh ? mesh.instanceMatrix.count * 2 : 64, n);
    if (mesh) {
      this.group.remove(mesh);
      mesh.dispose();
    }
    const k = new Kit();
    make(k);
    const out = new THREE.InstancedMesh(bake(k.root), bakedMaterial, cap);
    out.receiveShadow = true;
    out.frustumCulled = false;
    this.group.add(out);
    return out;
  }

  /** `seenTile`: ever seen by the viewer (or everything shown, as in a replay). `now`: seconds, for the seams' throb. */
  update(s: GameState, seenTile: (x: number, y: number) => boolean, now: number): void {
    if (s.chasm && s.cracked) {
      this.pits = this.sized(this.pits, s.cracked, chasm);
      let n = 0;
      for (let i = 0; i < s.chasm.length && n < this.pits.instanceMatrix.count; i++) {
        if (!s.chasm[i]) continue;
        const x = (i % s.w) + 0.5;
        const y = Math.floor(i / s.w) + 0.5;
        if (!seenTile(x, y)) continue;
        this.q.setFromAxisAngle(this.up, (i % 4) * (Math.PI / 2));
        this.p.set(x, heightAt(s, x, y) + 0.01, y);
        this.sc.set(1, 1, 1);
        this.m.compose(this.p, this.q, this.sc);
        this.pits.setMatrixAt(n++, this.m);
      }
      this.pits.count = n;
      this.pits.instanceMatrix.needsUpdate = true;
    } else if (this.pits) this.pits.count = 0;
    const lines = s.faults ?? [];
    const total = lines.reduce((a, f) => a + f.line.length, 0);
    if (!total) {
      if (this.seams) this.seams.count = 0;
      return;
    }
    this.seams = this.sized(this.seams, total, seam);
    let n = 0;
    for (const f of lines) {
      // Throbbing faster as the charge runs down; still while its vent is held.
      const beat = f.held ? 0.6 : 0.75 + 0.25 * Math.sin(now * (3 + 120 / Math.max(20, f.left)));
      for (let j = 0; j < f.line.length; j++) {
        const t = f.line[j];
        const o = f.line[j + 1] ?? f.line[j - 1] ?? t;
        const along = o % s.w === t % s.w;
        const x = (t % s.w) + 0.5;
        const y = Math.floor(t / s.w) + 0.5;
        this.q.setFromAxisAngle(this.up, along ? Math.PI / 2 : 0);
        this.p.set(x, heightAt(s, x, y) + 0.02, y);
        this.sc.set(1, beat * 2, 0.6 + beat * 0.6);
        this.m.compose(this.p, this.q, this.sc);
        this.seams.setMatrixAt(n++, this.m);
      }
    }
    this.seams.count = n;
    this.seams.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    if (this.pits) this.pits.count = 0;
    if (this.seams) this.seams.count = 0;
  }
}
