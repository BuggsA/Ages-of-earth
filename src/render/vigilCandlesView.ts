import * as THREE from 'three';
import { VIGIL } from '../sim/data';
import { vigilGold } from '../sim/vigil';
import type { Building, GameState } from '../sim/types';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';

/**
 * Vigil candles (#356): a Temple that keeps a relic lights one candle at its door for each priest keeping vigil
 * beside it (`vigilGold`), up to `VIGIL.most`, so the player sees the shrine is watched and what it pays.
 * Drawn only where the viewer has seen the spot.
 */

export function candleGeometry(): THREE.BufferGeometry {
  const k = new Kit();
  k.cyl(0.07, 0.08, 0.32, 7, '#efe6cf', 0, 0, 0);
  k.cone(0.06, 0.2, 5, '#ffc94a', 0, 0.32, 0);
  k.sphere(0.035, '#fff3b0', 0, 0.4, 0, undefined, 5);
  return bake(k.root);
}

export class VigilCandlesView {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();

  update(s: GameState, seenTile: (x: number, y: number) => boolean, time: number): void {
    let count = 0;
    if (s.relics.length) {
      const n = VIGIL.most * Math.max(8, s.relics.length);
      if (!this.mesh || this.mesh.instanceMatrix.count < n) {
        if (this.mesh) this.group.remove(this.mesh);
        this.mesh = new THREE.InstancedMesh(candleGeometry(), bakedMaterial, n);
        this.mesh.frustumCulled = false;
        this.group.add(this.mesh);
      }
      const seen = new Set<number>();
      for (const r of s.relics) {
        const t = r.temple ? s.byId.get(r.temple) : undefined;
        if (!t || t.kind !== 'building' || seen.has(t.id) || !seenTile(t.x, t.y)) continue;
        seen.add(t.id);
        const lit = Math.round(vigilGold(s, t as Building) / VIGIL.each);
        for (let i = 0; i < lit && count < this.mesh.instanceMatrix.count; i++) {
          // The candles stand in a row across the door, each guttering on its own beat.
          const flick = 1 + Math.sin(time * 9 + t.id * 3 + i * 2.1) * 0.08;
          this.p.set(t.x + (i - (VIGIL.most - 1) / 2) * 0.4, heightAt(s, t.x, t.y) + 0.05, t.y + t.size * 0.55);
          this.sc.set(1, flick, 1);
          this.m.compose(this.p, this.q, this.sc);
          this.mesh.setMatrixAt(count++, this.m);
        }
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
