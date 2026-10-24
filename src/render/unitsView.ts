import * as THREE from 'three';
import { rankOf } from '../sim/combat';
import { legionary } from '../sim/legion';
import { BOAR, MAMMOTH, RAIDER, SIGNATURES, TICK_HZ, WOLF, domainOf, unitStats } from '../sim/data';
import type { Animal, CivId, GameState, Unit, UnitType } from '../sim/types';
import { unitMaterial } from './materials';
import { heightAt } from './terrain';
import { boarGeometry, deerGeometry, mammothGeometry, raiderGeometry, sheepGeometry, LEGION_MODEL, THRALL_MODEL, unitGeometry, wolfGeometry } from './unitModels';
import { WATER_Y } from './water';

/** Units are drawn a little larger than their footprint in the rules, so they read well from above. */
export const UNIT_SCALE = 1.3;
/** How high aircraft fly above the ground. */
export const AIR_ALT = 3.2;

const WHITE = new THREE.Color('#ffffff');

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
  /** Aircraft: how far into a holding circle (0 flying straight, 1 circling). */
  circle: number;
  /** Aircraft: how much it is banking. */
  bank: number;
  /** Seconds until the next puff of dust from a hard-moving foot or hoof. */
  dust?: number;
}

interface Corpse {
  type: UnitType;
  mounted: boolean;
  epoch: number;
  civ?: CivId;
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

/** Gold chevrons stacked one per rank, flat and unlit, facing +Z (turned toward the camera when drawn). */
function chevronGeometry(rank: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const gold = new THREE.Color('#ffd24d');
  const w = 0.2;
  const h = 0.1;
  const t = 0.06;
  for (let r = 0; r < rank; r++) {
    const y = r * 0.14;
    const quad = (a: number[], b: number[], c: number[], d: number[]) => {
      for (const v of [a, b, c, a, c, d]) {
        pos.push(v[0], v[1] + y, 0);
        col.push(gold.r, gold.g, gold.b);
      }
    };
    quad([-w, 0], [0, -h], [0, -h + t], [-w, t]);
    quad([0, -h], [w, 0], [w, t], [0, -h + t]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** The team ring under every unit on land: the owner's colour at a glance, whatever the model wears. */
const padMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, fog: false, toneMapped: false });
const padGeometry = (() => {
  const g = new THREE.RingGeometry(0.62, 1, 18);
  g.rotateX(-Math.PI / 2);
  return g;
})();

const chevronMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });

export interface ScreenUnit {
  id: number;
  sx: number;
  sy: number;
  r: number;
}

export class UnitsView {
  readonly group = new THREE.Group();
  private batches = new Map<string, Batch>();
  /** Rank chevrons over veterans, one instanced mesh per rank (index 0 is rank 1). */
  private chevrons: THREE.InstancedMesh[] = [1, 2, 3].map((r) => {
    const m = new THREE.InstancedMesh(chevronGeometry(r), chevronMaterial, 64);
    m.frustumCulled = false;
    m.count = 0;
    this.group.add(m);
    return m;
  });
  private chevronCount = [0, 0, 0];
  private pads = (() => {
    const m = new THREE.InstancedMesh(padGeometry, padMaterial, 256);
    m.frustumCulled = false;
    m.renderOrder = 2;
    m.count = 0;
    m.setColorAt(0, new THREE.Color());
    this.group.add(m);
    return m;
  })();
  private padCount = 0;
  private anims = new Map<number, Anim>();
  /** Where hooves and wheels kicked up dust this frame, as x, y, ground height, strength: the view turns them into puffs. */
  readonly kicks: number[] = [];
  private corpses: Corpse[] = [];
  private noRot = new THREE.Quaternion();
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
  /** Animals on screen this frame, for picking. */
  readonly animalScreen: ScreenUnit[] = [];
  private beasts: Partial<Record<Animal['kind'], Batch>> = {};
  private deerAnims = new Map<number, Anim>();

  setColors(colors: string[]): void {
    this.colors = colors.map((c) => new THREE.Color(c));
  }

  private batch(type: UnitType, epoch: number, civ?: CivId): Batch {
    const key = `${type}:${epoch}:${civ ?? ''}`;
    let b = this.batches.get(key);
    if (!b) {
      b = new Batch(unitGeometry(type, epoch, civ), 64, this.group);
      this.batches.set(key, b);
    }
    return b;
  }

