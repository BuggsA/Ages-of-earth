import * as THREE from 'three';
import type { GameState } from '../sim/types';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';
import { UNIT_SCALE } from './unitsView';

/**
 * Fire (`src/sim/fire.ts`): tongues of flame, red at the root and white-gold at the tip, glowing at dusk, that lick and shiver on
 * every burning tree and living building; a pall of smoke drifting up from them; and a pitch torch in the fist of everyone carrying
 * one. Drawn where the viewer sees now, one instanced draw each.
 */

function flameGeometry(): THREE.BufferGeometry {
  const k = new Kit();
  k.glow(k.cone(0.24, 0.55, 5, '#d8401a', 0, 0, 0));
  k.glow(k.cone(0.17, 0.75, 5, '#ff8a26', 0.05, 0, 0.03));
  k.glow(k.cone(0.09, 0.9, 4, '#ffd65a', -0.02, 0.05, -0.01));
  k.glow(k.cone(0.1, 0.42, 4, '#ff6a20', -0.17, 0, 0.08));
  k.glow(k.cone(0.08, 0.36, 4, '#ffb03a', 0.15, 0, -0.12));
  k.glow(k.octa(0.035, '#fff3c0', 0.02, 1.02, 0));
  return bake(k.root);
}

function torchGeometry(): THREE.BufferGeometry {
  const k = new Kit();
  k.cyl(0.025, 0.03, 0.5, 5, '#5a3a20');
  k.cyl(0.045, 0.04, 0.1, 5, '#2b211a', 0, 0.45);
  k.glow(k.cone(0.07, 0.22, 5, '#ff8a26', 0, 0.55));
  k.glow(k.cone(0.035, 0.28, 4, '#ffe07a', 0, 0.56));
  return bake(k.root);
}

export class FireView {
  readonly group = new THREE.Group();
  private flames: THREE.InstancedMesh | null = null;
  private torches: THREE.InstancedMesh | null = null;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private lean = new THREE.Vector3();
  private time = 0;
  private puff = 0;

  private mesh(kind: 'flames' | 'torches', n: number): THREE.InstancedMesh {
    let mesh = this[kind];
    if (!mesh || mesh.instanceMatrix.count < n) {
      if (mesh) this.group.remove(mesh);
      mesh = new THREE.InstancedMesh(kind === 'flames' ? flameGeometry() : torchGeometry(), bakedMaterial, Math.max(16, n * 2));
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this[kind] = mesh;
    }
    return mesh;
  }

  /** One flame, swaying on its own beat so a burning wood never moves as one. */
  private flame(mesh: THREE.InstancedMesh, a: number, x: number, y: number, z: number, size: number, seed: number): void {
    const t = this.time * 7 + seed * 1.7;
    const lick = 1 + 0.22 * Math.sin(t) + 0.1 * Math.sin(t * 2.3 + 1);
    this.q.setFromAxisAngle(this.up, seed * 0.9 + this.time * 0.6);
    this.p.set(x + 0.04 * Math.sin(t * 0.8), y, z + 0.04 * Math.cos(t * 0.7));
    this.m.compose(this.p, this.q, this.sc.set(size * (1.1 - 0.1 * lick), size * lick, size * (1.1 - 0.1 * lick)));
    mesh.setMatrixAt(a, this.m);
  }

  /**
   * `sees`: the spot is in sight now; `carrierAt`: where a unit is drawn (null when out of sight); `smoke`: a puff rises at a point
   * (`big` over a burning building).
   */
  update(s: GameState, dt: number, sees: (x: number, y: number) => boolean, carrierAt: (id: number) => THREE.Vector3 | null, smoke: (at: THREE.Vector3, big: boolean) => void): void {
    this.time += dt;
    this.puff += dt;
    const fires = s.fires ?? [];
    let n = 0;
    for (const f of fires) {
      const e = f.b !== undefined ? s.byId.get(f.b) : undefined;
      n += e && e.kind === 'building' ? e.size * e.size : 1;
    }
    const flames = this.mesh('flames', n);
    let a = 0;
    const puffing = this.puff >= 0.3;
    if (puffing) this.puff = 0;
    for (const f of fires) {
      const e = f.b !== undefined ? s.byId.get(f.b) : undefined;
      if (e && e.kind === 'building') {
        if (!sees(e.x, e.y)) continue;
        for (let y = e.ty; y < e.ty + e.size; y++)
          for (let x = e.tx; x < e.tx + e.size; x++) {
            const g = heightAt(s, x + 0.5, y + 0.5);
            this.flame(flames, a++, x + 0.5, g + 0.15, y + 0.5, 1.1 + 0.15 * ((x * 7 + y * 3) % 3), x * 31 + y * 17);
          }
        if (puffing) smoke(this.p.set(e.x, heightAt(s, e.x, e.y) + 1, e.y).clone(), true);
        continue;
      }
      const tx = (f.tile % s.w) + 0.5;
      const ty = Math.floor(f.tile / s.w) + 0.5;
      if (!sees(tx, ty)) continue;
      const g = heightAt(s, tx, ty);
      // A tree burns from the crown down: high and fierce at first, low as it falls to ash.
      this.flame(flames, a++, tx, g + 0.35, ty, 1.5, f.tile);
      if (puffing && (f.tile + Math.floor(this.time * 3)) % 3 === 0) smoke(this.p.set(tx, g + 1.6, ty).clone(), false);
    }
    flames.count = a;
    flames.instanceMatrix.needsUpdate = true;

    let carrying = 0;
    for (const e of s.ents) if (e.kind === 'unit' && e.hp > 0 && !e.inside && e.order.k === 'torch') carrying++;
    const torches = this.mesh('torches', carrying);
    let b = 0;
    if (carrying) {
      for (const u of s.ents) {
        if (u.kind !== 'unit' || u.hp <= 0 || u.inside || u.order.k !== 'torch') continue;
        const at = carrierAt(u.id);
        if (!at) continue;
        // Held up in the right fist, leaning out ahead.
        this.q.setFromAxisAngle(this.lean.set(u.fy, 0, -u.fx), 0.35);
        this.p.set(at.x + u.fy * 0.16 * UNIT_SCALE, at.y + 0.35 * UNIT_SCALE, at.z - u.fx * 0.16 * UNIT_SCALE);
        this.m.compose(this.p, this.q, this.sc.setScalar(UNIT_SCALE));
        torches.setMatrixAt(b++, this.m);
      }
    }
    torches.count = b;
    torches.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    if (this.flames) this.flames.count = 0;
    if (this.torches) this.torches.count = 0;
  }
}
