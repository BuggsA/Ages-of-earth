import * as THREE from 'three';

/**
 * Short-lived things drawn over the map: sparks and puffs, rings that spread over the ground, glowing
 * shots in flight, floating numbers, chimney smoke and seabirds. Everything is pooled, so a busy turn
 * costs no allocations.
 */

const MAX_SPARKS = 900;
const MAX_RINGS = 24;
const MAX_SHOTS = 24;

interface Spark {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  age: number;
  life: number;
  size0: number;
  size1: number;
  gravity: number;
  drag: number;
  spin: number;
}

interface Ring {
  mesh: THREE.Mesh;
  age: number;
  life: number;
  size: number;
}

interface Shot {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  age: number;
  life: number;
  color: THREE.Color;
}

interface FloatText {
  el: HTMLDivElement;
  at: THREE.Vector3;
  age: number;
  life: number;
}

export interface BurstOptions {
  count?: number;
  speed?: number;
  /** How strongly the burst leans upward (0 spreads evenly, 1 shoots up). */
  up?: number;
  life?: number;
  size?: number;
  /** Size at the end of life, as a multiple of the starting size. */
  grow?: number;
  gravity?: number;
  drag?: number;
  /** Several colors to pick from at random. */
  colors?: THREE.ColorRepresentation[];
  /** Smoke and dust: drawn plainly, without the glow that sparks have. */
  soft?: boolean;
}

interface Pool {
  mesh: THREE.InstancedMesh;
  list: Spark[];
}

export class Effects {
  readonly group = new THREE.Group();
  private pools: [Pool, Pool];
  private rings: Ring[] = [];
  private ringFree: THREE.Mesh[] = [];
  private shots: Shot[] = [];
  private shotFree: THREE.Mesh[] = [];
  private texts: FloatText[] = [];
  private queue: { at: number; run: () => void }[] = [];
  private clock = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private e = new THREE.Euler();

