import * as THREE from 'three';
import type { GameState } from '../sim/types';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';
import { chasm, ridge, seam, vein } from './deepModels';

/**
 * Chasms and the cracks charging toward them (#900, the Age of Faults), and the Living Earth's ridges and golden seams (#904). A chasm
 * or ridge tile is drawn once the viewer has seen it; a charging crack's seam (gold for a Heartstone's ridge or Quake) is drawn for
 * every people wherever it runs (the tremor is felt by all), throbbing as it charges. Models in `deepModels.ts`.
 */
export class ChasmView {
  readonly group = new THREE.Group();
  private pits: THREE.InstancedMesh | null = null;
  private ridges: THREE.InstancedMesh | null = null;
  private seams: THREE.InstancedMesh | null = null;
  private veins: THREE.InstancedMesh | null = null;
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
    out.castShadow = make === ridge;
    out.frustumCulled = false;
    this.group.add(out);
    return out;
  }

  /** `seenTile`: ever seen by the viewer (or everything shown, as in a replay). `now`: seconds, for the seams' throb. */
  update(s: GameState, seenTile: (x: number, y: number) => boolean, now: number): void {
    const moved = (s.cracked ?? 0) + (s.heaved ?? 0);
    if (s.chasm && moved) {
      this.pits = this.sized(this.pits, s.cracked ?? 0, chasm);
      this.ridges = this.sized(this.ridges, s.heaved ?? 0, ridge);
      let n = 0;
      let r = 0;
      for (let i = 0; i < s.chasm.length; i++) {
        const c = s.chasm[i];
        if (!c) continue;
        const x = (i % s.w) + 0.5;
        const y = Math.floor(i / s.w) + 0.5;
        if (!seenTile(x, y)) continue;
        const mesh = c === 2 ? this.ridges : this.pits;
        if ((c === 2 ? r : n) >= mesh.instanceMatrix.count) continue;
        this.q.setFromAxisAngle(this.up, (i % 4) * (Math.PI / 2));
        this.p.set(x, heightAt(s, x, y) + 0.01, y);
        this.sc.set(1, 1, 1);
        this.m.compose(this.p, this.q, this.sc);
        mesh.setMatrixAt(c === 2 ? r++ : n++, this.m);
      }
      this.pits.count = n;
      this.pits.instanceMatrix.needsUpdate = true;
      this.ridges.count = r;
      this.ridges.instanceMatrix.needsUpdate = true;
    } else {
      if (this.pits) this.pits.count = 0;
      if (this.ridges) this.ridges.count = 0;
    }
    const lines = s.faults ?? [];
    const cracks = lines.filter((f) => !f.kind);
    const golden = lines.filter((f) => f.kind);
    this.seams = this.lay(s, this.seams, cracks, seam, now);
    this.veins = this.lay(s, this.veins, golden, vein, now);
  }

  /** Draw these charges' lines with `make`'s seam, throbbing faster as each runs down and still while its vent is held. */
  private lay(s: GameState, mesh: THREE.InstancedMesh | null, lines: NonNullable<GameState['faults']>, make: (k: Kit) => void, now: number): THREE.InstancedMesh | null {
    const total = lines.reduce((a, f) => a + f.line.length, 0);
    if (!total) {
      if (mesh) mesh.count = 0;
      return mesh;
    }
    const out = this.sized(mesh, total, make);
    let n = 0;
    for (const f of lines) {
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
        out.setMatrixAt(n++, this.m);
      }
    }
    out.count = n;
    out.instanceMatrix.needsUpdate = true;
    return out;
  }

  clear(): void {
    if (this.pits) this.pits.count = 0;
    if (this.ridges) this.ridges.count = 0;
    if (this.seams) this.seams.count = 0;
    if (this.veins) this.veins.count = 0;
  }
}
