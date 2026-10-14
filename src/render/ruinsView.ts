import * as THREE from 'three';
import type { GameState } from '../sim/types';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';

/**
 * Ancient ruins (#64): a broken colonnade of weathered limestone, one column still bearing a cracked
 * lintel, drums of fallen ones and rubble in the grass, moss in the joints, all in neutral colours (they
 * belong to nobody). Once dug out: an open pit ringed by spoil heaps, a ladder and a few cleaned
 * stones set in a row. Drawn once the viewer has seen the spot, as it was when last seen.
 */

const LIME = '#c8bea8';
const LIME_DARK = '#a39a86';
const WORN = '#b4ab96';
const MOSS = '#6f8a4a';
const EARTH = '#7a5f42';
const EARTH_DARK = '#4e3c2a';

/** A fluted column: a base, a shaft of drums (each a touch off true), and a capital if `cap`. */
function column(k: Kit, x: number, z: number, drums: number, cap: boolean): void {
  k.box(0.34, 0.08, 0.34, LIME_DARK, x, 0, z);
  for (let i = 0; i < drums; i++) {
    const d = k.cyl(0.12, 0.13, 0.26, 8, i % 2 ? LIME : WORN, x + (i % 2 ? 0.008 : -0.006), 0.08 + i * 0.26, z);
    d.rotation.y = i * 0.4;
  }
  const top = 0.08 + drums * 0.26;
  if (cap) {
    k.cyl(0.17, 0.12, 0.07, 8, WORN, x, top, z);
    k.box(0.36, 0.06, 0.36, LIME, x, top + 0.07, z);
  } else {
    // A broken top, jagged.
    k.rock(0.1, LIME_DARK, x + 0.03, top, z);
  }
}

export function ruinGeometry(): THREE.BufferGeometry {
  const k = new Kit();
  // The old floor: cracked flags sunk into the ground, half lost under turf.
  for (const [x, z, w, d] of [[-0.5, -0.4, 0.5, 0.42], [0.05, -0.45, 0.46, 0.38], [0.52, -0.3, 0.4, 0.44], [-0.45, 0.15, 0.44, 0.5], [0.15, 0.1, 0.52, 0.46], [0.6, 0.3, 0.3, 0.36]]) {
    k.box(w, 0.06, d, LIME_DARK, x, -0.03, z);
  }
  k.box(0.22, 0.02, 0.18, MOSS, -0.2, 0.03, -0.18);
  k.box(0.16, 0.02, 0.2, MOSS, 0.42, 0.03, 0.05);
  // Two columns still standing with the lintel across, one stump, one fallen.
  column(k, -0.62, -0.55, 6, true);
  column(k, 0.38, -0.6, 5, true);
  const lintel = k.box(1.22, 0.16, 0.26, LIME, -0.1, 0.08 + 6 * 0.26 + 0.12, -0.57);
  // It has slipped where the shorter column gave way.
  lintel.rotation.z = -0.21;
  lintel.position.y -= 0.12;
  k.box(0.14, 0.02, 0.27, MOSS, -0.5, 0.08 + 6 * 0.26 + 0.17, -0.57).rotation.z = -0.21;
  column(k, 0.72, 0.5, 2, false);
  for (let i = 0; i < 4; i++) {
    const d = k.cyl(0.12, 0.13, 0.26, 8, i % 2 ? WORN : LIME, -0.85 + i * 0.27, 0, 0.62 - i * 0.05);
    d.rotation.z = Math.PI / 2;
    d.rotation.y = 0.18 * i;
  }
  // A carved block face down, a capital in the grass, rubble.
  k.box(0.4, 0.2, 0.28, WORN, 0.05, 0, 0.52).rotation.y = 0.5;
  k.box(0.18, 0.03, 0.12, '#8a6a3a', 0.06, 0.2, 0.52).rotation.y = 0.5;
  k.cyl(0.17, 0.12, 0.08, 8, LIME, -0.1, 0.02, -0.05).rotation.x = 0.4;
  for (const [x, z, r] of [[0.95, -0.1, 0.09], [-0.95, -0.05, 0.08], [0.25, 0.88, 0.07], [-0.4, 0.95, 0.06], [0.9, 0.85, 0.06]]) k.rock(r, LIME_DARK, x, 0.02, z);
  // Weeds growing through.
  for (const [x, z] of [[-0.3, -0.7], [0.55, -0.05], [-0.7, 0.35], [0.3, 0.32]]) k.cone(0.06, 0.18, 4, '#5f7a3a', x, 0, z);
  return bake(k.root);
}