  /** A unit died: it falls where it stood. */
  fall(type: UnitType, epoch: number, owner: number, x: number, y: number, fx: number, fy: number, id: number, civ?: CivId): void {
    const a = this.anims.get(id);
    this.anims.delete(id);
    this.corpses.push({ type, epoch, civ, mounted: !!unitStats(type, epoch).mounted, color: this.colors[owner] ?? new THREE.Color('#ffffff'), x, y, yaw: a ? a.yaw : Math.atan2(fx, fy), age: 0, side: id % 2 ? 1 : -1 });
    if (this.corpses.length > 160) this.corpses.shift();
  }

  clear(): void {
    this.anims.clear();
    this.deerAnims.clear();
    this.corpses = [];
  }

  /** Deer grazing, wandering and bolting; mammoths and wolves (#171) charging and biting. */
  private animals(s: GameState, alpha: number, dt: number, time: number, visible: (x: number, y: number) => boolean, camera: THREE.Camera, width: number, height: number): void {
    this.animalScreen.length = 0;
    const kinds: Animal['kind'][] = ['deer', 'mammoth', 'wolf', 'boar', 'sheep', 'raider'];
    for (const k of kinds) {
      const bb = (this.beasts[k] ??= new Batch(k === 'deer' ? deerGeometry() : k === 'mammoth' ? mammothGeometry() : k === 'boar' ? boarGeometry() : k === 'sheep' ? sheepGeometry() : k === 'raider' ? raiderGeometry() : wolfGeometry(), 32, this.group));
      bb.count = 0;
      bb.reserve(s.animals.length);
    }
    const seen = new Set<number>();
    for (const an of s.animals) {
      const b = this.beasts[an.kind]!;
      const x = an.px + (an.x - an.px) * alpha;
      const y = an.py + (an.y - an.py) * alpha;
      if (!visible(x, y)) continue;
      seen.add(an.id);
      let a = this.deerAnims.get(an.id);
      if (!a) {
        a = { yaw: Math.atan2(an.fx, an.fy), phase: an.id, lastX: x, lastY: y, speed: 0, circle: 0, bank: 0 };
        this.deerAnims.set(an.id, a);
      }
      const mdx = x - a.lastX;
      const mdy = y - a.lastY;
      a.speed += ((dt > 0 ? Math.sqrt(mdx * mdx + mdy * mdy) / dt : 0) - a.speed) * Math.min(1, dt * 10);
      a.lastX = x;
      a.lastY = y;
      let d = Math.atan2(an.fx, an.fy) - a.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      a.yaw += d * Math.min(1, dt * 8);
      const running = a.speed > 0.1;
      // Big feet take slow strides; a wolf's quick ones.
      a.phase += dt * a.speed * (an.kind === 'mammoth' ? 5 : an.kind === 'wolf' ? 12 : an.kind === 'boar' ? 11 : an.kind === 'sheep' ? 13 : an.kind === 'raider' ? 10 : 9);
      const leg = running ? Math.sin(a.phase) * Math.min(0.9, 0.35 + a.speed * 0.2) : 0;
      // A gentle sway while grazing; the hop of a run.
      const bob = running ? Math.abs(Math.sin(a.phase)) * 0.04 * Math.min(1, a.speed / 2) : Math.sin(time * 0.9 + an.id) * 0.004;
      const gy = heightAt(s, x, y);
      const i = b.count++;
      this.e.set(0, a.yaw, 0);
      this.q.setFromEuler(this.e);
      this.p.set(x, gy, y);
      // A lamb (#308) is two-thirds grown; a sheep wears its people's dye.
      const size = an.kind === 'sheep' && an.lamb !== undefined ? UNIT_SCALE * 0.65 : UNIT_SCALE;
      this.m.compose(this.p, this.q, this.sc.set(size, size, size));
      b.mesh.setMatrixAt(i, this.m);
      b.mesh.setColorAt(i, an.owner !== undefined ? (this.colors[an.owner] ?? WHITE) : WHITE);
      // A gore or a bite: the head lunges just after the blow lands, then eases back.
      const reload = an.kind === 'mammoth' ? MAMMOTH.reload : an.kind === 'boar' ? BOAR.reload : an.kind === 'raider' ? RAIDER.reload : WOLF.reload;
      const since = an.state === 'fight' && an.cool ? reload * TICK_HZ - an.cool : 99;
      let lunge = since < 8 ? Math.sin((since / 8) * Math.PI) * (an.kind === 'mammoth' ? -0.45 : an.kind === 'boar' ? -0.4 : 0.5) : 0;
      // A grazing sheep dips its head to the grass and lifts it to chew.
      if (an.kind === 'sheep' && !running) lunge = 0.6 * Math.max(0, Math.sin(time * 1.1 + an.id * 1.7));
      b.anim.setXYZ(i, leg, lunge, bob);
      this.v.set(x, gy + (an.kind === 'mammoth' ? 0.6 : 0.35), y).project(camera);
      if (this.v.z < 1) {
        this.animalScreen.push({ id: an.id, sx: ((this.v.x + 1) / 2) * width, sy: ((1 - this.v.y) / 2) * height, r: Math.max(10, 400 / Math.max(1, camera.position.distanceTo(this.p))) });
      }
    }
    for (const id of this.deerAnims.keys()) if (!seen.has(id)) this.deerAnims.delete(id);
    for (const k of kinds) {
      const b = this.beasts[k]!;
      b.mesh.count = b.count;
      b.mesh.instanceMatrix.needsUpdate = true;
      if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
      b.anim.needsUpdate = true;
    }
  }

