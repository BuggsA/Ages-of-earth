import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Low-poly models built from primitives (boxes, cones, lathes) and baked into one geometry each,
 * colors stored in the vertices. Parts can be marked as team-colored (tinted per player when drawn)
 * or as a limb that swings (legs walk, an arm strikes), so one instanced draw animates a whole army.
 */

/** Limb groups a vertex can belong to: they turn about the x axis around a pivot. */
export const RIG_NONE = 0;
export const RIG_LEG_A = 1;
export const RIG_LEG_B = 2;
export const RIG_ARM = 3;

export class Kit {
  readonly root = new THREE.Group();

  private put(geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, parent?: THREE.Object3D): THREE.Mesh {
    const m = new THREE.Mesh(geo);
    m.userData.color = color;
    m.position.set(x, y, z);
    (parent ?? this.root).add(m);
    return m;
  }

  /** Box resting on y (its bottom at y). */
  box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
    return this.put(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, parent);
  }
  cyl(rTop: number, rBottom: number, h: number, seg: number, color: string, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
    return this.put(new THREE.CylinderGeometry(rTop, rBottom, h, seg), color, x, y + h / 2, z, parent);
  }
  cone(r: number, h: number, seg: number, color: string, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
    return this.put(new THREE.ConeGeometry(r, h, seg), color, x, y + h / 2, z, parent);
  }
  sphere(r: number, color: string, x = 0, y = 0, z = 0, parent?: THREE.Object3D, seg = 7) {
    return this.put(new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2)), color, x, y, z, parent);
  }
  blob(r: number, color: string, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
    return this.put(new THREE.IcosahedronGeometry(r, 1), color, x, y, z, parent);
  }
  rock(r: number, color: string, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
    return this.put(new THREE.DodecahedronGeometry(r, 0), color, x, y, z, parent);
  }
  octa(r: number, color: string, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
    return this.put(new THREE.OctahedronGeometry(r, 0), color, x, y, z, parent);
  }
  /** Gable roof: a triangular prism w long (ridge along x), d deep, h tall, its base at y. */
  prism(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
    const tri = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, h)]);
    const geo = new THREE.ExtrudeGeometry(tri, { depth: w, bevelEnabled: false });
    geo.translate(0, 0, -w / 2);
    geo.rotateY(Math.PI / 2);
    return this.put(geo, color, x, y, z, parent);
  }
  /** Four-sided roof or pyramid over a w×d rectangle, its base at y. */
  pyramid(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
    const geo = new THREE.ConeGeometry(Math.SQRT1_2, h, 4);
    geo.rotateY(Math.PI / 4);
    geo.scale(w, 1, d);
    return this.put(geo, color, x, y + h / 2, z, parent);
  }
  /** Half sphere sitting on y. */
  dome(r: number, color: string, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
    return this.put(new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), color, x, y, z, parent);
  }
  /** A turned shape: [radius, height] points spun around the y axis, from its base at y. */
  lathe(profile: [number, number][], seg: number, color: string, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
    return this.put(new THREE.LatheGeometry(profile.map(([px, py]) => new THREE.Vector2(px, py)), seg), color, x, y, z, parent);
  }
  ring(r: number, tube: number, color: string, y = 0, parent?: THREE.Object3D) {
    const m = this.put(new THREE.TorusGeometry(r, tube, 4, 14), color, 0, y, 0, parent);
    m.rotation.x = Math.PI / 2;
    return m;
  }
  group(x = 0, y = 0, z = 0, parent?: THREE.Object3D): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    (parent ?? this.root).add(g);
    return g;
  }
  /** Mark a part (or a whole group) as wearing the player's color. */
  team<T extends THREE.Object3D>(o: T): T {
    o.userData.team = true;
    return o;
  }
  /** Mark a part (or a group) as a limb that swings about the x axis through (pivotY, pivotZ) in model space. */
  limb<T extends THREE.Object3D>(o: T, rig: number, pivotY: number, pivotZ = 0): T {
    o.userData.rig = [rig, pivotY, pivotZ];
    return o;
  }
  /** Mark a part as cloth in the wind: it runs `len` along z from the anchor `z` (len negative toward -z). */
  cloth<T extends THREE.Object3D>(o: T, len: number, z: number): T {
    o.userData.cloth = [len, z];
    return o;
  }
  /** Mark a square sail that billows with the wind: half its width, the y of its foot and its height. */
  sail<T extends THREE.Object3D>(o: T, halfW: number, foot: number, height: number): T {
    o.userData.sail = [halfW, foot, height];
    return o;
  }
  /** Mark a part as glowing (it will be bright enough to catch the bloom). */
  glow<T extends THREE.Object3D>(o: T): T {
    o.userData.glow = true;
    return o;
  }
}

function inherited(o: THREE.Object3D, key: string): unknown {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.userData[key] !== undefined) return p.userData[key];
  return undefined;
}

/** Merge every mesh under a root into one geometry with colors, team flags and limb data. */
export function bake(root: THREE.Object3D, teamColor?: string): THREE.BufferGeometry {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const parts: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const n = g.getAttribute('position').count;
    const team = inherited(mesh, 'team') === true;
    const glow = inherited(mesh, 'glow') === true;
    const cloth = inherited(mesh, 'cloth') as [number, number] | undefined;
    const sail = inherited(mesh, 'sail') as [number, number, number] | undefined;
    // A sail packs its height into the type (5 + height); its width and foot ride in the other two.
    // An off-centre sail (a dock's mast) also packs its centre x, in twentieths, into hundreds of the foot.
    g.computeBoundingBox();
    const cx = sail ? Math.round(((g.boundingBox!.min.x + g.boundingBox!.max.x) / 2) * 20) + 200 : 0;
    const rig = sail ? [5 + sail[2], sail[0], sail[1] + 100 * cx] : cloth ? [4, cloth[0], cloth[1]] : ((inherited(mesh, 'rig') as [number, number, number] | undefined) ?? [0, 0, 0]);
    const c = new THREE.Color(team && teamColor ? teamColor : (mesh.userData.color ?? '#ffffff'));
    const colors = new Float32Array(n * 3);
    const teams = new Float32Array(n);
    const rigs = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors.set([c.r, c.g, c.b], i * 3);
      // 0 plain, 1 wears the player's color (tinted when drawn), 2 glows.
      teams[i] = glow ? 2 : team && !teamColor ? 1 : 0;
      rigs.set(rig, i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('aTeam', new THREE.BufferAttribute(teams, 1));
    g.setAttribute('aRig', new THREE.BufferAttribute(rigs, 3));
    parts.push(g);
  });
  if (!parts.length) return new THREE.BufferGeometry();
  const merged = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  merged.computeBoundingSphere();
  return merged;
}

/** Cheap deterministic noise in 0..1 for model variety. */
export const rnd = (x: number, y: number, k: number) => {
  const v = Math.sin((x + 1) * 127.1 + (y + 1) * 311.7 + k * 74.7) * 43758.5453;
  return v - Math.floor(v);
};
