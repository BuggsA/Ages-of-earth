import * as THREE from 'three';
import { hash2 } from '../sim/rng';
import type { Building, GameState } from '../sim/types';
import { Kit, bake } from './kit';
import { bakedMaterial } from './materials';
import { heightAt } from './terrain';

/**
 * The Age of the Mycelium's web (#800): pale threads that glow faintly blue, running out over the ground from each hall a fungus web
 * grows under, as far as it has spread, with a cluster of glowcaps where the longer threads end. A rival sees it where it sees the
 * ground now: glowing threads in a scouted town say the Bloom may be coming early. Kept in step with the web every half second.
 */

/** One thread a tile long, along +x from the origin: a faint kink in it, so the threads read as grown, not drawn. */
function threadGeometry(): THREE.BufferGeometry {
  const k = new Kit();
  // Only the caps glow: lit threads drowned the town in white lines.
  const bits: [number, number, number, number, string][] = [[0.1, 0.2, 0, 0.3, '#b9cdc4'], [0.32, 0.18, 0.03, -0.35, '#aac3bc'], [0.52, 0.2, 0.0, 0.4, '#b4cbc6'], [0.72, 0.18, 0.035, -0.25, '#a3bdb8'], [0.9, 0.16, 0.01, 0.2, '#9fb9b4']];
  for (const [x, w, z, turn, color] of bits) k.box(w, 0.01, 0.022, color, x, 0, z).rotation.y = turn;
  return bake(k.root);
}

/** A cluster of three small glowcaps. */
function capsGeometry(): THREE.BufferGeometry {
  const k = new Kit();
  for (const [x, z, h, r] of [[0, 0, 0.12, 0.08], [0.1, 0.06, 0.08, 0.06], [-0.07, 0.08, 0.06, 0.05]]) {
    k.cyl(r * 0.3, r * 0.35, h, 4, '#e8e2d2', x, 0, z);
    k.glow(k.dome(r, '#8fe0ee', x, h, z)).scale.y = 0.55;
  }
  return bake(k.root);
}

export class WebView {
  readonly group = new THREE.Group();
  private threads: THREE.InstancedMesh | null = null;
  private caps: THREE.InstancedMesh | null = null;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private last = -1;

  private ensure(n: number): void {
    if (this.threads && this.threads.instanceMatrix.count >= n) return;
    for (const m of [this.threads, this.caps]) if (m) this.group.remove(m);
    const make = (g: THREE.BufferGeometry) => {
      const mesh = new THREE.InstancedMesh(g, bakedMaterial, Math.max(64, n * 2));
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return mesh;
    };
    this.threads = make(threadGeometry());
    this.caps = make(capsGeometry());
  }

  /** Threads a hall's web shows: more round a bigger hall. */
  private static count(b: Building): number {
    return 6 + b.size * 2;
  }

  /** `sees`: the ground is in sight now (the viewer's own web is always drawn by the caller's rule). */
  update(s: GameState, sees: (b: Building) => boolean, time: number): void {
    // The web moves slowly: half a second between redraws is plenty.
    if (time - this.last < 0.5 && this.last >= 0) return;
    this.last = time;
    const webs: Building[] = [];
    let n = 0;
    for (const e of s.ents) {
      if (e.kind !== 'building' || !e.web || e.hp <= 0 || !sees(e)) continue;
      webs.push(e);
      n += WebView.count(e);
    }
    this.ensure(n);
    const threads = this.threads!;
    const caps = this.caps!;
    let a = 0;
    let c = 0;
    for (const b of webs) {
      const k = WebView.count(b);
      for (let i = 0; i < k; i++) {
        const jitter = hash2(b.id, i, 81);
        const ang = ((i + jitter * 0.6) / k) * Math.PI * 2;
        // From the hall's edge out to the web's reach, each thread a little shorter or longer.
        const start = b.size / 2 - 0.2;
        const len = Math.max(0.3, (b.web ?? 0) * (0.7 + 0.3 * hash2(b.id, i, 82)));
        const x = b.x + Math.cos(ang) * start;
        const z = b.y + Math.sin(ang) * start;
        this.q.setFromAxisAngle(this.up, -ang);
        this.p.set(x, heightAt(s, x, z) + 0.02, z);
        this.m.compose(this.p, this.q, this.sc.set(len, 1, 1));
        threads.setMatrixAt(a++, this.m);
        if (i % 2 === 0 && len > 1.5) {
          const ex = b.x + Math.cos(ang) * (start + len);
          const ez = b.y + Math.sin(ang) * (start + len);
          this.q.setFromAxisAngle(this.up, jitter * 6.28);
          this.p.set(ex, heightAt(s, ex, ez), ez);
          this.m.compose(this.p, this.q, this.sc.setScalar(1.2));
          caps.setMatrixAt(c++, this.m);
        }
      }
    }
    threads.count = a;
    caps.count = c;
    threads.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    if (this.threads) this.threads.count = 0;
    if (this.caps) this.caps.count = 0;
    this.last = -1;
  }
}
