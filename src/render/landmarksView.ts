import * as THREE from 'three';
import type { GameState, LandmarkKind } from '../sim/types';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';

/**
 * Contested landmarks: a sacred spring in a ring of mossy stones, a lookout crag with a path cut up its
 * side and a watch cairn on top, and an ancestors' cairn among a ring of standing stones. All in the
 * land's own colours, since they belong to nobody for good; whoever keeps one flies a banner in their
 * colour beside it. Drawn once the viewer has seen the spot, as it was when last seen.
 */

const STONE = '#8f8a7e';
const STONE_DARK = '#6e6a60';
const STONE_PALE = '#b3ad9f';
const MOSS = '#5f7d3c';
const WATER = '#3f7fa8';
const WATER_LIGHT = '#78b4d2';
const REED = '#7c8f3e';
const OCHRE = '#a5532c';
const TEAM = '#ffffff';

export function springGeometry(): THREE.BufferGeometry {
  const k = new Kit();
  // A pool, its rim, and the stones set round it.
  k.cyl(0.95, 1.0, 0.06, 12, STONE_DARK, 0, -0.03, 0);
  k.cyl(0.75, 0.75, 0.04, 12, WATER, 0, 0.01, 0);
  k.cyl(0.3, 0.3, 0.02, 10, WATER_LIGHT, 0.15, 0.04, -0.1);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    k.rock(0.13 + (i % 3) * 0.02, i % 2 ? STONE : STONE_PALE, Math.cos(a) * 0.88, 0, Math.sin(a) * 0.88);
    if (i % 3 === 0) k.box(0.12, 0.02, 0.1, MOSS, Math.cos(a) * 0.88, 0.12, Math.sin(a) * 0.88);
  }
  // The spring's carved stone, where the water rises, with a little basin before it.
  k.box(0.24, 0.62, 0.16, STONE_PALE, 0, 0, -0.62);
  k.box(0.18, 0.04, 0.17, STONE_DARK, 0, 0.62, -0.62);
  k.box(0.04, 0.2, 0.01, OCHRE, 0, 0.3, -0.535);
  k.box(0.12, 0.04, 0.01, OCHRE, 0, 0.36, -0.535);
  k.cyl(0.14, 0.1, 0.1, 8, STONE, 0, 0, -0.38);
  // Reeds at the water's edge.
  for (const [x, z] of [[0.6, 0.3], [0.5, 0.45], [-0.55, 0.4], [-0.65, 0.2], [0.35, 0.62]]) k.cone(0.03, 0.34, 4, REED, x, 0, z);
  return bake(k.root);
}

export function cragGeometry(): THREE.BufferGeometry {
  const k = new Kit();
  // A heap of great weathered blocks, stepping up to a flat top.
  k.box(1.7, 0.55, 1.5, STONE_DARK, 0, 0, 0).rotation.y = 0.15;
  k.box(1.3, 0.5, 1.15, STONE, -0.1, 0.5, -0.05).rotation.y = -0.1;
  k.box(0.9, 0.45, 0.8, STONE_PALE, -0.15, 0.95, -0.1).rotation.y = 0.25;
  k.rock(0.32, STONE_DARK, 0.75, 0.2, 0.6);
  k.rock(0.26, STONE, -0.8, 0.3, 0.5);
  k.rock(0.22, STONE_DARK, 0.6, 0.6, -0.55);
  // A path cut up the side: steps.
  for (let i = 0; i < 5; i++) k.box(0.28, 0.06, 0.16, STONE_PALE, 0.62 - i * 0.1, 0.12 + i * 0.22, 0.48 - i * 0.12);
  // Grass and moss on the ledges.
  k.box(0.5, 0.03, 0.4, MOSS, 0.3, 0.55, 0.25);
  k.box(0.3, 0.03, 0.3, MOSS, -0.4, 1.0, 0.2);
  // The watch cairn on top: stacked stones and a ring of fire-blackened ones.
  k.cyl(0.2, 0.26, 0.14, 7, STONE, -0.15, 1.4, -0.1);
  k.cyl(0.13, 0.19, 0.14, 7, STONE_PALE, -0.15, 1.54, -0.1);
  k.cyl(0.06, 0.12, 0.12, 6, STONE, -0.15, 1.68, -0.1);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    k.rock(0.05, '#3a3632', 0.15 + Math.cos(a) * 0.12, 1.42, 0.2 + Math.sin(a) * 0.12);
  }
  return bake(k.root);
}