  /** One team ring on the ground, growing the instance buffer when the army outgrows it. */
  private pad(x: number, y: number, z: number, r: number, color: THREE.Color): void {
    if (this.padCount >= this.pads.instanceMatrix.count) {
      const bigger = new THREE.InstancedMesh(padGeometry, padMaterial, this.pads.instanceMatrix.count * 2);
      bigger.frustumCulled = false;
      bigger.renderOrder = 2;
      bigger.setColorAt(0, new THREE.Color());
      this.group.remove(this.pads);
      this.pads.dispose();
      this.pads = bigger;
      this.group.add(bigger);
    }
    this.p.set(x, y + 0.04, z);
    this.m.compose(this.p, this.noRot, this.sc.set(r, 1, r));
    this.pads.setMatrixAt(this.padCount, this.m);
    this.pads.setColorAt(this.padCount, color);
    this.padCount++;
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
    sees: (x: number, y: number) => boolean,
  ): void {
    this.animals(s, alpha, dt, time, sees, camera, width, height);
    for (const b of this.batches.values()) b.count = 0;
    this.chevronCount = [0, 0, 0];
    this.padCount = 0;
    this.screen.length = 0;
    this.kicks.length = 0;
    this.drawn.clear();
    const ticks = s.tick - 1 + alpha;

    // Count per batch first so buffers are big enough.
    const need = new Map<string, number>();
    const show: Unit[] = [];
    for (const e of s.ents) {
      // Those sheltering inside a building aren't drawn.
      if (e.kind !== 'unit' || e.hp <= 0 || e.inside || !visible(e)) continue;
      show.push(e);
      const key = `${e.type}:${modelEpoch(s, e, s.players[e.owner].epoch)}:${markOf(s, e.type, e.owner) ?? ''}`;
      need.set(key, (need.get(key) ?? 0) + 1);
    }
    for (const c of this.corpses) {
      const key = `${c.type}:${c.epoch}:${c.civ ?? ''}`;
      need.set(key, (need.get(key) ?? 0) + 1);
    }
    for (const [key, n] of need) {
      const [type, epoch, civ] = key.split(':');
      this.batch(type as UnitType, Number(epoch), (civ || undefined) as CivId | undefined).reserve(n);
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
        a = { yaw: Math.atan2(u.fx, u.fy), phase: (u.id * 1.7) % 6.28, lastX: x, lastY: y, speed: 0, circle: 0, bank: 0 };
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
      const mounted = !!st.mounted;
      const engine = u.type === 'siege';
      // Riders and engines at a hard pace kick up a puff now and then (the view decides if the ground is dry enough).
      if ((mounted || engine) && a.speed > 1.1 && domainOf(u.type) === 'land' && this.kicks.length < 96) {
        a.dust = (a.dust ?? (u.id % 7) * 0.05) - dt;
        if (a.dust <= 0) {
          a.dust = 0.28 + (u.id % 5) * 0.04;
          this.kicks.push(x, y, heightAt(s, x, y), Math.min(1, a.speed / 3));
        }
      }
      a.phase += dt * (walking ? a.speed * (mounted ? 5.5 : 8.5) : 0);
      let leg = walking ? Math.sin(a.phase) * (mounted ? 0.5 : 0.6) : 0;
      let arm = 0;
      let bob = walking ? Math.abs(Math.sin(a.phase)) * (mounted ? 0.045 : engine ? 0.008 : 0.025) : 0;
      const since = (ticks - u.swing) / TICK_HZ;
      const ph = u.id * 0.77;
      switch (u.act) {
        case 'attack':
          if (engine) {
            if (st.shot === 'boulder') {
              // The arm flies up and over, then is winched back down.
              arm = since >= 0 && since < 0.25 ? 2.2 * (since / 0.25) : since >= 0.25 && since < 3 ? 2.2 * (1 - (since - 0.25) / 2.75) : 0;
            } else if (st.shot === 'ball') {
              arm = since >= 0 && since < 0.5 ? -0.18 * (1 - since / 0.5) : 0;
              bob = since >= 0 && since < 0.15 ? -0.02 : 0;
            } else {
              // The ram draws back and swings into the wall.
              arm = since >= 0 && since < 1.2 ? (since < 0.8 ? -0.45 * (since / 0.8) : -0.45 + 0.75 * ((since - 0.8) / 0.4)) : 0;
            }
          } else if (st.range > 0) {
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
        case 'chant':
          // Staff raised high, swaying with the chant.
          arm = -2.4 + Math.sin(time * 3 + ph) * 0.25;
          if (!walking) bob = Math.abs(Math.sin(time * 1.5 + ph)) * 0.01;
          break;
        default:
          arm = walking ? -leg * 0.5 : Math.sin(time * 1.3 + ph) * 0.04;
          if (!walking) bob = Math.sin(time * 1.6 + ph) * 0.004;
      }

      let gy = heightAt(s, x, y);
      let dx = x;
      let dz = y;
      let yaw = a.yaw;
      let roll = 0;
      let pitch = 0;
      let lift = mounted ? 0.62 : engine ? 0.35 : 0.42;
      const dom = domainOf(u.type);
      if (dom === 'water') {
        // Afloat: riding the swell, oars sweeping, paddle wheels churning, nets dipping.
        // Riding high enough that the hull's sides show above the water.
        gy = WATER_Y + 0.05 + Math.sin(time * 1.4 + ph) * 0.02;
        roll = Math.sin(time * 1.1 + ph) * 0.05;
        pitch = Math.sin(time * 0.9 + ph * 1.3) * 0.03;
        const paddles = u.type === 'transport' && epoch >= 4;
        const rowed = (u.type === 'warship' || u.type === 'transport') && epoch <= 1;
        leg = paddles ? a.phase % (Math.PI * 2) : rowed && walking ? Math.sin(a.phase * 0.6) * 0.45 : 0;
        arm = u.type === 'fisher' && u.act === 'fish' ? 0.25 + Math.sin(time * 1.8 + ph) * 0.25 : u.type === 'warship' && since >= 0 && since < 0.4 ? -0.1 * (1 - since / 0.4) : 0;
        bob = 0;
        lift = 0.3;
      } else if (dom === 'air') {
        // Aloft: straight on the move, a wide holding circle when waiting or over a target.
        const hold = a.speed < 0.8;
        a.circle = Math.max(0, Math.min(1, a.circle + (hold ? dt : -dt * 2)));
        const th = time * 0.9 + u.id;
        const R = 1.3 * a.circle;
        dx = x + Math.sin(th) * R;
        dz = y + Math.cos(th) * R;
        const orbitYaw = Math.atan2(Math.cos(th), -Math.sin(th));
        let dy = orbitYaw - a.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        yaw = a.yaw + dy * a.circle;
        a.bank += (Math.max(-0.6, Math.min(0.6, -d * 3)) - a.bank) * Math.min(1, dt * 4);
        roll = a.bank - 0.4 * a.circle;
        pitch = -0.03;
        gy = Math.max(gy, WATER_Y) + AIR_ALT + Math.sin(time * 1.2 + ph) * 0.06;
        leg = 0;
        arm = 0;
        bob = 0;
        lift = 0;
      }
      const b = this.batch(u.type, modelEpoch(s, u, epoch), markOf(s, u.type, u.owner));
      const i = b.count++;
      this.e.set(pitch, yaw, roll);
      this.q.setFromEuler(this.e);
      this.p.set(dx, gy, dz);
      const k = mounted ? UNIT_SCALE * 0.88 : engine ? UNIT_SCALE * 1.1 : UNIT_SCALE;
      this.m.compose(this.p, this.q, this.sc.set(k, k, k));
      b.mesh.setMatrixAt(i, this.m);
      b.mesh.setColorAt(i, this.colors[u.owner]);
      b.anim.setXYZ(i, leg, arm, bob);
      this.drawn.set(u.id, new THREE.Vector3(dx, gy, dz));
      if (dom === 'land') this.pad(dx, gy, dz, (mounted || engine ? 0.75 : 0.5) * k, this.colors[u.owner]);

      // Veterans wear their rank above the head.
      const rank = u.type === 'citizen' ? 0 : rankOf(u);
      if (rank > 0 && dom !== 'water') {
        const ci = this.chevronCount[rank - 1]++;
        let cm = this.chevrons[rank - 1];
        if (ci >= cm.instanceMatrix.count) {
          const bigger = new THREE.InstancedMesh(cm.geometry, chevronMaterial, cm.instanceMatrix.count * 2);
          bigger.frustumCulled = false;
          this.group.remove(cm);
          this.group.add(bigger);
          this.chevrons[rank - 1] = cm = bigger;
        }
        this.e.set(0, Math.atan2(camera.position.x - dx, camera.position.z - dz), 0);
        this.q.setFromEuler(this.e);
        this.p.set(dx, gy + (dom === 'air' ? 0.9 : mounted ? 1.75 : 1.5), dz);
        this.m.compose(this.p, this.q, this.sc.set(1, 1, 1));
        cm.setMatrixAt(ci, this.m);
      }

      // Where it lands on screen, for picking.
      this.v.set(dx, gy + lift, dz).project(camera);
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
      const b = this.batch(c.type, c.epoch, c.civ);
      const i = b.count++;
      const dom = domainOf(c.type);
      if (dom === 'water') {
        // A ship lists, then goes down.
        const t = Math.min(1, c.age / 4);
        this.e.set(t * 0.5, c.yaw, c.side * t * 0.7);
        this.q.setFromEuler(this.e);
        this.p.set(c.x, WATER_Y + 0.05 - t * t * 0.95, c.y);
      } else if (dom === 'air') {
        // An aircraft spins down and lies wrecked.
        const t = Math.min(1, c.age / 1.4);
        const ground = Math.max(heightAt(s, c.x, c.y), WATER_Y);
        this.e.set(t * 0.6, c.yaw + c.age * 2.5 * (1 - t), c.side * t * 0.5);
        this.q.setFromEuler(this.e);
        this.p.set(c.x + Math.sin(c.yaw) * t * 1.2, ground + AIR_ALT * (1 - t * t) + 0.08 - sink, c.y + Math.cos(c.yaw) * t * 1.2);
      } else {
        this.e.set(0, c.yaw, c.side * ease * (Math.PI / 2 - 0.15));
        this.q.setFromEuler(this.e);
        this.p.set(c.x, heightAt(s, c.x, c.y) + 0.04 - sink, c.y);
      }
      const k = c.mounted ? UNIT_SCALE * 0.88 : UNIT_SCALE;
      this.m.compose(this.p, this.q, this.sc.set(k, k, k));
      b.mesh.setMatrixAt(i, this.m);
      b.mesh.setColorAt(i, c.color);
      b.anim.setXYZ(i, 0, dom === 'land' ? -0.4 * ease : 0, 0);
    }
    this.corpses = keep;

    this.pads.count = this.padCount;
    this.pads.instanceMatrix.needsUpdate = true;
    if (this.pads.instanceColor) this.pads.instanceColor.needsUpdate = true;
    this.chevrons.forEach((cm, i) => {
      cm.count = this.chevronCount[i];
      cm.instanceMatrix.needsUpdate = true;
    });
    for (const b of this.batches.values()) {
      b.mesh.count = b.count;
      b.mesh.instanceMatrix.needsUpdate = true;
      if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
      b.anim.needsUpdate = true;
    }
  }
}

/** The people whose mark a unit wears: only a signature line carries one. */
function markOf(s: GameState, type: UnitType, owner: number): CivId | undefined {
  const civ = s.players[owner].civ;
  return SIGNATURES[civ].type === type ? civ : undefined;
}

/** Which model to draw: a trader heading home with gold (the epoch plus 10), a thrall or a legionary at work have their own. */
function modelEpoch(s: GameState, u: Unit, epoch: number): number {
  if (u.thrall && u.type === 'citizen') return epoch + THRALL_MODEL;
  // A legionary at the axe, the quarry or a foundation (#501) carries his tools on his back.
  if (legionary(s, u) && (u.order.k === 'gather' || u.order.k === 'build')) return epoch + LEGION_MODEL;
  // A loaded trader is drawn with its gold; a wagon carrying a Market (the Silk Road, #326) as the caravan cart.
  return u.type === 'trader' && u.carry > 0 ? epoch + 10 : u.type === 'wagon' && u.packed === 'market' ? epoch + 20 : epoch;
}
