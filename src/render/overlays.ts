import * as THREE from 'three';
import { BUILDINGS } from '../sim/data';
import type { BuildingType, GameState, Shot } from '../sim/types';
import { buildingGeometry } from './buildingModels';
import { Kit, bake } from './kit';
import { heightAt } from './terrain';

/**
 * Things drawn over the world: selection rings, health bars, shots in flight, the building being placed
 * and the selected building's rally flag.
 */

const MAX_RINGS = 400;
const MAX_BARS = 400;

export interface RingSpec {
  x: number;
  y: number;
  z: number;
  r: number;
  color: THREE.Color;
  square?: boolean;
}

export interface BarSpec {
  at: THREE.Vector3;
  width: number;
  frac: number;
}

export class Overlays {
  readonly group = new THREE.Group();
  private rings: THREE.InstancedMesh;
  private squares: THREE.InstancedMesh;
  private barBack: THREE.InstancedMesh;
  private barFill: THREE.InstancedMesh;
  private shots = new Map<Shot['kind'], THREE.InstancedMesh>();
  private ghost: THREE.Group;
  private ghostBody: THREE.Mesh;
  private ghostPad: THREE.Mesh;
  private ghostKey = '';
  private ghostMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false });
  private flag: THREE.Group;
  private flagCloth: THREE.Mesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private c = new THREE.Color();

  constructor() {
    const ring = new THREE.RingGeometry(0.86, 1, 40);
    ring.rotateX(-Math.PI / 2);
    const mat = () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, fog: false, toneMapped: false });
    this.rings = new THREE.InstancedMesh(ring, mat(), MAX_RINGS);
    const sq = new THREE.RingGeometry(0.93, 1, 4, 1);
    sq.rotateZ(Math.PI / 4);
    sq.rotateX(-Math.PI / 2);
    this.squares = new THREE.InstancedMesh(sq, mat(), 64);
    const plane = new THREE.PlaneGeometry(1, 1);
    this.barBack = new THREE.InstancedMesh(plane, new THREE.MeshBasicMaterial({ color: '#1a1a1a', transparent: true, opacity: 0.75, depthWrite: false, fog: false }), MAX_BARS);
    this.barFill = new THREE.InstancedMesh(plane, new THREE.MeshBasicMaterial({ depthWrite: false, fog: false, toneMapped: false }), MAX_BARS);
    for (const m of [this.rings, this.squares, this.barBack, this.barFill]) {
      m.count = 0;
      m.frustumCulled = false;
      m.setColorAt(0, new THREE.Color());
      this.group.add(m);
    }
    this.rings.renderOrder = 3;
    this.squares.renderOrder = 3;
    this.barBack.renderOrder = 10;
    this.barFill.renderOrder = 11;

    // Shots: an arrow, a bolt, a sling stone and a musket ball's streak.
    const arrow = new Kit();
    arrow.box(0.018, 0.018, 0.42, '#8a6440', 0, -0.009, 0);
    arrow.cone(0.03, 0.07, 4, '#c3c9d1', 0, 0, 0.24).rotation.x = Math.PI / 2;
    arrow.box(0.05, 0.004, 0.07, '#f0f0f0', 0, 0, -0.18);
    const bolt = new Kit();
    bolt.box(0.024, 0.024, 0.26, '#6b4a30', 0, -0.012, 0);
    bolt.cone(0.034, 0.06, 4, '#9aa1aa', 0, 0, 0.15).rotation.x = Math.PI / 2;
    const stone = new Kit();
    stone.rock(0.045, '#8a8a84');
    const bullet = new Kit();
    bullet.glow(bullet.box(0.025, 0.025, 0.5, '#ffd27a', 0, -0.012, 0));
    const shotMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });
    const bulletMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.0, 1.2), toneMapped: false });
    for (const [kind, k] of [['arrow', arrow], ['bolt', bolt], ['stone', stone], ['bullet', bullet]] as const) {
      const mesh = new THREE.InstancedMesh(bake(k.root), kind === 'bullet' ? bulletMat : shotMat, 256);
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.shots.set(kind, mesh);
      this.group.add(mesh);
    }

    this.ghost = new THREE.Group();
    this.ghostBody = new THREE.Mesh(new THREE.BufferGeometry(), this.ghostMat);
    const pad = new THREE.PlaneGeometry(1, 1);
    pad.rotateX(-Math.PI / 2);
    this.ghostPad = new THREE.Mesh(pad, new THREE.MeshBasicMaterial({ color: '#5cff7a', transparent: true, opacity: 0.32, depthWrite: false, fog: false }));
    this.ghostPad.position.y = 0.04;
    this.ghost.add(this.ghostBody, this.ghostPad);
    this.ghost.visible = false;
    this.ghost.renderOrder = 5;
    this.group.add(this.ghost);

    const pole = new Kit();
    pole.cyl(0.02, 0.025, 0.9, 5, '#5b4330');
    pole.sphere(0.035, '#e2b23c', 0, 0.92, 0);
    this.flag = new THREE.Group();
    this.flag.add(new THREE.Mesh(bake(pole.root), shotMat));
    this.flagCloth = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.22, 0.32), new THREE.MeshStandardMaterial({ flatShading: true }));
    this.flagCloth.position.set(0, 0.73, 0.16);
    this.flag.add(this.flagCloth);
    this.flag.visible = false;
    this.group.add(this.flag);
  }

  setRings(list: RingSpec[]): void {
    let n = 0;
    let k = 0;
    for (const r of list) {
      const mesh = r.square ? this.squares : this.rings;
      const i = r.square ? k++ : n++;
      if (i >= mesh.instanceMatrix.count) continue;
      this.p.set(r.x, r.y + 0.05, r.z);
      this.q.identity();
      this.sc.set(r.r, 1, r.r);
      this.m.compose(this.p, this.q, this.sc);
      mesh.setMatrixAt(i, this.m);
      mesh.setColorAt(i, r.color);
    }
    this.rings.count = Math.min(n, MAX_RINGS);
    this.squares.count = Math.min(k, 64);
    for (const m of [this.rings, this.squares]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  setBars(list: BarSpec[], camera: THREE.Camera): void {
    const n = Math.min(list.length, MAX_BARS);
    camera.getWorldQuaternion(this.q);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.q);
    for (let i = 0; i < n; i++) {
      const b = list[i];
      const h = 0.07;
      this.m.compose(b.at, this.q, this.sc.set(b.width + 0.04, h + 0.035, 1));
      this.barBack.setMatrixAt(i, this.m);
      this.barBack.setColorAt(i, this.c.set('#141414'));
      const f = Math.max(0, Math.min(1, b.frac));
      this.p.copy(b.at).addScaledVector(right, -(b.width * (1 - f)) / 2);
      this.m.compose(this.p, this.q, this.sc.set(Math.max(0.001, b.width * f), h, 1));
      this.barFill.setMatrixAt(i, this.m);
      this.c.setRGB(f > 0.5 ? (1 - f) * 2 : 1, f > 0.5 ? 1 : f * 2, 0.15).multiplyScalar(1.1);
      this.barFill.setColorAt(i, this.c);
    }
    for (const m of [this.barBack, this.barFill]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  /** Shots in flight, arcing (arrows and stones) or flat (musket balls), pointing along their path. */
  setShots(s: GameState, alpha: number, visible: (x: number, y: number) => boolean): void {
    const counts = new Map<Shot['kind'], number>();
    for (const sh of s.shots) {
      const t = Math.min(1, (sh.t - 1 + alpha) / sh.dur);
      if (t < 0) continue;
      const x = sh.x0 + (sh.tx - sh.x0) * t;
      const y = sh.y0 + (sh.ty - sh.y0) * t;
      if (!visible(x, y)) continue;
      const dist = Math.hypot(sh.tx - sh.x0, sh.ty - sh.y0);
      const arc = sh.kind === 'bullet' ? 0 : dist * 0.16;
      const g0 = heightAt(s, sh.x0, sh.y0) + 0.45;
      const g1 = heightAt(s, sh.tx, sh.ty) + 0.3;
      const h = g0 + (g1 - g0) * t + Math.sin(t * Math.PI) * arc;
      const slope = (g1 - g0) / Math.max(0.01, dist) + (Math.cos(t * Math.PI) * Math.PI * arc) / Math.max(0.01, dist);
      const mesh = this.shots.get(sh.kind)!;
      const i = counts.get(sh.kind) ?? 0;
      if (i >= mesh.instanceMatrix.count) continue;
      counts.set(sh.kind, i + 1);
      this.e.set(-Math.atan(slope), Math.atan2(sh.tx - sh.x0, sh.ty - sh.y0), 0, 'YXZ');
      this.q.setFromEuler(this.e);
      this.m.compose(this.p.set(x, h, y), this.q, this.sc.set(1, 1, 1));
      mesh.setMatrixAt(i, this.m);
    }
    for (const [kind, mesh] of this.shots) {
      mesh.count = counts.get(kind) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Show (or hide, with null) the building about to be placed. */
  setGhost(s: GameState, g: { type: BuildingType; tx: number; ty: number; ok: boolean; epoch: number; color: string } | null): void {
    if (!g) {
      this.ghost.visible = false;
      return;
    }
    const key = `${g.type}:${g.epoch}:${g.color}`;
    if (key !== this.ghostKey) {
      this.ghostKey = key;
      this.ghostBody.geometry = buildingGeometry(g.type, g.epoch, g.color);
    }
    const n = BUILDINGS[g.type].size;
    const cx = g.tx + n / 2;
    const cy = g.ty + n / 2;
    let hi = -Infinity;
    for (let y = g.ty; y <= g.ty + n; y++) for (let x = g.tx; x <= g.tx + n; x++) if (x >= 0 && y >= 0 && x <= s.w && y <= s.h) hi = Math.max(hi, s.height[y * (s.w + 1) + x]);
    this.ghost.position.set(cx, Math.max(0, hi === -Infinity ? 0 : hi), cy);
    this.ghostPad.scale.set(n, 1, n);
    (this.ghostPad.material as THREE.MeshBasicMaterial).color.set(g.ok ? '#5cff7a' : '#ff5050');
    this.ghostMat.color.set(g.ok ? '#ffffff' : '#ff8080');
    this.ghost.visible = true;
  }

  setFlag(s: GameState, at: { x: number; y: number } | null, color: string, time: number): void {
    if (!at) {
      this.flag.visible = false;
      return;
    }
    (this.flagCloth.material as THREE.MeshStandardMaterial).color.set(color);
    this.flag.position.set(at.x, heightAt(s, at.x, at.y), at.y);
    this.flag.rotation.y = Math.sin(time * 1.5) * 0.25;
    this.flag.visible = true;
  }
}
