import * as THREE from 'three';
import { AMOUNT, RARE } from '../sim/data';
import { RARE_OF_TILE } from '../sim/units';
import { hash2 } from '../sim/rng';
import type { GameState } from '../sim/types';
import { R_BERRY, R_BLOODIRON, R_BOG, R_SALT, R_SALTPETRE, R_FISH, R_MEAT, R_STONE, R_TREE, T_SAND } from '../sim/types';
import { bakedMaterial, swayMaterial } from './materials';
import { natureGeometry, type NatureKind } from './natureModels';
import { heightAt } from './terrain';
import { UNIT_SCALE } from './unitsView';
import { WATER_Y } from './water';

/**
 * Woods, berry bushes, stone and gold, instanced by kind. Trees that are being cut lie felled beside
 * their stumps; bushes and mines shrink as they are worked. The layout is rebuilt when something
 * changes (a few times a second at most), which costs about a millisecond on the largest map.
 */

const TREE_KINDS: NatureKind[] = ['pine', 'broadleaf', 'birch'];

export class ResourcesView {
  readonly group = new THREE.Group();
  private meshes = new Map<NatureKind, THREE.InstancedMesh>();
  /** Instance index back to its tile, per kind, for picking. */
  private tiles = new Map<THREE.InstancedMesh, number[]>();
  private dirty = true;
  private since = 0;

  markDirty(): void {
    this.dirty = true;
  }

  clear(): void {
    for (const m of this.meshes.values()) {
      this.group.remove(m);
      m.dispose();
    }
    this.meshes.clear();
    this.tiles.clear();
    this.dirty = true;
  }

  pickables(): THREE.Object3D[] {
    return [...this.meshes.values()];
  }

  tileOf(mesh: THREE.Object3D, instance: number): number | null {
    const list = this.tiles.get(mesh as THREE.InstancedMesh);
    return list ? (list[instance] ?? null) : null;
  }

  update(s: GameState, dt: number): void {
    this.since += dt;
    if (!this.dirty || this.since < 0.25) return;
    this.dirty = false;
    this.since = 0;
    const lists = new Map<NatureKind, { tile: number; m: THREE.Matrix4 }[]>();
    const add = (kind: NatureKind, tile: number, m: THREE.Matrix4) => {
      let l = lists.get(kind);
      if (!l) lists.set(kind, (l = []));
      l.push({ tile, m });
    };
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (let ty = 0; ty < s.h; ty++) {
      for (let tx = 0; tx < s.w; tx++) {
        const i = ty * s.w + tx;
        const r = s.res[i];
        if (!r) continue;
        const jx = (hash2(tx, ty, 31) - 0.5) * 0.3;
        const jy = (hash2(tx, ty, 32) - 0.5) * 0.3;
        const x = tx + 0.5 + jx;
        const y = ty + 0.5 + jy;
        const rot = hash2(tx, ty, 33) * Math.PI * 2;
        q.setFromAxisAngle(up, rot);
        const gy = heightAt(s, x, y);
        const frac = s.amount[i] / (r === R_TREE ? AMOUNT.tree : r === R_BERRY ? AMOUNT.berry : r === R_MEAT ? AMOUNT.meat : r === R_STONE ? AMOUNT.stone : r === R_FISH ? AMOUNT.fish : r === R_BOG ? AMOUNT.bog : RARE_OF_TILE[r] ? RARE[RARE_OF_TILE[r]].amount : AMOUNT.gold);
        if (r === R_TREE) {
          if (s.amount[i] < AMOUNT.tree) {
            add('felled', i, new THREE.Matrix4().compose(new THREE.Vector3(x, gy, y), q, new THREE.Vector3(1, 1, 1)));
            continue;
          }
          const sc = 0.85 + hash2(tx, ty, 34) * 0.55;
          const kind = s.terrain[i] === T_SAND ? 'palm' : TREE_KINDS[Math.floor(hash2(tx, ty, 35) * (hash2(Math.floor(tx / 6), Math.floor(ty / 6), 36) < 0.5 ? 2 : 3))];
          add(kind, i, new THREE.Matrix4().compose(new THREE.Vector3(x, gy, y), q, new THREE.Vector3(sc, sc * (0.9 + hash2(tx, ty, 37) * 0.3), sc)));
        } else if (r === R_FISH) {
          // A shoal thins as it is fished.
          const sc = 1.6 * (0.6 + 0.4 * Math.max(0, Math.min(1, frac)));
          add('fish', i, new THREE.Matrix4().compose(new THREE.Vector3(tx + 0.5, WATER_Y + 0.01, ty + 0.5), q, new THREE.Vector3(sc, sc, sc)));
        } else if (r === R_MEAT) {
          // A carcass shrinks as it is butchered; a mammoth's (#171) lies the bigger for all its meat.
          const sc = UNIT_SCALE * (0.6 + 0.4 * Math.max(0, Math.min(1, frac))) * Math.min(2, Math.max(1, Math.sqrt(frac)));
          add('carcass', i, new THREE.Matrix4().compose(new THREE.Vector3(tx + 0.5, gy, ty + 0.5), q, new THREE.Vector3(sc, sc, sc)));
        } else {
          const kind: NatureKind = r === R_BERRY ? 'berryBush' : r === R_STONE ? 'stoneDeposit' : r === R_BOG ? 'bogIron' : r === R_SALT ? 'saltVein' : r === R_SALTPETRE ? 'saltpetreVein' : r === R_BLOODIRON ? 'bloodIronVein' : 'goldDeposit';
          const sc = (0.55 + 0.5 * Math.max(0, Math.min(1, frac))) * (r === R_BERRY ? 1 : 1.25);
          add(kind, i, new THREE.Matrix4().compose(new THREE.Vector3(tx + 0.5, gy, ty + 0.5), q, new THREE.Vector3(sc, sc, sc)));
        }
      }
    }
    for (const [kind, list] of lists) {
      let mesh = this.meshes.get(kind);
      if (!mesh || mesh.instanceMatrix.count < list.length) {
        if (mesh) {
          this.group.remove(mesh);
          mesh.dispose();
        }
        const sway = kind !== 'felled' && kind !== 'stoneDeposit' && kind !== 'goldDeposit' && kind !== 'bogIron' && kind !== 'saltVein' && kind !== 'saltpetreVein' && kind !== 'bloodIronVein' && kind !== 'carcass';
        mesh = new THREE.InstancedMesh(natureGeometry(kind), sway ? swayMaterial : bakedMaterial, Math.ceil(list.length * 1.2) + 8);
        // Shoals cast no shadow on the water.
        mesh.castShadow = kind !== 'fish';
        mesh.receiveShadow = true;
        this.meshes.set(kind, mesh);
        this.group.add(mesh);
      }
      const tiles: number[] = [];
      list.forEach((it, j) => {
        mesh!.setMatrixAt(j, it.m);
        tiles.push(it.tile);
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.tiles.set(mesh, tiles);
    }
    for (const [kind, mesh] of this.meshes) {
      if (lists.has(kind)) continue;
      mesh.count = 0;
      this.tiles.set(mesh, []);
    }
  }
}
