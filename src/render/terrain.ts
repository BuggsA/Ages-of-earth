import * as THREE from 'three';
import { hash2 } from '../sim/rng';
import type { GameState } from '../sim/types';
import { T_GRASS, T_ROCK, T_SAND, T_WATER } from '../sim/types';
import { isCanal, isInund, isPolder } from '../sim/water';
import { bared, isCauseway } from '../sim/tides';
import { isPond } from '../sim/tides';
import { natureGeometry, type NatureKind } from './natureModels';
import { bakedMaterial, fogUniforms, inject, swayMaterial } from './materials';

/**
 * The ground: one faceted mesh over the height corners, each triangle colored by its tile (meadow
 * greens with dry patches, beaches, rock faces, the lake floor), with steep slopes turning to rock.
 * Grass tufts, flowers, pebbles and boulders are scattered over it, and the fog of war is a small
 * texture every material reads.
 */

const C = (hex: string) => new THREE.Color(hex);
const GRASS = [C('#708b4d'), C('#617d44'), C('#7d975a')];
const DRY = C('#8e9060');
const DIRT = C('#7a6c4c');
const SAND = [C('#cdbb8c'), C('#bca97a')];
const ROCK = [C('#7a7267'), C('#877f73'), C('#6c655b')];
const CLIFF = C('#6a6156');
const BED = [C('#b9a87a'), C('#8b9378')];
const SNOWCAP = C('#d6d2ca');
/**
 * Polder (#701): land pumped out of the water. Long strips of field in rich dark green and black loam, cut by straight ditches of
 * still water every few tiles; fresh from the water it is wet grey-brown mud, drying to field over `DRY_TIME` seconds.
 */
const POLDER_FIELD = [C('#7ba34a'), C('#69933f'), C('#86704c')];
const DITCH = C('#5f9a92');
/** Tidal flats the falling tide bared (#739): wet grey-brown sand with a sheen, ribbed; a causeway's packed pale stone. */
const WET = [C('#8f8670'), C('#a39878'), C('#6f7466')];
/** A barrage's pond bed (#748): still water silts green with weed. */
const POND = [C('#7f8a62'), C('#6c7a5a')];
const PAVING = [C('#b8ad96'), C('#9e9482')];
const MUD = C('#857a60');
const DRY_TIME = 20;
/** The Water Line (#701 s4): meadow drowned under a sluice's flood, seen through the sheet of water over it. */
const DROWNED = [C('#4f6b4a'), C('#5d7752')];
/** A canal (#701 s5): a bed of cut stone under the water, and the trodden towpath along its banks. */
const CANAL_BED = [C('#7d7a72'), C('#6a6862')];
const TOWPATH = C('#a8977a');
/** How far over the ground a sluice's flood lies, knee-deep, as drawn (`floodSheet`); a gun-barge rides on it. */
export const FLOOD_DEPTH = 0.09;
const floodMaterial = inject(new THREE.MeshStandardMaterial({ color: '#6fa7b6', transparent: true, opacity: 0.6, roughness: 0.2, metalness: 0.05, depthWrite: false }), {});
const TMP = new THREE.Color();
const A = new THREE.Vector3();
const B = new THREE.Vector3();
const V = new THREE.Vector3();

/** A polder facet's colour: ditch, loam or field by where it lies, wet mud until it has dried (`dried` 0 to 1). */
function polderColor(out: THREE.Color, x: number, y: number, t: number, fine: number, dried: number): void {
  // Ditches run straight along every fifth column.
  if (x % 5 === 0) out.copy(DITCH).lerp(POLDER_FIELD[1], t * 0.15);
  else {
    // Strips two tiles wide across the ditches: field, field, loam.
    const strip = Math.floor(y / 2) % 3;
    out.copy(strip === 2 ? POLDER_FIELD[2] : POLDER_FIELD[strip]).lerp(POLDER_FIELD[1], fine * 0.3);
  }
  if (dried < 1) out.lerp(MUD, (1 - dried) * 0.8);
}

