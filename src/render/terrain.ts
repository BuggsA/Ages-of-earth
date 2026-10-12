import * as THREE from 'three';
import { hash2 } from '../sim/rng';
import type { GameState } from '../sim/types';
import { T_GRASS, T_ROCK, T_SAND, T_WATER } from '../sim/types';
import { natureGeometry, type NatureKind } from './natureModels';
import { bakedMaterial, fogUniforms, inject, swayMaterial } from './materials';

/**
 * The ground: one faceted mesh over the height corners, each triangle colored by its tile (meadow
 * greens with dry patches, beaches, rock faces, the lake floor), with steep slopes turning to rock.
 * Grass tufts, flowers, pebbles and boulders are scattered over it, and the fog of war is a small
 * texture every material reads.
 */

const C = (hex: string) => new THREE.Color(hex);
const GRASS = [C('#76b04a'), C('#5f9c40'), C('#8cc25a')];
const DRY = C('#b8b46a');
const DIRT = C('#9c8a5e');
const SAND = [C('#e6d39c'), C('#d6c088')];
const ROCK = [C('#8f8679'), C('#a0988b'), C('#7d756a')];
const CLIFF = C('#7e7466');
const BED = [C('#b9a87a'), C('#8b9378')];

export const terrainMaterial = inject(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }), {});

