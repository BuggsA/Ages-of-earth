import * as THREE from 'three';
import { TICK_HZ, unitStats } from '../sim/data';
import type { GameState, Unit, UnitType } from '../sim/types';
import { unitMaterial } from './materials';
import { heightAt } from './terrain';
import { unitGeometry } from './unitModels';

/** Units are drawn a little larger than their footprint in the rules, so they read well from above. */
export const UNIT_SCALE = 1.3;

/**
 * All units drawn with one instanced mesh per model (a line in an epoch). Each frame every visible unit
 * is placed between its last two positions, turned smoothly toward where it faces, and animated: legs
 * walk, the arm strikes, shoots, chops, mines, builds or farms. The fallen tip over, lie a while and
 * sink away.
 */

interface Anim {
  yaw: number;
  phase: number;
  lastX: number;
  lastY: number;
  speed: number;
}

interface Corpse {
  type: UnitType;
  epoch: number;
  color: THREE.Color;
  x: number;
  y: number;
  yaw: number;
  age: number;
  side: number;
}

class Batch {
  mesh: THREE.InstancedMesh;
  anim: THREE.InstancedBufferAttribute;
  count = 0;

  constructor(
    private geo: THREE.BufferGeometry,
    private cap: number,
    private parent: THREE.Object3D,
  ) {
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.anim.setUsage(THREE.DynamicDrawUsage);
    this.mesh = this.make();
  }

  private make(): THREE.InstancedMesh {
    // Each batch gets its own geometry wrapper so its per-instance animation buffer is its own.
    const g = new THREE.BufferGeometry();
    for (const [k, v] of Object.entries(this.geo.attributes)) g.setAttribute(k, v);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    g.setAttribute('aAnim', this.anim);
    const mesh = new THREE.InstancedMesh(g, unitMaterial, this.cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, new THREE.Color());
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.parent.add(mesh);
    return mesh;
  }

  reserve(n: number): void {
    if (n <= this.cap) return;
    const old = this.mesh;
    this.parent.remove(old);
    old.dispose();
    this.cap = Math.max(n, this.cap * 2);
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 3), 3);
    this.anim.setUsage(THREE.DynamicDrawUsage);
    this.mesh = this.make();
  }
}

export interface ScreenUnit {
  id: number;
  sx: number;
  sy: number;
  r: number;
}