/** Whether a canal (#701 s5) lies four-ways beside a tile: its bank is a towpath. */
function besideCanal(s: GameState, x: number, y: number): boolean {
  return (x > 0 && isCanal(s, y * s.w + x - 1)) || (x < s.w - 1 && isCanal(s, y * s.w + x + 1)) || (y > 0 && isCanal(s, (y - 1) * s.w + x)) || (y < s.h - 1 && isCanal(s, (y + 1) * s.w + x));
}

/** Tiles pumped out so far, by every people: a cheap test that the water layer changed. */
const drainedIn = (s: GameState): number => {
  let n = 0;
  // Pumped out (#701), or dug into a channel: either way the shore moved.
  for (const p of s.players) n += (p.stats.drained ?? 0) + (p.stats.dug ?? 0);
  // Or taken back by the sea through a breach (#701 s3), flooded and given back by a sluice (#701 s4), or bared or covered by the tide (#739).
  return n + (s.flooded ?? 0) + (s.inundated ?? 0) + (s.tideTurns ?? 0);
};

export const terrainMaterial = inject(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }), { season: 'ground' });

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
  /** The Water Line's flood (#701 s4): a sheet of shallow water over every flooded tile, drawn again when the water moves. */
  private flood: THREE.Mesh | null = null;
  private floodSeen = -1;
  private skirt: THREE.Mesh | null = null;
  /** The heights as drawn: they follow the rules' heights, easing toward them where the land rose out of the water (#701). */
  private shown = new Float32Array(0);
  private pos = new Float32Array(0);
  private col = new Float32Array(0);
  /** The ground as last drawn, to spot tiles the rules turned from water to land, and how many tiles had been pumped out then. */
  private drawn = new Uint8Array(0);
  /** The channels and canals as last drawn (#701 s5: a channel dug deep stays water, but its bed and banks change). */
  private dug = new Uint8Array(0);
  private drainedSeen = 0;
  /** Corners easing toward their new height. */
  private rising = new Set<number>();
  /** Polder tiles still drying from wet mud to field, and the clock time each came out of the water. */
  private drying = new Map<number, number>();
  private clock = 0;
  private repaintAt = 0;

  /** Paint the world's edge: the unexplored slate in play, or a colour given (the title's horizon), so the land fades into the sky. */
  skirtTint(c: THREE.Color | null): void {
    (this.skirt?.material as THREE.MeshBasicMaterial | undefined)?.color.copy(c ?? fogUniforms.uUnexplored.value);
  }
  private decor: THREE.InstancedMesh[] = [];

  build(s: GameState): void {
    this.dispose();
    const { w, h } = s;
    this.shown = Float32Array.from(s.height);
    this.pos = new Float32Array(w * h * 6 * 3);
    this.col = new Float32Array(w * h * 6 * 3);
    this.drawn = Uint8Array.from(s.terrain);
    this.dug = s.channel ? Uint8Array.from(s.channel) : new Uint8Array(w * h);
    this.drainedSeen = drainedIn(s);
    this.rising.clear();
    this.drying.clear();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) this.paint(s, x, y);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
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
    this.floodSheet(s);
  }

  /** Lay the sheet of the Water Line's flood (#701 s4) over every flooded tile, `FLOOD_DEPTH` over the ground's corners. */
  private floodSheet(s: GameState): void {
    const seen = s.inundated ?? 0;
    if (seen === this.floodSeen) return;
    this.floodSeen = seen;
    if (this.flood) {
      this.group.remove(this.flood);
      this.flood.geometry.dispose();
      this.flood = null;
    }
    if (!s.inund) return;
    const { w } = s;
    const W = w + 1;
    const pts: number[] = [];
    const y = (cx: number, cy: number) => s.height[cy * W + cx] + FLOOD_DEPTH;
    for (let t = 0; t < s.inund.length; t++) {
      if (!s.inund[t]) continue;
      const tx = t % w;
      const ty = (t - tx) / w;
      pts.push(tx, y(tx, ty), ty, tx, y(tx, ty + 1), ty + 1, tx + 1, y(tx + 1, ty), ty);
      pts.push(tx + 1, y(tx + 1, ty), ty, tx, y(tx, ty + 1), ty + 1, tx + 1, y(tx + 1, ty + 1), ty + 1);
    }
    if (!pts.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    geo.computeVertexNormals();
    this.flood = new THREE.Mesh(geo, floodMaterial);
    this.flood.renderOrder = 1;
    this.group.add(this.flood);
  }

  /**
   * Keep the drawn ground in step with the rules (#701, the Water Road): a tile pumped out of the water rises out of it over a moment,
   * as wet mud that dries to field. Returns true when the shore moved this frame (the water's bed wants refreshing).
   */
  sync(s: GameState, dt: number): boolean {
    if (!this.mesh) return false;
    this.clock += dt;
    const { w, h } = s;
    const W = w + 1;
    const touched = new Set<number>();
    let moved = false;
    const n = drainedIn(s);
    if (n !== this.drainedSeen) {
      this.drainedSeen = n;
      for (let i = 0; i < w * h; i++) {
        const dug = s.channel ? s.channel[i] : 0;
        if (this.drawn[i] === s.terrain[i] && this.dug[i] === dug) continue;
        this.drawn[i] = s.terrain[i];
        this.dug[i] = dug;
        if (isPolder(s, i)) this.drying.set(i, this.clock);
        const x = i % w;
        const y = (i - x) / w;
        for (const c of [y * W + x, y * W + x + 1, (y + 1) * W + x, (y + 1) * W + x + 1]) if (this.shown[c] !== s.height[c]) this.rising.add(c);
        touched.add(i);
      }
    }
    if (this.rising.size) {
      moved = true;
      const k = Math.min(1, dt * 2.2);
      for (const c of [...this.rising]) {
        const to = s.height[c];
        const d = to - this.shown[c];
        this.shown[c] = Math.abs(d) < 0.01 ? to : this.shown[c] + d * k;
        if (this.shown[c] === to) this.rising.delete(c);
        const cx = c % W;
        const cy = (c - cx) / W;
        for (const [tx, ty] of [[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]]) if (tx >= 0 && ty >= 0 && tx < w && ty < h) touched.add(ty * w + tx);
      }
    }
    // Drying fields are repainted a few times a second, not every frame.
    if (this.drying.size && this.clock >= this.repaintAt) {
      this.repaintAt = this.clock + 0.25;
      for (const [t, at] of this.drying) {
        touched.add(t);
        if (this.clock - at > DRY_TIME) this.drying.delete(t);
      }
    }
    this.floodSheet(s);
    if (!touched.size) return moved;
    for (const t of touched) this.paint(s, t % w, Math.floor(t / w));
    const geo = this.mesh.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.computeBoundingSphere();
    return moved;
  }

  /** The drawn height of a tile corner. */
  heightOf(i: number): number {
    return this.shown[i];
  }

  /** Write one tile's two triangles: their corners at the drawn heights, each colored by the tile (meadow, beach, rock, lake floor, polder). */
  private paint(s: GameState, x: number, y: number): void {
    const { w } = s;
    const W = w + 1;
    const H = (cx: number, cy: number) => this.shown[cy * W + cx];
    const tile = y * w + x;
    let k = tile * 6;
    const { pos, col } = this;
    const tmp = TMP;
    const tri = (pts: readonly (readonly [number, number])[], t: number) => {
      // Slope: steep faces show as rock whatever the tile.
      const p0 = pts[0];
      const p1 = pts[1];
      const p2 = pts[2];
      A.set(p1[0] - p0[0], H(p1[0], p1[1]) - H(p0[0], p0[1]), p1[1] - p0[1]);
      B.set(p2[0] - p0[0], H(p2[0], p2[1]) - H(p0[0], p0[1]), p2[1] - p0[1]);
      V.crossVectors(A, B).normalize();
      const steep = Math.abs(V.y);
      const n = hash2(x * 2 + t, y, 7);
      const terr = s.terrain[tile];
      const avgH = (H(p0[0], p0[1]) + H(p1[0], p1[1]) + H(p2[0], p2[1])) / 3;
      // Broad, soft patches of color rather than speckle: smooth noise picks the shade.
      const patch = smooth(x + 0.5, y + 0.5, 6, 11);
      const fine = smooth(x + 0.5, y + 0.5, 2.5, 12);
      if (isInund(s, tile)) {
        tmp.copy(DROWNED[0]).lerp(DROWNED[1], fine);
      } else if (terr === T_WATER && isCanal(s, tile)) {
        tmp.copy(CANAL_BED[0]).lerp(CANAL_BED[1], fine);
      } else if (terr === T_WATER && isPond(s, tile)) {
        tmp.copy(POND[0]).lerp(POND[1], fine);
      } else if (terr === T_WATER) {
        tmp.copy(BED[0]).lerp(BED[1], Math.min(1, Math.max(0, -avgH * 0.8)));
      } else if (bared(s, tile)) {
        // Ribs of wet sand across the flats, darker in the runnels where the water lingers; a causeway's stone is drier and paler.
        if (isCauseway(s, tile)) tmp.copy(PAVING[0]).lerp(PAVING[1], (x + y) % 2 === 0 ? 0.2 : 0.6 * fine);
        else tmp.copy(WET[0]).lerp(WET[1], fine).lerp(WET[2], ((x * 3 + y) % 5 === 0 ? 0.5 : 0) + patch * 0.15);
      } else if (isPolder(s, tile)) {
        polderColor(tmp, x, y, t, fine, this.drying.has(tile) ? Math.min(1, (this.clock - this.drying.get(tile)!) / DRY_TIME) : 1);
      } else if (terr === T_SAND) {
        tmp.copy(SAND[0]).lerp(SAND[1], fine);
      } else if (terr === T_ROCK) {
        tmp.copy(ROCK[0]).lerp(ROCK[1], fine).lerp(ROCK[2], patch * 0.6);
        if (avgH > 2.6) tmp.lerp(SNOWCAP, Math.min(1, (avgH - 2.6) * 0.45));
      } else {
        tmp.copy(GRASS[0]).lerp(GRASS[2], fine * 0.8).lerp(GRASS[1], Math.max(0, 0.6 - patch) * 1.2);
        // Higher ground dries out; a few worn patches of earth.
        const dry = Math.max(0, Math.min(1, (avgH - 1.1) * 0.5)) * 0.45 + Math.max(0, patch - 0.72) * 1.2;
        tmp.lerp(DRY, Math.min(0.6, dry));
        if (fine < 0.18 && patch > 0.55) tmp.lerp(DIRT, 0.35);
      }
      if (terr !== T_WATER && s.channel && besideCanal(s, x, y)) tmp.lerp(TOWPATH, 0.45);
      if (terr !== T_WATER && steep < 0.8) tmp.lerp(CLIFF, Math.min(1, (0.8 - steep) * 2.6));
      // A whisper of light and shade per facet keeps the low-poly look without the noise.
      tmp.multiplyScalar(0.975 + n * 0.05);
      for (const [px, py] of pts) {
        pos[k * 3] = px;
        pos[k * 3 + 1] = H(px, py);
        pos[k * 3 + 2] = py;
        col[k * 3] = tmp.r;
        col[k * 3 + 1] = tmp.g;
        col[k * 3 + 2] = tmp.b;
        k++;
      }
    };
    // Alternate the diagonal for a less gridded look.
    if (hash2(x, y, 3) < 0.5) {
      tri([[x, y], [x, y + 1], [x + 1, y]], 0);
      tri([[x + 1, y], [x, y + 1], [x + 1, y + 1]], 1);
    } else {
      tri([[x, y], [x, y + 1], [x + 1, y + 1]], 0);
      tri([[x, y], [x + 1, y + 1], [x + 1, y]], 1);
    }
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