/** Smooth value noise for color patches (render only). */
function smooth(x: number, y: number, scale: number, salt: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const ax = fx - ix;
  const ay = fy - iy;
  const sx = ax * ax * (3 - 2 * ax);
  const sy = ay * ay * (3 - 2 * ay);
  const a = hash2(ix, iy, salt);
  const b = hash2(ix + 1, iy, salt);
  const c = hash2(ix, iy + 1, salt);
  const d = hash2(ix + 1, iy + 1, salt);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export class TerrainView {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh | null = null;
  private skirt: THREE.Mesh | null = null;
  private decor: THREE.InstancedMesh[] = [];

  build(s: GameState): void {
    this.dispose();
    const { w, h } = s;
    const W = w + 1;
    const H = (x: number, y: number) => s.height[y * W + x];
    const pos = new Float32Array(w * h * 6 * 3);
    const col = new Float32Array(w * h * 6 * 3);
    let k = 0;
    const tmp = new THREE.Color();
    const v = new THREE.Vector3();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const tri = (pts: [number, number][], tile: number, tx: number, ty: number, t: number) => {
      // Slope: steep faces show as rock whatever the tile.
      const p0 = pts[0];
      const p1 = pts[1];
      const p2 = pts[2];
      a.set(p1[0] - p0[0], H(p1[0], p1[1]) - H(p0[0], p0[1]), p1[1] - p0[1]);
      b.set(p2[0] - p0[0], H(p2[0], p2[1]) - H(p0[0], p0[1]), p2[1] - p0[1]);
      v.crossVectors(a, b).normalize();
      const steep = Math.abs(v.y);
      const n = hash2(tx * 2 + t, ty, 7);
      const terr = s.terrain[tile];
      const avgH = (H(p0[0], p0[1]) + H(p1[0], p1[1]) + H(p2[0], p2[1])) / 3;
      // Broad, soft patches of color rather than speckle: smooth noise picks the shade.
      const patch = smooth(tx + 0.5, ty + 0.5, 6, 11);
      const fine = smooth(tx + 0.5, ty + 0.5, 2.5, 12);
      if (terr === T_WATER) {
        tmp.copy(BED[0]).lerp(BED[1], Math.min(1, Math.max(0, -avgH * 0.8)));
      } else if (terr === T_SAND) {
        tmp.copy(SAND[0]).lerp(SAND[1], fine);
      } else if (terr === T_ROCK) {
        tmp.copy(ROCK[0]).lerp(ROCK[1], fine).lerp(ROCK[2], patch * 0.6);
        if (avgH > 2.6) tmp.lerp(C('#d6d2ca'), Math.min(1, (avgH - 2.6) * 0.45));
      } else {
        tmp.copy(GRASS[0]).lerp(GRASS[2], fine * 0.8).lerp(GRASS[1], Math.max(0, 0.6 - patch) * 1.2);
        // Higher ground dries out; a few worn patches of earth.
        const dry = Math.max(0, Math.min(1, (avgH - 1.1) * 0.5)) * 0.45 + Math.max(0, patch - 0.72) * 1.2;
        tmp.lerp(DRY, Math.min(0.6, dry));
        if (fine < 0.18 && patch > 0.55) tmp.lerp(DIRT, 0.35);
      }
      if (terr !== T_WATER && steep < 0.8) tmp.lerp(CLIFF, Math.min(1, (0.8 - steep) * 2.6));
      // A whisper of light and shade per facet keeps the low-poly look without the noise.
      tmp.multiplyScalar(0.975 + n * 0.05);
      for (const [x, y] of pts) {
        pos[k * 3] = x;
        pos[k * 3 + 1] = H(x, y);
        pos[k * 3 + 2] = y;
        col[k * 3] = tmp.r;
        col[k * 3 + 1] = tmp.g;
        col[k * 3 + 2] = tmp.b;
        k++;
      }
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tile = y * w + x;
        // Alternate the diagonal for a less gridded look.
        if (hash2(x, y, 3) < 0.5) {
          tri([[x, y], [x, y + 1], [x + 1, y]], tile, x, y, 0);
          tri([[x + 1, y], [x, y + 1], [x + 1, y + 1]], tile, x, y, 1);
        } else {
          tri([[x, y], [x, y + 1], [x + 1, y + 1]], tile, x, y, 0);
          tri([[x, y], [x + 1, y + 1], [x + 1, y]], tile, x, y, 1);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(geo, terrainMaterial);
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    // Beyond the edge of the world: the same deep slate as the unexplored.
    const skirtGeo = new THREE.PlaneGeometry(w + 400, h + 400);
    skirtGeo.rotateX(-Math.PI / 2);
    this.skirt = new THREE.Mesh(skirtGeo, new THREE.MeshBasicMaterial({ color: fogUniforms.uUnexplored.value, fog: false }));
    this.skirt.position.set(w / 2, -1.6, h / 2);
    this.group.add(this.skirt);

    this.scatter(s);
  }

  /** Grass tufts, flowers and pebbles on the meadows, boulders on the rocks. */
  private scatter(s: GameState): void {
    const spots: Record<NatureKind, number[]> = {} as Record<NatureKind, number[]>;
    const add = (kind: NatureKind, x: number, y: number, rot: number, sc: number) => (spots[kind] ??= []).push(x, y, rot, sc);
    for (let ty = 0; ty < s.h; ty++) {
      for (let tx = 0; tx < s.w; tx++) {
        const i = ty * s.w + tx;
        const t = s.terrain[i];
        if (s.res[i]) continue;
        const r = hash2(tx, ty, 21);
        const ox = tx + 0.2 + hash2(tx, ty, 22) * 0.6;
        const oy = ty + 0.2 + hash2(tx, ty, 23) * 0.6;
        const rot = hash2(tx, ty, 24) * Math.PI * 2;
        if (t === T_GRASS) {
          if (r < 0.32) add('tuft', ox, oy, rot, 0.8 + hash2(tx, ty, 25) * 0.6);
          else if (r < 0.37) add('flowers', ox, oy, rot, 0.9 + hash2(tx, ty, 25) * 0.4);
          else if (r < 0.39) add('pebbles', ox, oy, rot, 1);
        } else if (t === T_SAND) {
          if (r < 0.08) add('pebbles', ox, oy, rot, 0.8);
        } else if (t === T_ROCK) {
          if (r < 0.22) add('boulder', ox, oy, rot, 0.7 + hash2(tx, ty, 25) * 0.8);
        }
      }
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (const kind of Object.keys(spots) as NatureKind[]) {
      const list = spots[kind];
      const count = list.length / 4;
      const sway = kind === 'tuft' || kind === 'flowers';
      const mesh = new THREE.InstancedMesh(natureGeometry(kind), sway ? swayMaterial : bakedMaterial, count);
      for (let j = 0; j < count; j++) {
        const x = list[j * 4];
        const y = list[j * 4 + 1];
        q.setFromAxisAngle(up, list[j * 4 + 2]);
        const sc = list[j * 4 + 3];
        m.compose(new THREE.Vector3(x, heightAt(s, x, y), y), q, new THREE.Vector3(sc, sc, sc));
        mesh.setMatrixAt(j, m);
      }
      mesh.castShadow = kind === 'boulder';
      mesh.receiveShadow = true;
      this.decor.push(mesh);
      this.group.add(mesh);
    }
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.group.remove(this.mesh);
    }
    if (this.skirt) {
      this.skirt.geometry.dispose();
      this.group.remove(this.skirt);
    }
    for (const d of this.decor) {
      this.group.remove(d);
      d.dispose();
    }
    this.decor = [];
  }
}

/** Ground height at a point, between the corners (as the renderer draws it). */
export function heightAt(s: GameState, x: number, y: number): number {
  const cx = Math.max(0, Math.min(s.w - 0.0001, x));
  const cy = Math.max(0, Math.min(s.h - 0.0001, y));
  const ix = Math.floor(cx);
  const iy = Math.floor(cy);
  const fx = cx - ix;
  const fy = cy - iy;
  const W = s.w + 1;
  const a = s.height[iy * W + ix];
  const b = s.height[iy * W + ix + 1];
  const c = s.height[(iy + 1) * W + ix];
  const d = s.height[(iy + 1) * W + ix + 1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

/**
 * The fog of war texture: red is what the player sees now, green what they have ever seen. It eases
 * toward the truth a little every frame and is softened, so sight rolls back and forth smoothly.
 */
export class FogTexture {
  readonly texture: THREE.DataTexture;
  private cur: Float32Array;
  private data: Uint8Array;
  private blur: Float32Array;

  constructor(private w: number, private h: number) {
    this.cur = new Float32Array(w * h * 2);
    this.blur = new Float32Array(w * h * 2);
    this.data = new Uint8Array(w * h * 4);
    this.texture = new THREE.DataTexture(this.data, w, h, THREE.RGBAFormat);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.needsUpdate = true;
  }

  /** Jump straight to the truth (at the start of a match). */
  snap(vis: Uint8Array, seen: Uint8Array): void {
    for (let i = 0; i < this.w * this.h; i++) {
      this.cur[i * 2] = vis[i];
      this.cur[i * 2 + 1] = seen[i];
    }
    this.upload();
  }

  /** Reveal everything (after the match, or for watching). */
  reveal(): void {
    this.cur.fill(1);
    this.upload();
  }

  update(vis: Uint8Array, seen: Uint8Array, dt: number): void {
    const k = Math.min(1, dt * 7);
    for (let i = 0; i < this.w * this.h; i++) {
      this.cur[i * 2] += (vis[i] - this.cur[i * 2]) * k;
      this.cur[i * 2 + 1] += (seen[i] - this.cur[i * 2 + 1]) * k;
    }
    this.upload();
  }

  private upload(): void {
    const { w, h, cur, blur, data } = this;
    // A small blur so edges are soft rather than tile-shaped.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0;
        let g = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const j = (yy * w + xx) * 2;
            const wt = dx === 0 && dy === 0 ? 2 : 1;
            r += cur[j] * wt;
            g += cur[j + 1] * wt;
            n += wt;
          }
        }
        const i = y * w + x;
        blur[i * 2] = r / n;
        blur[i * 2 + 1] = g / n;
        data[i * 4] = Math.round((r / n) * 255);
        data[i * 4 + 1] = Math.round((g / n) * 255);
        data[i * 4 + 3] = 255;
      }
    }
    this.texture.needsUpdate = true;
  }

  /** How visible a point is now (0..1), for hiding things smoothly. */
  visibleAt(x: number, y: number): number {
    const tx = Math.max(0, Math.min(this.w - 1, Math.floor(x)));
    const ty = Math.max(0, Math.min(this.h - 1, Math.floor(y)));
    return this.blur[(ty * this.w + tx) * 2];
  }
}
