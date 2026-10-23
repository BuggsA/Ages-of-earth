import * as THREE from 'three';
import type { FindKind, GameState } from '../sim/types';
import { FINDS } from '../sim/data';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';

/**
 * Finds (#588, #593): the marks of the land near each town, drawn once the viewer has seen the tile. Each kind has a
 * fresh look and a picked-over one for after a people has taken it. Neutral colours: they belong to nobody.
 */

const KINDS = Object.keys(FINDS.kinds) as FindKind[];

const WOOD = '#6b4d33';
const WOOD_DARK = '#4a3624';
const RUST = '#a4502a';
const STONE = '#8d8a82';
const STONE_DARK = '#6a675f';
const EARTH = '#7a5f42';
const GRASS = '#5f7a3a';

/** A boat's ribs, held with rust-red nails; claimed, the ribs lie fallen and the nails are gone. */
function wreck(k: Kit, taken: boolean): void {
  k.box(1.1, 0.06, 0.1, WOOD_DARK, 0, 0, 0);
  for (let i = 0; i < 5; i++) {
    const x = -0.44 + i * 0.22;
    for (const s of [-1, 1]) {
      const rib = k.box(0.05, 0.5, 0.05, i % 2 ? WOOD : WOOD_DARK, x, 0.04, s * 0.14);
      rib.rotation.x = s * (taken ? 1.25 : 0.3);
      if (taken) rib.position.y = 0.05;
    }
    if (!taken) k.box(0.07, 0.04, 0.07, RUST, x, 0.5, 0);
  }
  k.cone(0.05, 0.14, 4, GRASS, 0.5, 0, 0.3);
}

/** Spear-heads piled under stones, dark as dried blood; claimed, the pile is scattered. */
function cairn(k: Kit, taken: boolean): void {
  const stones: [number, number, number, number][] = [[0, 0, 0, 0.3], [0.22, 0.05, 0.15, 0.2], [-0.2, 0.04, 0.12, 0.22], [0.02, 0.28, 0.02, 0.17]];
  for (const [x, y, z, r] of stones) {
    if (taken && y > 0.1) k.rock(r, STONE, 0.55, 0, 0.35);
    else k.rock(r, STONE_DARK, taken ? x * 1.8 : x, y, taken ? z * 1.8 : z);
  }
  const heads = taken ? 0 : 4;
  for (let i = 0; i < heads; i++) {
    const h = k.cone(0.04, 0.3, 4, '#5a1d1a', -0.3 + i * 0.2, 0.05, 0.32);
    h.rotation.z = 0.5 - i * 0.3;
  }
}

/** A white crust on bare ground, hoof-trodden; claimed, the crust is scraped to grey. */
function lick(k: Kit, taken: boolean): void {
  k.cyl(0.5, 0.58, 0.03, 8, '#7c6a4a', 0, 0, 0);
  const crust = taken ? '#b9b3a3' : '#f1ede2';
  for (const [x, z, w, d] of [[-0.2, -0.1, 0.55, 0.4], [0.3, 0.15, 0.4, 0.3], [-0.05, 0.3, 0.3, 0.2]]) k.box(w, taken ? 0.02 : 0.06, d, crust, x, 0.03, z);
  if (!taken) for (const [x, z, r] of [[-0.3, 0, 0.07], [0.15, -0.2, 0.06], [0.4, 0.2, 0.05]]) k.rock(r, '#ffffff', x, 0.08, z);
  for (const [x, z] of [[-0.6, 0.1], [0.6, -0.25]]) k.rock(0.07, STONE, x, 0.02, z);
}

/** A black stone in a scorched hollow, pale crystals round it; claimed, the stone is gone and the hollow is bare. */
function meteor(k: Kit, taken: boolean): void {
  k.cyl(0.42, 0.5, 0.04, 9, '#2c2622', 0, 0, 0);
  k.cyl(0.26, 0.34, 0.05, 9, '#1c1816', 0, 0.02, 0);
  if (!taken) {
    k.rock(0.2, '#1a1a1f', 0, 0.02, 0);
    for (const [x, z, h] of [[0.3, 0.15, 0.26], [-0.3, 0.12, 0.2], [0.08, -0.32, 0.28], [-0.1, 0.32, 0.18]]) {
      const c = k.cone(0.06, h, 5, '#e9ecf4', x, 0.03, z);
      c.rotation.z = x * 0.6;
    }
  } else {
    k.rock(0.06, '#e9ecf4', 0.32, 0.03, 0.15);
  }
}