export class UnitsView {
  readonly group = new THREE.Group();
  private batches = new Map<string, Batch>();
  private anims = new Map<number, Anim>();
  private corpses: Corpse[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler(0, 0, 0, 'YXZ');
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3(1, 1, 1);
  private v = new THREE.Vector3();
  private colors: THREE.Color[] = [];
  /** Where each drawn unit landed on screen this frame, for picking and box selection. */
  readonly screen: ScreenUnit[] = [];
  /** World positions of drawn units this frame (for overlays). */
  readonly drawn = new Map<number, THREE.Vector3>();

  setColors(colors: string[]): void {
    this.colors = colors.map((c) => new THREE.Color(c));
  }

  private batch(type: UnitType, epoch: number): Batch {
    const key = `${type}:${epoch}`;
    let b = this.batches.get(key);
    if (!b) {
      b = new Batch(unitGeometry(type, epoch), 64, this.group);
      this.batches.set(key, b);
    }
    return b;
  }

  /** A unit died: it falls where it stood. */
  fall(type: UnitType, epoch: number, owner: number, x: number, y: number, fx: number, fy: number, id: number): void {
    const a = this.anims.get(id);
    this.anims.delete(id);
    this.corpses.push({ type, epoch, color: this.colors[owner] ?? new THREE.Color('#ffffff'), x, y, yaw: a ? a.yaw : Math.atan2(fx, fy), age: 0, side: id % 2 ? 1 : -1 });
    if (this.corpses.length > 160) this.corpses.shift();
  }

  clear(): void {
    this.anims.clear();
    this.corpses = [];
  }

  update(
    s: GameState,
    alpha: number,
    dt: number,
    time: number,
    visible: (u: Unit) => boolean,
    camera: THREE.Camera,
    width: number,
    height: number,
  ): void {
    for (const b of this.batches.values()) b.count = 0;
    this.screen.length = 0;
    this.drawn.clear();
    const ticks = s.tick - 1 + alpha;

    // Count per batch first so buffers are big enough.
    const need = new Map<string, number>();
    const show: Unit[] = [];
    for (const e of s.ents) {
      if (e.kind !== 'unit' || e.hp <= 0 || !visible(e)) continue;
      show.push(e);
      const key = `${e.type}:${s.players[e.owner].epoch}`;
      need.set(key, (need.get(key) ?? 0) + 1);
    }
    for (const c of this.corpses) {
      const key = `${c.type}:${c.epoch}`;
      need.set(key, (need.get(key) ?? 0) + 1);
    }
    for (const [key, n] of need) {
      const [type, epoch] = key.split(':');
      this.batch(type as UnitType, Number(epoch)).reserve(n);
    }

    const seen = new Set<number>();
    for (const u of show) {
      seen.add(u.id);
      const epoch = s.players[u.owner].epoch;
      const st = unitStats(u.type, epoch);
      const x = u.px + (u.x - u.px) * alpha;
      const y = u.py + (u.y - u.py) * alpha;
      let a = this.anims.get(u.id);
      if (!a) {
        a = { yaw: Math.atan2(u.fx, u.fy), phase: (u.id * 1.7) % 6.28, lastX: x, lastY: y, speed: 0 };
        this.anims.set(u.id, a);
      }
      const mdx = x - a.lastX;
      const mdy = y - a.lastY;
      const moved = Math.sqrt(mdx * mdx + mdy * mdy);
      a.speed += ((dt > 0 ? moved / dt : 0) - a.speed) * Math.min(1, dt * 12);
      a.lastX = x;
      a.lastY = y;
      // Turn toward the facing the rules give, the short way round.
      const want = Math.atan2(u.fx, u.fy);
      let d = want - a.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      a.yaw += d * Math.min(1, dt * 12);

      const walking = a.speed > 0.15;
      const mounted = u.type === 'cavalry';
      a.phase += dt * (walking ? a.speed * (mounted ? 5.5 : 8.5) : 0);
      let leg = walking ? Math.sin(a.phase) * (mounted ? 0.5 : 0.6) : 0;
      let arm = 0;
      let bob = walking ? Math.abs(Math.sin(a.phase)) * (mounted ? 0.045 : 0.025) : 0;
      const since = (ticks - u.swing) / TICK_HZ;
      const ph = u.id * 0.77;
      switch (u.act) {
        case 'attack':
          if (st.range > 0) {
            // Aim, with a kick when the shot goes.
            arm = -1.45 + (since >= 0 && since < 0.2 ? (0.2 - since) * 2.5 : 0);
          } else if (since >= 0 && since < 0.55) {
            // Raise, strike, recover.
            const t = since / 0.55;
            arm = t < 0.25 ? -2.5 * (t / 0.25) : t < 0.45 ? -2.5 + 2.3 * ((t - 0.25) / 0.2) : -0.2 * (1 - (t - 0.45) / 0.55);
          } else arm = -0.3;
          break;
        case 'chop':
        case 'mine':
        case 'build': {
          const c = Math.sin(time * 7 + ph);
          arm = -1.2 - c * 0.9;
          if (!walking) bob = Math.max(0, c) * 0.008;
          break;
        }
        case 'forage':
        case 'farm':
          arm = -0.7 + Math.sin(time * 4 + ph) * 0.35;
          leg = Math.sin(time * 2 + ph) * 0.08;
          break;
        default:
          arm = walking ? -leg * 0.5 : Math.sin(time * 1.3 + ph) * 0.04;
          if (!walking) bob = Math.sin(time * 1.6 + ph) * 0.004;
      }

      const gy = heightAt(s, x, y);
      const b = this.batch(u.type, epoch);
      const i = b.count++;
      this.e.set(0, a.yaw, 0);
      this.q.setFromEuler(this.e);
      this.p.set(x, gy, y);
      const k = mounted ? UNIT_SCALE * 0.88 : UNIT_SCALE;
      this.m.compose(this.p, this.q, this.sc.set(k, k, k));
      b.mesh.setMatrixAt(i, this.m);
      b.mesh.setColorAt(i, this.colors[u.owner]);
      b.anim.setXYZ(i, leg, arm, bob);
      this.drawn.set(u.id, new THREE.Vector3(x, gy, y));

      // Where it lands on screen, for picking.
      this.v.set(x, gy + (mounted ? 0.62 : 0.42), y).project(camera);
      if (this.v.z < 1) {
        const sx = ((this.v.x + 1) / 2) * width;
        const sy = ((1 - this.v.y) / 2) * height;
        this.screen.push({ id: u.id, sx, sy, r: Math.max(10, (st.radius * 1200) / Math.max(1, camera.position.distanceTo(this.p))) });
      }
    }
    for (const id of this.anims.keys()) if (!seen.has(id)) this.anims.delete(id);

    // The fallen: tip over, lie still, then sink.
    const keep: Corpse[] = [];
    for (const c of this.corpses) {
      c.age += dt;
      if (c.age > 9) continue;
      keep.push(c);
      const fall = Math.min(1, c.age / 0.45);
      const ease = fall * fall;
      const sink = c.age > 7 ? (c.age - 7) * 0.2 : 0;
      const b = this.batch(c.type, c.epoch);
      const i = b.count++;
      this.e.set(0, c.yaw, c.side * ease * (Math.PI / 2 - 0.15));
      this.q.setFromEuler(this.e);
      this.p.set(c.x, heightAt(s, c.x, c.y) + 0.04 - sink, c.y);
      const k = c.type === 'cavalry' ? UNIT_SCALE * 0.88 : UNIT_SCALE;
      this.m.compose(this.p, this.q, this.sc.set(k, k, k));
      b.mesh.setMatrixAt(i, this.m);
      b.mesh.setColorAt(i, c.color);
      b.anim.setXYZ(i, 0, -0.4 * ease, 0);
    }
    this.corpses = keep;

    for (const b of this.batches.values()) {
      b.mesh.count = b.count;
      b.mesh.instanceMatrix.needsUpdate = true;
      if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
      b.anim.needsUpdate = true;
    }
  }
}
