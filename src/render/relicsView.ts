import * as THREE from 'three';
import type { GameState } from '../sim/types';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';
import { UNIT_SCALE } from './unitsView';

/**
 * Relics: a gilded casket on a weathered stone plinth where one lies on the ground, the casket alone
 * held high over the head of the priest carrying it, and kept relics turning slowly in a ring of light
 * above their Temple's roof (one casket for each, so a Temple's worth can be read from afar).
 */

function casket(k: Kit, y: number, s = 1): void {
  const g = k.group(0, y, 0);
  g.scale.setScalar(s);
  k.box(0.3, 0.16, 0.2, '#c9962e', 0, 0, 0, g);
  k.box(0.32, 0.03, 0.22, '#8a5a1c', 0, 0.06, 0, g);
  // A ridged lid, a cross-band and a jewel that catches the light.
  k.prism(0.3, 0.09, 0.2, '#e3b448', 0, 0.16, 0, g);
  k.box(0.04, 0.17, 0.215, '#f2cf6a', 0, 0, 0, g);
  k.glow(k.octa(0.04, '#ffe9a0', 0, 0.28, 0, g));
  k.glow(k.sphere(0.022, '#ff6a5a', 0.1, 0.09, 0.105, g, 5));
  k.glow(k.sphere(0.022, '#7ad7ff', -0.1, 0.09, 0.105, g, 5));
  for (const x of [-0.12, 0.12]) for (const z of [-0.08, 0.08]) k.sphere(0.025, '#8a5a1c', x, 0, z, g, 4);
}

function groundRelic(): THREE.BufferGeometry {
  const k = new Kit();
  // A worn plinth with a step, moss in the cracks.
  k.box(0.56, 0.08, 0.5, '#8f8a80', 0, 0, 0);
  k.box(0.44, 0.16, 0.38, '#a7a196', 0, 0.08, 0);
  k.box(0.1, 0.02, 0.12, '#6f8f4a', 0.17, 0.08, 0.17);
  k.box(0.08, 0.02, 0.06, '#6f8f4a', -0.2, 0.08, -0.18);
  casket(k, 0.24);
  // A tall stake with a pale ivory pennon (gold is a player's colour): a casket is small, and a relic in the grass is worth finding.
  k.cyl(0.015, 0.015, 1.0, 4, '#e8dcc0', -0.3, 0, -0.22);
  k.glow(k.box(0.3, 0.17, 0.02, '#f4ead0', -0.15, 0.82, -0.22));
  return bake(k.root);
}

function heldRelic(): THREE.BufferGeometry {
  const k = new Kit();
  casket(k, 0, 0.8);
  return bake(k.root);
}

class Instances {
  readonly mesh: THREE.InstancedMesh;
  count = 0;
  constructor(geo: THREE.BufferGeometry, cap: number, parent: THREE.Object3D) {
    this.mesh = new THREE.InstancedMesh(geo, bakedMaterial, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    parent.add(this.mesh);
  }
}

export interface RelicScreen {
  id: number;
  sx: number;
  sy: number;
  r: number;
}

export class RelicsView {
  readonly group = new THREE.Group();
  /** Where each relic lying on the ground landed on screen this frame, for picking. */
  readonly screen: RelicScreen[] = [];
  /** Ground relics drawn this frame, for sparkles. */
  readonly onGround: THREE.Vector3[] = [];
  private ground: Instances | null = null;
  private held: Instances | null = null;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private v = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  /**
   * `seenTile` says whether the viewer knows a spot of ground; `carrierAt` where a carrier is drawn
   * (null when out of sight); `templeTop` the top of a Temple the viewer can see (null otherwise).
   */
  update(
    s: GameState,
    time: number,
    camera: THREE.Camera,
    width: number,
    height: number,
    seenTile: (x: number, y: number) => boolean,
    carrierAt: (id: number) => THREE.Vector3 | null,
    templeTop: (id: number) => THREE.Vector3 | null,
  ): void {
    const n = Math.max(8, s.relics.length);
    if (!this.ground || this.ground.mesh.instanceMatrix.count < n) {
      if (this.ground) this.group.remove(this.ground.mesh);
      if (this.held) this.group.remove(this.held.mesh);
      this.ground = new Instances(groundRelic(), n, this.group);
      this.held = new Instances(heldRelic(), n, this.group);
    }
    const g = this.ground;
    const h = this.held!;
    g.count = 0;
    h.count = 0;
    this.screen.length = 0;
    this.onGround.length = 0;
    const kept = new Map<number, number>();
    for (const r of s.relics) {
      if (r.temple) {
        const top = templeTop(r.temple);
        if (!top) continue;
        // Kept relics ride round a ring above the roof.
        const k = kept.get(r.temple) ?? 0;
        kept.set(r.temple, k + 1);
        const total = s.relics.filter((o) => o.temple === r.temple).length;
        const a = time * 0.5 + (k / total) * Math.PI * 2;
        const rad = total > 1 ? 0.75 : 0;
        this.q.setFromAxisAngle(this.up, -a);
        this.p.set(top.x + Math.cos(a) * rad, top.y + 0.55 + Math.sin(time * 1.6 + k) * 0.06, top.z + Math.sin(a) * rad);
        this.m.compose(this.p, this.q, this.sc.setScalar(UNIT_SCALE));
        h.mesh.setMatrixAt(h.count++, this.m);
      } else if (r.carrier) {
        const at = carrierAt(r.carrier);
        if (!at) continue;
        this.q.setFromAxisAngle(this.up, time * 0.8);
        this.p.set(at.x, at.y + 0.95 * UNIT_SCALE + Math.sin(time * 3 + r.id) * 0.03, at.z);
        this.m.compose(this.p, this.q, this.sc.setScalar(UNIT_SCALE * 0.85));
        h.mesh.setMatrixAt(h.count++, this.m);
      } else {
        if (!seenTile(r.x, r.y)) continue;
        const gy = heightAt(s, r.x, r.y);
        this.q.setFromAxisAngle(this.up, (r.id % 8) * 0.7);
        this.p.set(r.x, gy, r.y);
        this.m.compose(this.p, this.q, this.sc.setScalar(UNIT_SCALE));
        g.mesh.setMatrixAt(g.count++, this.m);
        this.onGround.push(this.p.clone());
        this.v.set(r.x, gy + 0.4, r.y).project(camera);
        if (this.v.z < 1) this.screen.push({ id: r.id, sx: ((this.v.x + 1) / 2) * width, sy: ((1 - this.v.y) / 2) * height, r: Math.max(12, 420 / Math.max(1, camera.position.distanceTo(this.p))) });
      }
    }
    for (const it of [g, h]) {
      it.mesh.count = it.count;
      it.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  clear(): void {
    this.screen.length = 0;
    this.onGround.length = 0;
    if (this.ground) this.ground.mesh.count = 0;
    if (this.held) this.held.mesh.count = 0;
  }
}