export function cairnGeometry(): THREE.BufferGeometry {
  const k = new Kit();
  // A ring of standing stones, each leaning its own way.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.2;
    const h = 0.55 + ((i * 37) % 5) * 0.06;
    const st = k.box(0.2, h, 0.13, i % 2 ? STONE : STONE_PALE, Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0);
    st.rotation.y = -a;
    st.rotation.z = ((i % 3) - 1) * 0.07;
  }
  // The cairn itself: a long mound of stones over the old ones, a capstone, a doorway stone.
  k.blob(0.62, STONE_DARK, 0, -0.1, 0).scale.set(1, 0.75, 1);
  for (const [x, y, z, r] of [[0.25, 0.3, 0.2, 0.14], [-0.3, 0.28, 0.1, 0.13], [0.05, 0.4, -0.25, 0.15], [-0.1, 0.5, 0.15, 0.12], [0.3, 0.2, -0.3, 0.12]]) k.rock(r, STONE, x, y, z);
  k.box(0.32, 0.08, 0.26, STONE_PALE, 0, 0.6, 0);
  k.box(0.3, 0.38, 0.06, STONE_PALE, 0, 0, 0.6);
  k.box(0.14, 0.24, 0.02, '#2a2620', 0, 0, 0.64);
  // Ochre hands on the doorway stone, and offerings: a pot, a bundle.
  k.box(0.05, 0.05, 0.01, OCHRE, -0.09, 0.28, 0.635);
  k.box(0.05, 0.05, 0.01, OCHRE, 0.09, 0.3, 0.635);
  k.cyl(0.06, 0.05, 0.1, 7, '#9a6a44', 0.28, 0, 0.72);
  k.box(0.12, 0.06, 0.08, '#c9b98a', -0.28, 0, 0.74);
  k.box(0.2, 0.02, 0.2, MOSS, -0.2, 0.42, -0.1);
  return bake(k.root);
}

/** A keeper's banner on a tall pole, cloth in the keeper's colour. */
export function bannerGeometry(): THREE.BufferGeometry {
  const k = new Kit();
  k.cyl(0.03, 0.035, 1.4, 5, '#5b4330', 0, 0, 0);
  k.cone(0.05, 0.08, 5, '#c8a84a', 0, 1.4, 0);
  k.cloth(k.team(k.box(0.015, 0.34, 0.5, TEAM, 0, 1.0, 0.25)), 0.5, 0);
  k.team(k.box(0.06, 0.04, 0.06, TEAM, 0, 0.95, 0));
  return bake(k.root);
}

const GEOMETRY: Record<LandmarkKind, () => THREE.BufferGeometry> = { spring: springGeometry, crag: cragGeometry, cairn: cairnGeometry };
/** Where each kind's banner stands, in model space. */
const BANNER: Record<LandmarkKind, [number, number, number]> = { spring: [0.75, 0, 0.75], crag: [0.25, 1.4, -0.35], cairn: [1.25, 0, -0.35] };

export class LandmarksView {
  readonly group = new THREE.Group();
  private meshes: Partial<Record<LandmarkKind, THREE.InstancedMesh>> = {};
  private banners: THREE.InstancedMesh | null = null;
  /** Landmark id → its keeper when the viewer last saw it (-1: nobody). */
  private known = new Map<number, number>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private b = new THREE.Vector3();
  private one = new THREE.Vector3(1.2, 1.2, 1.2);
  private up = new THREE.Vector3(0, 1, 0);
  private c = new THREE.Color();

  private mesh(geo: () => THREE.BufferGeometry, have: THREE.InstancedMesh | null | undefined, n: number): THREE.InstancedMesh {
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
    const marks = s.landmarks ?? [];
    const n = Math.max(4, marks.length);
    const counts: Record<LandmarkKind, number> = { spring: 0, crag: 0, cairn: 0 };
    for (const kind of Object.keys(GEOMETRY) as LandmarkKind[]) this.meshes[kind] = this.mesh(GEOMETRY[kind], this.meshes[kind], n);
    this.banners = this.mesh(bannerGeometry, this.banners, n);
    let flags = 0;
    for (const lm of marks) {
      if (seesNow(lm.x, lm.y)) this.known.set(lm.id, lm.owner);
      else if (!seenTile(lm.x, lm.y)) continue;
      this.q.setFromAxisAngle(this.up, (lm.id % 4) * (Math.PI / 2) + 0.4);
      this.p.set(lm.x, heightAt(s, lm.x, lm.y), lm.y);
      this.m.compose(this.p, this.q, this.one);
      this.meshes[lm.kind]!.setMatrixAt(counts[lm.kind]++, this.m);
      const keeper = this.known.get(lm.id) ?? -1;
      if (keeper < 0) continue;
      const [bx, by, bz] = BANNER[lm.kind];
      this.b.set(bx * 1.2, by * 1.2, bz * 1.2).applyQuaternion(this.q).add(this.p);
      this.m.compose(this.b, this.q, this.one);
      this.banners.setMatrixAt(flags, this.m);
      this.banners.setColorAt(flags, this.c.set(s.players[keeper].color));
      flags++;
    }
    for (const kind of Object.keys(GEOMETRY) as LandmarkKind[]) {
      const mesh = this.meshes[kind]!;
      mesh.count = counts[kind];
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.banners.count = flags;
    this.banners.instanceMatrix.needsUpdate = true;
    if (this.banners.instanceColor) this.banners.instanceColor.needsUpdate = true;
  }

  /** Who kept this landmark when the viewer last saw it (-1: nobody, or never seen). */
  keeperAsSeen(id: number): number {
    return this.known.get(id) ?? -1;
  }

  clear(): void {
    this.known.clear();
    for (const mesh of Object.values(this.meshes)) if (mesh) mesh.count = 0;
    if (this.banners) this.banners.count = 0;
  }
}