/** A hermit's hut of branches and turf beside standing stones; claimed, the door is shut and the smoke is out. */
function shrine(k: Kit, taken: boolean): void {
  k.pyramid(0.7, 0.45, 0.6, '#7b6a46', -0.2, 0.2, 0);
  k.box(0.5, 0.2, 0.42, EARTH, -0.2, 0, 0);
  k.box(0.14, taken ? 0.2 : 0.14, 0.02, taken ? WOOD : '#1c1410', -0.2, 0, 0.22);
  for (const [x, z, h] of [[0.5, -0.2, 0.55], [0.62, 0.1, 0.4], [0.42, 0.28, 0.3]]) k.box(0.16, h, 0.12, STONE, x, 0, z).rotation.y = x;
  if (!taken) k.sphere(0.07, '#d9d4c8', -0.2, 0.75, 0, undefined, 5);
}

/** A hunters' cache: a cairn of stones over a hide bundle on a pole rack; claimed, the rack stands empty. */
function stash(k: Kit, taken: boolean): void {
  for (const x of [-0.3, 0.3]) k.box(0.05, 0.6, 0.05, WOOD, x, 0, 0);
  k.box(0.7, 0.05, 0.05, WOOD, 0, 0.6, 0);
  if (!taken) {
    k.blob(0.18, '#8a6a46', -0.12, 0.38, 0);
    k.blob(0.15, '#a1805a', 0.14, 0.4, 0);
    k.box(0.4, 0.04, 0.2, '#b5603a', 0, 0.5, 0);
  }
  for (let i = 0; i < 5; i++) k.rock(0.09 + (i % 2) * 0.03, STONE, -0.4 + i * 0.2, 0, 0.3);
}

const BUILD: Record<FindKind, (k: Kit, taken: boolean) => void> = { wreck, cairn, lick, meteor, shrine, stash };

export function findGeometry(kind: FindKind, taken: boolean): THREE.BufferGeometry {
  const k = new Kit();
  BUILD[kind](k, taken);
  return bake(k.root);
}

export class FindsView {
  readonly group = new THREE.Group();
  /** [kind][taken] → instanced mesh. */
  private meshes = new Map<string, THREE.InstancedMesh>();
  /** Find id → whether the viewer last saw it taken. */
  private known = new Map<number, boolean>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private one = new THREE.Vector3(1.6, 1.6, 1.6);
  private up = new THREE.Vector3(0, 1, 0);

  private mesh(kind: FindKind, taken: boolean, n: number): THREE.InstancedMesh {
    const key = `${kind}${taken ? '!' : ''}`;
    const have = this.meshes.get(key);
    if (have && have.instanceMatrix.count >= n) return have;
    if (have) this.group.remove(have);
    const mesh = new THREE.InstancedMesh(findGeometry(kind, taken), bakedMaterial, n);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.meshes.set(key, mesh);
    return mesh;
  }

  /** `seenTile`: ever seen; `seesNow`: in sight now (or everything shown, as in a replay). */
  update(s: GameState, seenTile: (x: number, y: number) => boolean, seesNow: (x: number, y: number) => boolean): void {
    const finds = s.finds ?? [];
    const n = Math.max(4, finds.length);
    const used = new Map<string, number>();
    for (const m of this.meshes.values()) m.count = 0;
    for (const f of finds) {
      if (seesNow(f.x, f.y)) this.known.set(f.id, f.by >= 0);
      else if (!seenTile(f.x, f.y)) continue;
      const taken = this.known.get(f.id) ?? false;
      const mesh = this.mesh(f.kind, taken, n);
      const key = `${f.kind}${taken ? '!' : ''}`;
      const i = used.get(key) ?? 0;
      used.set(key, i + 1);
      this.q.setFromAxisAngle(this.up, (f.id % 4) * (Math.PI / 2) + 0.4);
      this.p.set(f.x, heightAt(s, f.x, f.y), f.y);
      this.m.compose(this.p, this.q, this.one);
      mesh.setMatrixAt(i, this.m);
      mesh.count = i + 1;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Whether the viewer last saw this find taken. */
  takenAsSeen(id: number): boolean {
    return this.known.get(id) ?? false;
  }

  clear(): void {
    this.known.clear();
    for (const m of this.meshes.values()) m.count = 0;
  }
}

export { KINDS as FIND_KINDS };
