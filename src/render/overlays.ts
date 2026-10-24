import * as THREE from 'three';
import { BUILDINGS, domainOf } from '../sim/data';
import type { BuildingType, GameState, Shot } from '../sim/types';
import type { ScoutFlag } from '../ui/scoutFlags';
import { buildingGeometry } from './buildingModels';
import { Kit, bake } from './kit';
import { heightAt } from './terrain';
import { AIR_ALT } from './unitsView';
import { WATER_Y } from './water';

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
  /** A thin line (a hero's reach), not a selection band. */
  thin?: boolean;
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
  private thin: THREE.InstancedMesh;
  private barBack: THREE.InstancedMesh;
  private barFill: THREE.InstancedMesh;
  private barMarks: THREE.InstancedMesh;
  private shots = new Map<Shot['kind'], THREE.InstancedMesh>();
  private ghost: THREE.Group;
  private ghostBody: THREE.Mesh;
  private ghostPad: THREE.Mesh;
  private ghostKey = '';
  private ghostMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false });
  /** A line of wall being laid out: a pad and a see-through piece on each tile. */
  private wallPads: THREE.InstancedMesh;
  private wallBody: THREE.InstancedMesh;
  private wallKey = '';
  private flag: THREE.Group;
  private flagCloth: THREE.Mesh;
  private scoutMasts: THREE.InstancedMesh;
  private scoutCloths: THREE.InstancedMesh;
  private scoutBases: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private c = new THREE.Color();

  constructor() {
    const ring = new THREE.RingGeometry(0.92, 1, 40);
    ring.rotateX(-Math.PI / 2);
    const mat = () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, fog: false, toneMapped: false });
    this.rings = new THREE.InstancedMesh(ring, mat(), MAX_RINGS);
    const sq = new THREE.RingGeometry(0.95, 1, 4, 1);
    sq.rotateZ(Math.PI / 4);
    sq.rotateX(-Math.PI / 2);
    this.squares = new THREE.InstancedMesh(sq, mat(), 64);
    const thin = new THREE.RingGeometry(0.985, 1, 64);
    thin.rotateX(-Math.PI / 2);
    this.thin = new THREE.InstancedMesh(thin, mat(), 16);
    const plane = new THREE.PlaneGeometry(1, 1);
    this.barBack = new THREE.InstancedMesh(plane, new THREE.MeshBasicMaterial({ color: '#1a1a1a', transparent: true, opacity: 0.75, depthWrite: false, fog: false }), MAX_BARS);
    this.barFill = new THREE.InstancedMesh(plane, new THREE.MeshBasicMaterial({ depthWrite: false, fog: false, toneMapped: false }), MAX_BARS);
    // Shape as well as color: fixed quarter marks remain readable as health falls.
    this.barMarks = new THREE.InstancedMesh(plane, new THREE.MeshBasicMaterial({ color: '#141414', depthWrite: false, fog: false, toneMapped: false }), MAX_BARS * 3);
    this.barMarks.count = 0;
    this.barMarks.frustumCulled = false;
    this.barMarks.renderOrder = 12;
    this.group.add(this.barMarks);
    for (const m of [this.rings, this.squares, this.thin, this.barBack, this.barFill]) {
      m.count = 0;
      m.frustumCulled = false;
      m.setColorAt(0, new THREE.Color());
      this.group.add(m);
    }
    this.rings.renderOrder = 3;
    this.squares.renderOrder = 3;
    this.thin.renderOrder = 3;
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
    const spear = new Kit();
    spear.box(0.022, 0.022, 0.62, '#8a6440', 0, -0.011, 0);
    spear.cone(0.03, 0.1, 4, '#7d7a72', 0, 0, 0.35).rotation.x = Math.PI / 2;
    const boulder = new Kit();
    boulder.rock(0.13, '#8d8579');
    const ball = new Kit();
    ball.sphere(0.08, '#2b2b2e');
    const bomb = new Kit();
    bomb.sphere(0.06, '#3a3e36', 0, 0, 0).scale.set(1, 1, 2.4);
    for (const r of [0, Math.PI / 2]) bomb.box(0.13, 0.008, 0.06, '#2b2b2e', 0, 0, -0.15).rotation.z = r;
    const shotMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });
    const bulletMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.0, 1.2), toneMapped: false });
    for (const [kind, k] of [['arrow', arrow], ['bolt', bolt], ['stone', stone], ['bullet', bullet], ['spear', spear], ['boulder', boulder], ['ball', ball], ['bomb', bomb]] as const) {
      const big = kind === 'boulder' || kind === 'ball' || kind === 'bomb';
      const mesh = new THREE.InstancedMesh(bake(k.root), kind === 'bullet' ? bulletMat : shotMat, big ? 64 : 256);
      mesh.castShadow = big;
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
    this.wallPads = new THREE.InstancedMesh(pad, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.38, depthWrite: false, fog: false }), 64);
    this.wallBody = new THREE.InstancedMesh(new THREE.BufferGeometry(), this.ghostMat, 64);
    for (const m of [this.wallPads, this.wallBody]) {
      m.count = 0;
      m.frustumCulled = false;
      m.setColorAt(0, new THREE.Color());
      m.renderOrder = 5;
      this.group.add(m);
    }

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

    // Three instanced batches make six low-poly field pennants cheap even on busy maps.
    const mast = new THREE.CylinderGeometry(0.018, 0.028, 1.12, 5);
    mast.translate(0, 0.56, 0);
    const pennant = new THREE.BufferGeometry();
    pennant.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 1.10, 0, 0.62, 0.99, 0, 0, 0.85, 0,
    ], 3));
    pennant.computeVertexNormals();
    const base = new THREE.RingGeometry(0.28, 0.38, 5);
    base.rotateX(-Math.PI / 2);
    base.translate(0, 0.04, 0);
    this.scoutMasts = new THREE.InstancedMesh(mast, new THREE.MeshStandardMaterial({ color: '#71543a', flatShading: true }), 6);
    this.scoutCloths = new THREE.InstancedMesh(pennant, new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, fog: false, toneMapped: false }), 6);
    this.scoutBases = new THREE.InstancedMesh(base, new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, depthWrite: false, transparent: true, opacity: 0.85, fog: false, toneMapped: false }), 6);
    for (const mesh of [this.scoutMasts, this.scoutCloths, this.scoutBases]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
    this.scoutBases.renderOrder = 3;
  }

  setRings(list: RingSpec[]): void {
    let n = 0;
    let k = 0;
    let t = 0;
    for (const r of list) {
      const mesh = r.square ? this.squares : r.thin ? this.thin : this.rings;
      const i = r.square ? k++ : r.thin ? t++ : n++;
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
    this.thin.count = Math.min(t, 16);
    for (const m of [this.rings, this.squares, this.thin]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  setBars(list: BarSpec[], camera: THREE.Camera): void {
    const n = Math.min(list.length, MAX_BARS);
    camera.getWorldQuaternion(this.q);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.q);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.q);
    // In a melee the bars of neighbours land on one line and fuse into a stripe: bars that fall in the same
    // patch of screen stack upward instead, so each stays a bar you can read.
    const cells = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const b = list[i];
      const h = 0.07;
      this.p.copy(b.at).project(camera);
      const key = Math.round(this.p.x * 28) * 4096 + Math.round(this.p.y * 40);
      const stack = cells.get(key) ?? 0;
      cells.set(key, stack + 1);
      if (stack) b.at = b.at.clone().addScaledVector(up, Math.min(stack, 4) * (h + 0.05));
      this.m.compose(b.at, this.q, this.sc.set(b.width + 0.07, h + 0.07, 1));
      this.barBack.setMatrixAt(i, this.m);
      this.barBack.setColorAt(i, this.c.set('#141414'));
      const f = Math.max(0, Math.min(1, b.frac));
      this.p.copy(b.at).addScaledVector(right, -(b.width * (1 - f)) / 2);
      this.m.compose(this.p, this.q, this.sc.set(Math.max(0.001, b.width * f), h, 1));
      this.barFill.setMatrixAt(i, this.m);
      this.c.setRGB(f > 0.5 ? (1 - f) * 2 : 1, f > 0.5 ? 1 : f * 2, 0.15).multiplyScalar(1.1);
      this.barFill.setColorAt(i, this.c);
      for (let j = 0; j < 3; j++) {
        this.p.copy(b.at).addScaledVector(right, b.width * ((j + 1) / 4 - 0.5));
        this.m.compose(this.p, this.q, this.sc.set(b.width * 0.015, h, 1));
        this.barMarks.setMatrixAt(i * 3 + j, this.m);
      }
    }
    this.barMarks.count = n * 3;
    this.barMarks.instanceMatrix.needsUpdate = true;
    for (const m of [this.barBack, this.barFill]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  /** Shots in flight, arcing (arrows and stones) or flat (musket balls), pointing along their path; bombs drop. */
  setShots(s: GameState, alpha: number, visible: (x: number, y: number) => boolean): void {
    const counts = new Map<Shot['kind'], number>();
    for (const sh of s.shots) {
      const t = Math.min(1, (sh.t - 1 + alpha) / sh.dur);
      if (t < 0) continue;
      const x = sh.x0 + (sh.tx - sh.x0) * t;
      const y = sh.y0 + (sh.ty - sh.y0) * t;
      if (!visible(x, y)) continue;
      const dist = Math.hypot(sh.tx - sh.x0, sh.ty - sh.y0);
      // Aimed up at aircraft, or fired down from them, it flies straight.
      const tgt = s.byId.get(sh.target);
      const atAir = !sh.animal && !!tgt && tgt.kind === 'unit' && domainOf(tgt.type) === 'air';
      const straight = sh.kind === 'bullet' || sh.kind === 'bomb' || atAir || !!sh.fromAir;
      const arc = straight ? 0 : sh.kind === 'boulder' ? dist * 0.32 : sh.kind === 'ball' ? dist * 0.05 : dist * 0.16;
      const g0 = Math.max(WATER_Y, heightAt(s, sh.x0, sh.y0)) + (sh.fromAir ? AIR_ALT - 0.1 : 0.45);
      const g1 = Math.max(WATER_Y, heightAt(s, sh.tx, sh.ty)) + (atAir ? AIR_ALT : 0.3);
      const h = g0 + (g1 - g0) * t + Math.sin(t * Math.PI) * arc;
      const slope = (g1 - g0) / Math.max(0.01, dist) + (Math.cos(t * Math.PI) * Math.PI * arc) / Math.max(0.01, dist);
      const mesh = this.shots.get(sh.kind);
      if (!mesh) continue;
      const i = counts.get(sh.kind) ?? 0;
      if (i >= mesh.instanceMatrix.count) continue;
      counts.set(sh.kind, i + 1);
      this.e.set(sh.kind === 'bomb' ? Math.min(1.45, 0.3 + t * 1.6) : -Math.atan(slope), Math.atan2(sh.tx - sh.x0, sh.ty - sh.y0), 0, 'YXZ');
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
  setGhost(s: GameState, g: { type: BuildingType; tx: number; ty: number; ok: boolean; epoch: number; color: string; turn?: boolean } | null): void {
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
    this.ghostBody.rotation.y = g.turn ? Math.PI / 2 : 0;
    (this.ghostPad.material as THREE.MeshBasicMaterial).color.set(g.ok ? '#5cff7a' : '#ff5050');
    this.ghostMat.color.set(g.ok ? '#ffffff' : '#ff8080');
    this.ghost.visible = true;
  }

  /** Show a planned line of wall, or of dykes or a channel (#701) (an empty list hides it). */
  setWallGhost(s: GameState, tiles: { x: number; y: number; ok: boolean }[], epoch: number, color: string, alongY: boolean, type: 'wall' | 'dyke' | 'channel' = 'wall'): void {
    const key = `${type}:${epoch}:${color}:${alongY ? 1 : 0}`;
    if (key !== this.wallKey) {
      this.wallKey = key;
      this.wallBody.geometry = buildingGeometry(type, epoch, color, alongY ? 10 : 5);
    }
    const n = Math.min(tiles.length, 64);
    for (let i = 0; i < n; i++) {
      const t = tiles[i];
      // A dyke's ghost floats on the water it would stand in.
      const hgt = type === 'dyke' ? Math.max(0.02, heightAt(s, t.x + 0.5, t.y + 0.5)) : heightAt(s, t.x + 0.5, t.y + 0.5);
      this.m.compose(this.p.set(t.x + 0.5, hgt + 0.04, t.y + 0.5), this.q.identity(), this.sc.set(0.96, 1, 0.96));
      this.wallPads.setMatrixAt(i, this.m);
      this.wallPads.setColorAt(i, this.c.set(t.ok ? '#5cff7a' : '#ff5050'));
      this.m.compose(this.p.set(t.x + 0.5, hgt, t.y + 0.5), this.q, this.sc.set(1, 1, 1));
      this.wallBody.setMatrixAt(i, this.m);
      this.wallBody.setColorAt(i, this.c.set(t.ok ? '#ffffff' : '#ff8080'));
    }
    for (const m of [this.wallPads, this.wallBody]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  /** Personal plan/danger markers, with no relation to authoritative game state. */
  setScoutFlags(s: GameState, flags: readonly ScoutFlag[], time: number): void {
    const n = Math.min(6, flags.length);
    for (let i = 0; i < n; i++) {
      const f = flags[i];
      this.p.set(f.x, Math.max(WATER_Y, heightAt(s, f.x, f.y)), f.y);
      this.e.set(0, Math.sin(time * 1.6 + i * 0.8) * 0.18, 0);
      this.q.setFromEuler(this.e);
      this.m.compose(this.p, this.q, this.sc.set(1, 1, 1));
      this.scoutMasts.setMatrixAt(i, this.m);
      this.scoutCloths.setMatrixAt(i, this.m);
      this.scoutBases.setMatrixAt(i, this.m);
      const color = f.kind === 'danger' ? '#ff655a' : '#ffdf8a';
      this.scoutCloths.setColorAt(i, this.c.set(color));
      this.scoutBases.setColorAt(i, this.c.set(color));
    }
    for (const mesh of [this.scoutMasts, this.scoutCloths, this.scoutBases]) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
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

