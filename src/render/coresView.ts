import * as THREE from 'three';
import { CORE, LODE, LODES, STRATA } from '../sim/data';
import { kindOf, oreOf, patchOf } from '../sim/lodes';
import type { GameState, SeamId } from '../sim/types';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';

/**
 * Core samples (#924 m3): a short striped column where a Prospector's Lodge drew a core, in the cut-away's banding (`STRATA`
 * tints, the top layer uppermost), flecked with what the ground holds and capped in its lode's colour; a drilling rig while it
 * is drawn. Only the viewer's own. In the underground view (U) the columns stand taller and each cored patch glows in its
 * lode's colour on the faded ground.
 */
const ORE_FLECK: Partial<Record<SeamId, string>> = { salt: '#f4f6f8', saltpetre: '#b8e0d0', bloodiron: '#c0303a' };

function coreModel(code: number): THREE.BufferGeometry {
  const k = new Kit();
  const lode = LODES[kindOf(code)];
  const ore = oreOf(code);
  // Spoil round the borehole.
  k.cyl(0.3, 0.36, 0.05, 7, '#6b5a40', 0, 0, 0);
  // The bands, the deepest at the foot: the core stands as it came out of the ground, upside down.
  const band = 0.22;
  const n = STRATA.length;
  for (let i = 0; i < n; i++) {
    const l = n - 1 - i;
    const y = 0.05 + i * band;
    k.cyl(0.13, 0.13, band, 6, STRATA[l].tint, 0, y, 0);
    // Flecks: gold where the layer holds it (more on a reef), and the rare seam in its layer.
    const gold = (STRATA[l].veins.gold ?? 0) * lode.gold;
    const golds = gold > 0 ? Math.min(4, Math.max(1, Math.round(gold / 300))) : 0;
    for (let g = 0; g < golds; g++) k.box(0.05, 0.04, 0.03, '#ffd24a', 0.12 * (g % 2 ? 1 : -0.6), y + 0.04 + (g * 0.05) % (band - 0.06), 0.06 * (g - 1.5));
    if (ore && l === LODE.oreLayer) for (let g = 0; g < 3; g++) k.box(0.05, 0.05, 0.04, ORE_FLECK[ore] ?? '#ffffff', 0.12 * (g === 1 ? -1 : 1), y + 0.05 + g * 0.05, 0.05 * (g - 1));
  }
  // The cap, in the lode's colour, and a little marker peg.
  const top = 0.05 + n * band;
  k.cyl(0.16, 0.15, 0.05, 6, lode.tint, 0, top, 0);
  k.cyl(0.02, 0.02, 0.14, 4, '#c8b48a', 0, top + 0.05, 0);
  return bake(k.root);
}

/** A drilling rig: three legs over the borehole and a drum. */
function rigModel(): THREE.BufferGeometry {
  const k = new Kit();
  k.cyl(0.3, 0.36, 0.05, 7, '#6b5a40', 0, 0, 0);
  for (const [x, z, r] of [[0.28, 0, 0], [-0.14, 0.24, 2.1], [-0.14, -0.24, 4.2]] as [number, number, number][]) {
    const leg = k.box(0.04, 0.9, 0.04, '#8a6a42', x, 0, z);
    leg.rotation.set(z * 0.5, r, -x * 0.5);
  }
  k.cyl(0.07, 0.07, 0.16, 6, '#5a5048', 0, 0.78, 0).rotation.z = Math.PI / 2;
  k.cyl(0.02, 0.02, 0.7, 4, '#3a3632', 0, 0.05, 0);
  return bake(k.root);
}

export class CoresView {
  readonly group = new THREE.Group();
  private meshes = new Map<number, THREE.InstancedMesh>();
  private rig: THREE.InstancedMesh | null = null;
  private patches: THREE.InstancedMesh | null = null;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private c = new THREE.Color();

  private meshFor(code: number): THREE.InstancedMesh {
    let mesh = this.meshes.get(code);
    if (!mesh) {
      mesh = new THREE.InstancedMesh(coreModel(code), bakedMaterial, CORE.most);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.meshes.set(code, mesh);
      this.group.add(mesh);
    }
    return mesh;
  }

  update(s: GameState, viewer: number, under: boolean): void {
    const cores = s.players[viewer]?.cores ?? [];
    for (const mesh of this.meshes.values()) mesh.count = 0;
    if (!this.rig) {
      this.rig = new THREE.InstancedMesh(rigModel(), bakedMaterial, CORE.most);
      this.rig.frustumCulled = false;
      this.group.add(this.rig);
      const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      this.patches = new THREE.InstancedMesh(plane, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.42, depthTest: false, depthWrite: false, fog: false }), CORE.most);
      this.patches.renderOrder = 5;
      this.patches.frustumCulled = false;
      this.group.add(this.patches);
    }
    let rigs = 0;
    let patches = 0;
    const shown = new Set<number>();
    const tall = under ? 1.7 : 1;
    for (const c of cores) {
      const x = (c.tile % s.w) + 0.5;
      const y = Math.floor(c.tile / s.w) + 0.5;
      this.q.identity();
      this.p.set(x, heightAt(s, x, y), y);
      if (c.at > s.tick) {
        this.sc.set(1, 1, 1);
        this.m.compose(this.p, this.q, this.sc);
        this.rig!.setMatrixAt(rigs++, this.m);
        continue;
      }
      const mesh = this.meshFor(c.lode);
      this.sc.set(tall, tall, tall);
      this.m.compose(this.p, this.q, this.sc);
      mesh.setMatrixAt(mesh.count++, this.m);
      const at = patchOf(x, y);
      if (under && !shown.has(at.y0 * s.w + at.x0)) {
        shown.add(at.y0 * s.w + at.x0);
        const cx = at.x0 + at.side / 2;
        const cy = at.y0 + at.side / 2;
        this.p.set(cx, heightAt(s, Math.min(cx, s.w - 0.5), Math.min(cy, s.h - 0.5)) + 0.25, cy);
        this.sc.set(at.side * 0.96, 1, at.side * 0.96);
        this.m.compose(this.p, this.q, this.sc);
        this.patches!.setMatrixAt(patches, this.m);
        this.patches!.setColorAt(patches++, this.c.set(LODES[kindOf(c.lode)].tint));
      }
    }
    for (const mesh of this.meshes.values()) mesh.instanceMatrix.needsUpdate = true;
    this.rig.count = rigs;
    this.rig.instanceMatrix.needsUpdate = true;
    this.patches!.count = patches;
    this.patches!.instanceMatrix.needsUpdate = true;
    if (this.patches!.instanceColor) this.patches!.instanceColor.needsUpdate = true;
  }

  clear(): void {
    for (const mesh of this.meshes.values()) mesh.count = 0;
    if (this.rig) this.rig.count = 0;
    if (this.patches) this.patches.count = 0;
  }
}
