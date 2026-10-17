import * as THREE from 'three';
import { BUILDINGS } from '../sim/data';
import { ageDef } from '../sim/ages';
import { fairLevy } from '../sim/fair';
import type { GameState } from '../sim/types';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';

/**
 * Discount banners (#356): while a feast day is open, every finished building of a Fairs people that trains
 * soldiers and stands on its fairground flies a gold-and-scarlet pennant, so the player sees at a glance where
 * the levy (`fairLevy`, cheaper recruits) applies. Drawn only where the viewer has seen the spot.
 */

const POLE = '#6b4a2e';

export function bannerGeometry(): THREE.BufferGeometry {
  const k = new Kit();
  k.cyl(0.03, 0.04, 1.3, 6, POLE, 0, 0, 0);
  k.sphere(0.06, '#d8b040', 0, 1.3, 0, undefined, 5);
  // A swallow-tailed streamer in bands of scarlet and gold.
  k.box(0.02, 0.16, 0.5, '#d94a3c', 0, 0.98, 0.27);
  k.box(0.02, 0.16, 0.5, '#e8b43a', 0, 0.82, 0.27);
  k.box(0.02, 0.16, 0.34, '#d94a3c', 0, 0.66, 0.2);
  return bake(k.root);
}

export class FairBannersView {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);

  update(s: GameState, seenTile: (x: number, y: number) => boolean, time: number): void {
    let count = 0;
    const open = s.players.some((p) => ageDef(p).fairs);
    if (open) {
      const n = Math.max(16, s.ents.length);
      if (!this.mesh || this.mesh.instanceMatrix.count < n) {
        if (this.mesh) this.group.remove(this.mesh);
        this.mesh = new THREE.InstancedMesh(bannerGeometry(), bakedMaterial, n);
        this.mesh.castShadow = true;
        this.mesh.frustumCulled = false;
        this.group.add(this.mesh);
      }
      for (const e of s.ents) {
        if (count >= this.mesh.instanceMatrix.count) break;
        if (e.kind !== 'building' || !e.built || e.hp <= 0) continue;
        if (!BUILDINGS[e.type].trains.some((u) => u !== 'hero')) continue;
        if (fairLevy(s, e.owner, 'citizen', e) >= 1 || !seenTile(e.x, e.y)) continue;
        // Each streamer stirs on its own beat, so a row of banners never waves in step.
        this.q.setFromAxisAngle(this.up, Math.sin(time * 2.4 + e.id) * 0.25 + (e.id % 3) * 0.2);
        this.p.set(e.x + e.size * 0.42, heightAt(s, e.x, e.y) + e.size * 0.55, e.y + e.size * 0.42);
        this.m.compose(this.p, this.q, this.one);
        this.mesh.setMatrixAt(count++, this.m);
      }
    }
    if (this.mesh) {
      this.mesh.count = count;
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  clear(): void {
    if (this.mesh) this.mesh.count = 0;
  }
}