  constructor(private layer: HTMLElement) {
    const pool = (geo: THREE.BufferGeometry, mat: THREE.Material): Pool => {
      const mesh = new THREE.InstancedMesh(geo, mat, MAX_SPARKS);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.setColorAt(0, new THREE.Color());
      this.group.add(mesh);
      return { mesh, list: [] };
    };
    // Sparks are bright enough to catch the bloom (their color is multiplied past white); smoke is lit plainly.
    this.pools = [
      pool(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.2), fog: false })),
      pool(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: new THREE.Color('#6a6660'), transparent: true, opacity: 0.6, depthWrite: false })),
    ];

    const ringGeo = new THREE.RingGeometry(0.82, 1, 36);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_RINGS; i++) {
      const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      mesh.visible = false;
      mesh.renderOrder = 4;
      this.group.add(mesh);
      this.ringFree.push(mesh);
    }
    const shotGeo = new THREE.SphereGeometry(0.07, 8, 6);
    for (let i = 0; i < MAX_SHOTS; i++) {
      const mesh = new THREE.Mesh(shotGeo, new THREE.MeshBasicMaterial({ fog: false }));
      mesh.visible = false;
      this.group.add(mesh);
      this.shotFree.push(mesh);
    }
  }

  /** Run something a little later (seconds), so a fight plays out as strike, then hit, then fall. */
  later(delay: number, run: () => void): void {
    if (delay <= 0) run();
    else this.queue.push({ at: this.clock + delay, run });
  }

  burst(at: THREE.Vector3, o: BurstOptions = {}): void {
    const colors = (o.colors ?? ['#ffffff']).map((c) => new THREE.Color(c));
    const count = o.count ?? 16;
    const list = this.pools[o.soft ? 1 : 0].list;
    for (let i = 0; i < count; i++) {
      if (list.length >= MAX_SPARKS) list.shift();
      const dir = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      dir.y = dir.y * (1 - (o.up ?? 0.5)) + (o.up ?? 0.5);
      const speed = (o.speed ?? 1.6) * (0.5 + Math.random() * 0.7);
      const size = (o.size ?? 0.05) * (0.7 + Math.random() * 0.6);
      list.push({
        pos: at.clone(),
        vel: dir.multiplyScalar(speed),
        color: colors[i % colors.length],
        age: 0,
        life: (o.life ?? 0.9) * (0.7 + Math.random() * 0.6),
        size0: size,
        size1: size * (o.grow ?? 0.2),
        gravity: o.gravity ?? 3,
        drag: o.drag ?? 1.5,
        spin: Math.random() * 6,
      });
    }
  }

  /** A ring that spreads over the ground and fades. */
  ring(at: THREE.Vector3, color: THREE.ColorRepresentation, size = 1.6, life = 0.9): void {
    const mesh = this.ringFree.pop() ?? this.rings.shift()?.mesh;
    if (!mesh) return;
    (mesh.material as THREE.MeshBasicMaterial).color.set(color);
    mesh.position.copy(at);
    mesh.visible = true;
    this.rings.push({ mesh, age: 0, life, size });
  }

  /** A glowing shot arcing from one point to another; `land` runs when it arrives. */
  shoot(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation, life = 0.38): void {
    const mesh = this.shotFree.pop();
    if (!mesh) return;
    const c = new THREE.Color(color);
    (mesh.material as THREE.MeshBasicMaterial).color.copy(c).multiplyScalar(2.2);
    mesh.visible = true;
    mesh.position.copy(from);
    this.shots.push({ mesh, from: from.clone(), to: to.clone(), age: 0, life, color: c });
  }

  /** Words or a number that float up from a point on the map and fade. */
  text(at: THREE.Vector3, words: string, kind: 'damage' | 'good' | 'gold' | 'info', life = 1.5): void {
    const el = document.createElement('div');
    el.className = `fx-text ${kind}`;
    el.textContent = words;
    this.layer.appendChild(el);
    // Several words at one place stack upward instead of piling on each other.
    const crowd = this.texts.filter((t) => t.age < t.life * 0.7 && Math.abs(t.at.x - at.x) < 0.5 && Math.abs(t.at.z - at.z) < 0.5).length;
    const spot = at.clone();
    spot.y += crowd * 0.42;
    this.texts.push({ el, at: spot, age: 0, life });
  }

  update(dt: number): void {
    this.clock += dt;
    if (this.queue.length) {
      const due = this.queue.filter((j) => j.at <= this.clock);
      this.queue = this.queue.filter((j) => j.at > this.clock);
      for (const j of due) j.run();
    }

    // Sparks and puffs: drift, fall (or rise), shrink (or swell).
    for (const pool of this.pools) {
      let n = 0;
      const keep: Spark[] = [];
      for (const p of pool.list) {
        p.age += dt;
        if (p.age >= p.life) continue;
        keep.push(p);
        p.vel.y -= p.gravity * dt;
        p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
        p.pos.addScaledVector(p.vel, dt);
        const k = p.age / p.life;
        // Puffs fade by shrinking at the very end so they don't pop out.
        const size = (p.size0 + (p.size1 - p.size0) * k) * (k > 0.85 ? (1 - k) / 0.15 : 1);
        this.e.set(p.spin * p.age, p.spin * 0.7 * p.age, 0);
        this.q.setFromEuler(this.e);
        this.sc.setScalar(size);
        this.m.compose(p.pos, this.q, this.sc);
        pool.mesh.setMatrixAt(n, this.m);
        pool.mesh.setColorAt(n, p.color);
        n++;
      }
      pool.list = keep;
      pool.mesh.count = n;
      pool.mesh.instanceMatrix.needsUpdate = true;
      if (pool.mesh.instanceColor) pool.mesh.instanceColor.needsUpdate = true;
    }

    // Rings spread and fade.
    this.rings = this.rings.filter((r) => {
      r.age += dt;
      const k = r.age / r.life;
      if (k >= 1) {
        r.mesh.visible = false;
        this.ringFree.push(r.mesh);
        return false;
      }
      const ease = 1 - (1 - k) * (1 - k);
      r.mesh.scale.setScalar(0.3 + ease * r.size);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      return true;
    });

    // Shots fly on an arc, leaving a trail.
    this.shots = this.shots.filter((s) => {
      s.age += dt;
      const k = Math.min(1, s.age / s.life);
      s.mesh.position.lerpVectors(s.from, s.to, k);
      s.mesh.position.y += Math.sin(k * Math.PI) * (0.4 + s.from.distanceTo(s.to) * 0.12);
      if (Math.random() < 0.8) this.burst(s.mesh.position, { count: 1, speed: 0.15, life: 0.3, size: 0.03, gravity: 0, colors: [s.color] });
      if (k >= 1) {
        s.mesh.visible = false;
        this.shotFree.push(s.mesh);
        return false;
      }
      return true;
    });

    for (const t of this.texts) t.age += dt;
    for (const t of this.texts.filter((x) => x.age >= x.life)) t.el.remove();
    this.texts = this.texts.filter((x) => x.age < x.life);
  }

  /** Put the floating words on screen, rising as they age. */
  placeTexts(camera: THREE.Camera, w: number, h: number): void {
    for (const t of this.texts) {
      const k = t.age / t.life;
      this.v.copy(t.at);
      this.v.y += k * 0.7;
      this.v.project(camera);
      if (this.v.z > 1) {
        t.el.style.display = 'none';
        continue;
      }
      t.el.style.display = '';
      t.el.style.opacity = String(k < 0.15 ? k / 0.15 : k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.5 : 1.1 - Math.min(0.1, (k - 0.12) * 0.4);
      t.el.style.transform = `translate(-50%, -100%) translate(${((this.v.x + 1) / 2) * w}px, ${((1 - this.v.y) / 2) * h}px) scale(${pop.toFixed(3)})`;
    }
  }

  clear(): void {
    for (const pool of this.pools) pool.list = [];
    this.queue = [];
    for (const r of this.rings) {
      r.mesh.visible = false;
      this.ringFree.push(r.mesh);
    }
    this.rings = [];
    for (const s of this.shots) {
      s.mesh.visible = false;
      this.shotFree.push(s.mesh);
    }
    this.shots = [];
    for (const t of this.texts) t.el.remove();
    this.texts = [];
  }
}