export function pitGeometry(): THREE.BufferGeometry {
  const k = new Kit();
  // The dig: a dark square pit with stepped sides, spoil heaped round it.
  k.box(1.1, 0.04, 1.0, EARTH, 0, -0.03, 0);
  k.box(0.8, 0.04, 0.7, EARTH_DARK, 0, -0.01, 0);
  k.box(0.5, 0.04, 0.42, '#2e241a', 0, 0.01, 0);
  for (const [x, z, r] of [[-0.75, -0.55, 0.22], [0.8, -0.4, 0.18], [0.7, 0.6, 0.24], [-0.7, 0.6, 0.17]]) k.blob(r, EARTH, x, 0, z).scale.set(1, 0.45, 1);
  // A ladder down, propped on the edge.
  const g = k.group(0.2, 0, -0.2);
  g.rotation.x = -0.5;
  for (const x of [-0.08, 0.08]) k.box(0.025, 0.6, 0.025, '#8a6440', x, 0, 0, g);
  for (let i = 0; i < 4; i++) k.box(0.18, 0.02, 0.02, '#8a6440', 0, 0.1 + i * 0.13, 0, g);
  // What the dig turned up and set aside: cleaned drums and blocks in a row, and a spade.
  for (let i = 0; i < 3; i++) k.cyl(0.11, 0.12, 0.2, 8, i % 2 ? WORN : LIME, -0.55 + i * 0.3, 0, -0.85);
  k.box(0.32, 0.16, 0.22, LIME_DARK, 0.5, 0, -0.85);
  const spade = k.group(-0.95, 0, 0.1);
  spade.rotation.z = 0.35;
  k.box(0.02, 0.5, 0.02, '#8a6440', 0, 0.1, 0, spade);
  k.box(0.1, 0.14, 0.015, '#6a6a6a', 0, 0, 0, spade);
  return bake(k.root);
}

export class RuinsView {
  readonly group = new THREE.Group();
  private standing: THREE.InstancedMesh | null = null;
  private pits: THREE.InstancedMesh | null = null;
  /** Ruin id → whether the viewer last saw it dug out. */
  private known = new Map<number, boolean>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  /** A touch larger than the tile, so a ruin reads as a place and not a rock. */
  private one = new THREE.Vector3(1.25, 1.25, 1.25);
  private up = new THREE.Vector3(0, 1, 0);

  private mesh(geo: () => THREE.BufferGeometry, have: THREE.InstancedMesh | null, n: number): THREE.InstancedMesh {
    if (have && have.instanceMatrix.count >= n) return have;
    if (have) this.group.remove(have);
    const mesh = new THREE.InstancedMesh(geo(), bakedMaterial, n);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    return mesh;
  }

  /** `seenTile`: ever seen; `seesNow`: in sight now (or everything shown, as in a replay). */
  update(s: GameState, seenTile: (x: number, y: number) => boolean, seesNow: (x: number, y: number) => boolean): void {
    const ruins = s.ruins ?? [];
    const n = Math.max(4, ruins.length);
    this.standing = this.mesh(ruinGeometry, this.standing, n);
    this.pits = this.mesh(pitGeometry, this.pits, n);
    let a = 0;
    let b = 0;
    for (const r of ruins) {
      if (seesNow(r.x, r.y)) this.known.set(r.id, r.by >= 0);
      else if (!seenTile(r.x, r.y)) continue;
      const dug = this.known.get(r.id) ?? false;
      // Each faces its own way, so no two look the same.
      this.q.setFromAxisAngle(this.up, (r.id % 4) * (Math.PI / 2) + 0.3);
      this.p.set(r.x, heightAt(s, r.x, r.y), r.y);
      this.m.compose(this.p, this.q, this.one);
      if (dug) this.pits.setMatrixAt(b++, this.m);
      else this.standing.setMatrixAt(a++, this.m);
    }
    this.standing.count = a;
    this.pits.count = b;
    this.standing.instanceMatrix.needsUpdate = true;
    this.pits.instanceMatrix.needsUpdate = true;
  }

  /** Whether the viewer last saw this ruin dug out. */
  dugAsSeen(id: number): boolean {
    return this.known.get(id) ?? false;
  }

  clear(): void {
    this.known.clear();
    if (this.standing) this.standing.count = 0;
    if (this.pits) this.pits.count = 0;
  }
}
