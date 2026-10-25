import * as THREE from 'three';
import type { GameState, RareId } from '../sim/types';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';
import { UNIT_SCALE } from './unitsView';

/**
 * Key ore knocked loose (#570): a split sack spilling its ore into the grass, the ore's own look (salt in white cubes,
 * saltpetre in pale yellow crystal, blood-iron in dark red lumps), bigger the more lies in it. A citizen carrying a load
 * home has a smaller sack of it on the shoulder. Drawn where the viewer sees now; the minimap marks them for an assayer.
 */

const LOOK: Record<RareId, { lump: 'cube' | 'crystal' | 'rock'; colors: string[] }> = {
  salt: { lump: 'cube', colors: ['#f4f1e8', '#e6e1d2', '#fbfaf4'] },
  saltpetre: { lump: 'crystal', colors: ['#e2dc8e', '#d8d27a', '#efe9b0'] },
  bloodiron: { lump: 'rock', colors: ['#7a1a22', '#a01c2c', '#5a1418'] },
  glowcap: { lump: 'rock', colors: ['#8fe0ee', '#cfe6e8', '#6fb8c8'] },
};
const ORES: RareId[] = ['salt', 'saltpetre', 'bloodiron', 'glowcap'];

function cacheGeometry(ore: RareId): THREE.BufferGeometry {
  const k = new Kit();
  const look = LOOK[ore];
  // The sack, slumped and split open toward +x.
  k.blob(0.26, '#c8a66e', -0.16, 0.15, 0).scale.set(1, 0.6, 0.9);
  k.cyl(0.06, 0.08, 0.1, 6, '#a58650', -0.24, 0.26, 0).rotation.z = 0.5;
  const spots: [number, number, number][] = [[0.14, 0.04, 0.16], [0.32, -0.14, 0.13], [0.1, -0.24, 0.12], [0.4, 0.14, 0.11], [0.04, 0.24, 0.11], [0.26, 0.3, 0.1], [0.48, -0.02, 0.09], [0.2, -0.38, 0.08]];
  spots.forEach(([x, z, r], i) => {
    const c = look.colors[i % look.colors.length];
    if (look.lump === 'cube') k.box(r * 1.3, r * 1.1, r * 1.3, c, x, 0, z).rotation.y = i * 0.7;
    else if (look.lump === 'crystal') {
      const m = k.octa(r, c, x, r * 0.8, z);
      m.scale.set(0.7, 1.4, 0.7);
      m.rotation.z = (i % 3) * 0.3 - 0.3;
    } else k.rock(r, c, x, r * 0.6, z);
  });
  // A stake with a pale flag: a spill is small and ore is pale or dark, so the mark is what the eye finds.
  k.cyl(0.012, 0.012, 0.75, 4, '#e8dcc0', -0.3, 0, 0.12);
  k.box(0.26, 0.15, 0.02, '#f2c94a', -0.17, 0.6, 0.12);
  return bake(k.root);
}

export class CacheView {
  readonly group = new THREE.Group();
  private meshes = new Map<RareId, THREE.InstancedMesh>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  private mesh(ore: RareId, n: number): THREE.InstancedMesh {
    let mesh = this.meshes.get(ore);
    if (!mesh || mesh.instanceMatrix.count < n) {
      if (mesh) this.group.remove(mesh);
      mesh = new THREE.InstancedMesh(cacheGeometry(ore), bakedMaterial, Math.max(8, n * 2));
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.meshes.set(ore, mesh);
    }
    return mesh;
  }

  /** `sees`: the spot is in sight now; `carrierAt`: where a unit is drawn (null when out of sight). */
  update(s: GameState, sees: (x: number, y: number) => boolean, carrierAt: (id: number) => THREE.Vector3 | null): void {
    const caches = s.caches ?? [];
    const held = s.ents.filter((e) => e.kind === 'unit' && e.ore && e.hp > 0 && !e.inside);
    for (const ore of ORES) {
      const mesh = this.mesh(ore, caches.length + held.length);
      let a = 0;
      for (const c of caches) {
        if (c.ore !== ore || !sees(c.x, c.y)) continue;
        this.q.setFromAxisAngle(this.up, (c.id % 8) * (Math.PI / 4));
        this.p.set(c.x, heightAt(s, c.x, c.y), c.y);
        this.m.compose(this.p, this.q, this.sc.setScalar(1.3 + Math.min(c.n, 60) / 80));
        mesh.setMatrixAt(a++, this.m);
      }
      for (const u of held) {
        if (u.kind !== 'unit' || u.ore!.id !== ore) continue;
        const at = carrierAt(u.id);
        if (!at) continue;
        this.q.setFromAxisAngle(this.up, Math.atan2(u.fx, u.fy));
        this.p.set(at.x - u.fy * 0.12, at.y + 0.78 * UNIT_SCALE, at.z + u.fx * 0.12);
        this.m.compose(this.p, this.q, this.sc.setScalar(0.42 * UNIT_SCALE));
        mesh.setMatrixAt(a++, this.m);
      }
      mesh.count = a;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  clear(): void {
    for (const mesh of this.meshes.values()) mesh.count = 0;
  }
}