// ---- Birds ----------------------------------------------------------------------------------------

const FLOCKS = 3;
const PER_FLOCK = 5;

/** A few flocks of birds wheeling over the part of the land the camera is looking at. */
export class Birds {
  readonly mesh: THREE.InstancedMesh;
  private centers: THREE.Vector3[] = [];
  private offsets: THREE.Vector3[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private one = new THREE.Vector3(1, 1, 1);
  private p = new THREE.Vector3();

  constructor() {
    // One wing: a thin triangle reaching out along +x from the body.
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.05, 0.22, 0.02, 0.02, 0, 0, 0.07], 3));
    wing.computeVertexNormals();
    this.mesh = new THREE.InstancedMesh(wing, new THREE.MeshBasicMaterial({ color: '#3b3a40', side: THREE.DoubleSide }), FLOCKS * PER_FLOCK * 2);
    this.mesh.frustumCulled = false;
    for (let f = 0; f < FLOCKS; f++) {
      this.centers.push(new THREE.Vector3());
      for (let b = 0; b < PER_FLOCK; b++) this.offsets.push(new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 1.2));
    }
  }

  /** Keep the flocks near what the camera looks at, each circling its own patch of sky. */
  update(time: number, dt: number, target: THREE.Vector3, distance: number): void {
    const spread = Math.min(14, 4 + distance * 0.25);
    let n = 0;
    for (let f = 0; f < FLOCKS; f++) {
      const home = this.p.set(target.x + Math.cos(f * 2.1) * spread * 0.6, 0, target.z + Math.sin(f * 2.1) * spread * 0.6);
      const c = this.centers[f];
      if (c.lengthSq() === 0) c.copy(home);
      c.lerp(home, Math.min(1, dt * 0.15));
      const radius = 2.2 + f * 0.8;
      const speed = 0.32 + f * 0.05;
      const dirSign = f % 2 ? 1 : -1;
      for (let b = 0; b < PER_FLOCK; b++) {
        const off = this.offsets[f * PER_FLOCK + b];
        const a = time * speed * dirSign + f * 1.7 + b * 0.18;
        const x = c.x + Math.cos(a) * radius + off.x;
        const z = c.z + Math.sin(a) * radius + off.z;
        const y = 5.5 + f * 0.6 + off.y + Math.sin(time * 0.7 + b) * 0.15;
        // Facing along the circle, banking into the turn.
        const heading = -a - (dirSign > 0 ? 0 : Math.PI);
        const flap = Math.sin(time * 9 + b * 1.3 + f) * 0.55;
        for (const side of [1, -1]) {
          this.e.set(0, heading, side * flap + dirSign * 0.25, 'YXZ');
          this.q.setFromEuler(this.e);
          this.m.compose(this.p.set(x, y, z), this.q, this.one.set(side, 1, 1));
          this.mesh.setMatrixAt(n++, this.m);
        }
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
