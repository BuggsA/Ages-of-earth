import * as THREE from 'three';
import type { GameState } from '../sim/types';
import { flightOf, missilesAt } from '../sim/silo';
import type { Effects } from './effects';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';

/**
 * Missiles in the air (#772): a slender pale rocket with a band of its people's colour, dark fins and a red nose, flying the course every
 * player sees (`missilesAt`), nose along its way, with a short trail of smoke and a spark of exhaust behind. Drawn for every player through
 * the fog: it is high in the sky. No line to the ground, and nothing of the course ahead.
 */

function missileGeometry(): THREE.BufferGeometry {
  const k = new Kit();
  // Built standing on its tail along +y; the view turns it along its flight.
  k.cyl(0.07, 0.08, 0.9, 8, '#e8e4dc', 0, -0.45, 0);
  k.cone(0.07, 0.26, 8, '#b8322a', 0, 0.45, 0);
  k.team(k.cyl(0.075, 0.075, 0.1, 8, '#ffffff', 0, 0.22, 0));
  k.cyl(0.085, 0.06, 0.08, 8, '#3a3632', 0, -0.53, 0);
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) k.box(x ? 0.14 : 0.02, 0.22, z ? 0.14 : 0.02, '#4a4640', x * 0.1, -0.45, z * 0.1);
  return bake(k.root);
}

export class MissileView {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private dir = new THREE.Vector3();
  private sc = new THREE.Vector3(1.6, 1.6, 1.6);
  private c = new THREE.Color();
  private up = new THREE.Vector3(0, 1, 0);

  private ensure(n: number): THREE.InstancedMesh {
    if (!this.mesh || this.mesh.instanceMatrix.count < n) {
      if (this.mesh) this.group.remove(this.mesh);
      this.mesh = new THREE.InstancedMesh(missileGeometry(), bakedMaterial, Math.max(6, n * 2));
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.castShadow = true;
      this.mesh.frustumCulled = false;
      this.group.add(this.mesh);
    }
    return this.mesh;
  }

  /**
   * Where a missile is drawn in the world at tick `t`: its ground point, raised by the course's height. The ground under it is the silo's
   * through the climb (so the climb says nothing of the ground at the target), then eases to its target's on the bend.
   */
  private place(s: GameState, f: NonNullable<ReturnType<typeof flightOf>>, p: { x: number; y: number; z: number }, to: { x: number; y: number }, t: number, out: THREE.Vector3): THREE.Vector3 {
    const g = Math.max(0, Math.min(1, (t - f.tk) / (f.at - f.tk)));
    const base = heightAt(s, f.o.x, f.o.y) * (1 - g) + heightAt(s, to.x, to.y) * g;
    return out.set(p.x, base + p.z, p.y);
  }

  /** `t`: the tick and the fraction of the next one; `dt`: seconds since the last frame, for the trail. */
  update(s: GameState, t: number, dt: number, fx: Effects): void {
    const launches = s.launches ?? [];
    const mesh = this.ensure(launches.length * 3);
    let a = 0;
    for (const l of launches) {
      const f = flightOf(l);
      if (!f) continue;
      const now = missilesAt(l, t), before = missilesAt(l, t - 1);
      const aims = l.salvo ? l.salvo.filter((sh) => !sh.gone) : [{ x: l.x, y: l.y }];
      now.forEach((pt, i) => {
        // On the climb there is one missile: it is drawn over the first aim's ground only once it bends.
        const to = aims[now.length === 1 ? 0 : i] ?? aims[0];
        const at = this.place(s, f, pt, to, t, this.p).clone();
        const was = before.length === now.length ? this.place(s, f, before[i], to, t - 1, new THREE.Vector3()) : at.clone().sub(this.up);
        this.dir.subVectors(at, was);
        if (this.dir.lengthSq() < 1e-9) this.dir.copy(this.up);
        this.q.setFromUnitVectors(this.up, this.dir.normalize());
        this.m.compose(at, this.q, this.sc);
        mesh.setColorAt(a, this.c.set(s.players[l.owner].color));
        mesh.setMatrixAt(a++, this.m);
        // The trail: smoke left hanging where it passed, and a spark at the tail.
        const tail = at.clone().addScaledVector(this.dir, -0.9);
        if (Math.random() < dt / 0.035) fx.burst(tail, { count: 1, speed: 0.15, up: 0.2, life: 1.3, size: 0.13, grow: 2.6, gravity: -0.05, drag: 1.5, soft: true, colors: ['#e9e5de', '#cfc9c0', '#b5aea4'] });
        if (Math.random() < dt / 0.05) fx.burst(tail, { count: 1, speed: 0.4, up: 0, life: 0.18, size: 0.08, grow: 0.3, gravity: 0, drag: 2, colors: ['#ffe9a0', '#ff9a3c'] });
      });
    }
    mesh.count = a;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  clear(): void {
    if (this.mesh) this.mesh.count = 0;
  }
}
