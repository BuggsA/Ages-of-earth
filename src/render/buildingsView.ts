import * as THREE from 'three';
import { ageOf } from '../sim/ages';
import { BUILDINGS } from '../sim/data';
import type { AgeId, Building, BuildingType, GameState } from '../sim/types';
import { buildingGeometry, heirloomsFor, foundationGeometry, rubbleGeometry, scaffoldGeometry } from './buildingModels';
import { bakedMaterial, inject } from './materials';
import { heightAt } from './terrain';

/**
 * Buildings on the map, drawn as the viewer knows them: their own always, others' while in sight or,
 * once seen, as last remembered (a building razed out of sight still stands in memory until the
 * player looks again). Sites show a cleared pad, stakes and timber; rising buildings grow out of
 * scaffolding. Ruins smoulder a while where buildings fell.
 */

/** What the viewer last saw of a building. */
export interface Known {
  id: number;
  owner: number;
  type: BuildingType;
  tx: number;
  ty: number;
  size: number;
  x: number;
  y: number;
  epoch: number;
  /** The age within the web (#37), for the look of the side ages (#55). */
  age: AgeId;
  /** The heirloom (#224) this building's owner holds that shows on this kind of building, or ''. */
  heirloom: string;
  built: boolean;
  progress: number;
  /** Walls: which neighbors a piece joins (1 east, 2 south, 4 west, 8 north). Gates: 1 if the wall runs along y. */
  variant: number;
}

interface View {
  group: THREE.Group;
  body: THREE.Mesh;
  site: THREE.Mesh | null;
  scaffold: THREE.Mesh | null;
  key: string;
  base: number;
}

interface Ruin {
  mesh: THREE.Mesh;
  age: number;
}

export class BuildingsView {
  readonly group = new THREE.Group();
  private views = new Map<number, View>();
  private ruins: Ruin[] = [];
  /** Every building the viewer knows of, kept up to date while it is in sight. */
  readonly known = new Map<number, Known>();
  private colors: string[] = [];

  setColors(colors: string[]): void {
    this.colors = colors;
  }

  /** Groups to raycast for picking, keyed back to the building id. */
  pickables(): THREE.Object3D[] {
    return [...this.views.values()].map((v) => v.group);
  }

  idOf(o: THREE.Object3D): number | null {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (typeof p.userData.building === 'number') return p.userData.building;
    return null;
  }

  /** The footprint's highest corner, so buildings sit level on the slope (the pad reaches down). */
  private baseHeight(s: GameState, k: Known): number {
    let hi = -Infinity;
    for (let y = k.ty; y <= k.ty + k.size; y++) for (let x = k.tx; x <= k.tx + k.size; x++) hi = Math.max(hi, s.height[y * (s.w + 1) + x]);
    let lo = Infinity;
    for (let y = k.ty; y <= k.ty + k.size; y++) for (let x = k.tx; x <= k.tx + k.size; x++) lo = Math.min(lo, s.height[y * (s.w + 1) + x]);
    return (hi + lo) / 2 + (hi - lo) * 0.25;
  }

  /** A building fell: leave rubble where it stood. */
  ruin(s: GameState, type: BuildingType, x: number, y: number, size: number, epoch: number): void {
    const mesh = new THREE.Mesh(rubbleGeometry(size, epoch), bakedMaterial);
    mesh.position.set(x, heightAt(s, x, y), y);
    mesh.rotation.y = (Math.round(x * 7 + y * 3) % 4) * (Math.PI / 2);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.ruins.push({ mesh, age: 0 });
    void type;
  }

  clear(): void {
    for (const v of this.views.values()) this.group.remove(v.group);
    this.views.clear();
    for (const r of this.ruins) this.group.remove(r.mesh);
    this.ruins = [];
    this.known.clear();
  }

  /**
   * Bring the drawn buildings in line with what the viewer knows. `sees` says whether the viewer can see
   * any of a footprint now.
   */
  update(s: GameState, viewer: number, sees: (b: { tx: number; ty: number; size: number }) => boolean, dt: number, reveal: boolean): void {
    // Refresh memory from what is in sight.
    for (const e of s.ents) {
      if (e.kind !== 'building' || e.hp <= 0) continue;
      if (e.owner === viewer || reveal || sees(e)) this.known.set(e.id, snapshot(s, e));
    }
    // Forget what is gone, once the viewer sees the empty ground (their own vanish at once).
    for (const [id, k] of this.known) {
      if (s.byId.has(id)) continue;
      if (k.owner === viewer || reveal || sees(k)) this.known.delete(id);
    }

    for (const [id, k] of this.known) {
      // The owner too, so a building won over (#209) is redrawn in its new colours.
      const key = `${k.type}:${k.epoch}:${k.age}:${k.built ? 1 : 0}:${k.variant}:${k.owner}:${k.heirloom}`;
      let v = this.views.get(id);
      if (v && v.key !== key) {
        this.group.remove(v.group);
        this.views.delete(id);
        v = undefined;
      }
      if (!v) {
        v = this.make(s, k, key);
        this.views.set(id, v);
      }
      // Rising out of its scaffolding.
      const p = k.built ? 1 : k.progress;
      v.body.visible = p > 0.02 || k.type === 'farm';
      v.body.scale.set(1, k.built ? 1 : 0.12 + 0.88 * p, 1);
      if (v.site) v.site.visible = !k.built;
      if (v.scaffold) v.scaffold.visible = !k.built && p > 0.02 && k.type !== 'farm';
    }
    for (const [id, v] of this.views) {
      if (this.known.has(id)) continue;
      this.group.remove(v.group);
      this.views.delete(id);
    }

    this.ruins = this.ruins.filter((r) => {
      r.age += dt;
      if (r.age > 40) {
        this.group.remove(r.mesh);
        return false;
      }
      if (r.age > 34) r.mesh.position.y -= dt * 0.05;
      return true;
    });
  }

  private make(s: GameState, k: Known, key: string): View {
    const group = new THREE.Group();
    group.userData.building = k.id;
    const base = this.baseHeight(s, k);
    group.position.set(k.x, base, k.y);
    const wall = k.type === 'wall';
    const body = new THREE.Mesh(buildingGeometry(k.type, k.epoch, this.colors[k.owner] ?? '#ffffff', wall ? k.variant : 0, k.age, k.heirloom), bakedMaterial);
    if (k.type === 'gate' && k.variant) body.rotation.y = Math.PI / 2;
    // A dock's pier reaches out over the water.
    if (k.type === 'dock') body.rotation.y = (k.variant * Math.PI) / 2;
    body.castShadow = k.type !== 'farm';
    body.receiveShadow = true;
    group.add(body);
    let site: THREE.Mesh | null = null;
    let scaffold: THREE.Mesh | null = null;
    if (!k.built) {
      site = new THREE.Mesh(foundationGeometry(k.size), bakedMaterial);
      site.receiveShadow = true;
      group.add(site);
      if (k.type !== 'farm' && !wall) {
        scaffold = new THREE.Mesh(scaffoldGeometry(k.size), bakedMaterial);
        scaffold.castShadow = true;
        group.add(scaffold);
      }
    }
    // A plinth so a level building doesn't float over the low side of a slope.
    if (k.type !== 'farm') {
      let lo = Infinity;
      for (let y = k.ty; y <= k.ty + k.size; y++) for (let x = k.tx; x <= k.tx + k.size; x++) lo = Math.min(lo, s.height[y * (s.w + 1) + x]);
      const drop = base - lo;
      if (drop > 0.05) {
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(k.size - 0.12, drop + 0.05, k.size - 0.12), plinthMaterial);
        plinth.position.y = -drop / 2;
        plinth.receiveShadow = true;
        group.add(plinth);
      }
    }
    this.group.add(group);
    return { group, body, site, scaffold, key, base };
  }

  /** Where a building's top is, for health bars and effects. */
  topOf(id: number): THREE.Vector3 | null {
    const v = this.views.get(id);
    if (!v) return null;
    const k = this.known.get(id)!;
    const h = HEIGHT[k.type];
    return new THREE.Vector3(k.x, v.base + h * v.body.scale.y, k.y);
  }

  baseOf(id: number): number | null {
    return this.views.get(id)?.base ?? null;
  }
}

const plinthMaterial = inject(new THREE.MeshStandardMaterial({ color: '#8d7a62', flatShading: true, roughness: 1 }), {});

const HEIGHT: Record<BuildingType, number> = {
  towncenter: 2.9, house: 1.5, storehouse: 1.3, farm: 0.4, barracks: 2.0, range: 1.4, stable: 1.4, tower: 3.4,
  forge: 2.1, workshop: 1.7, temple: 2.6, market: 1.6, wonder: 4.6, wall: 1.3, gate: 1.8, dock: 1.5, airfield: 1.8, huntcamp: 1.4, warcamp: 1.7, caravanserai: 1.3,
};

/** Which neighboring tiles hold the same owner's wall or gate. */
function wallMask(s: GameState, b: Building): number {
  let m = 0;
  const join = (x: number, y: number, bit: number) => {
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) return;
    const o = s.byId.get(s.bldAt[y * s.w + x]);
    if (o && o.kind === 'building' && o.owner === b.owner && (o.type === 'wall' || o.type === 'gate')) m |= bit;
  };
  join(b.tx + 1, b.ty, 1);
  join(b.tx, b.ty + 1, 2);
  join(b.tx - 1, b.ty, 4);
  join(b.tx, b.ty - 1, 8);
  return m;
}

function snapshot(s: GameState, b: Building): Known {
  return {
    id: b.id,
    owner: b.owner,
    type: b.type,
    tx: b.tx,
    ty: b.ty,
    size: BUILDINGS[b.type].size,
    x: b.x,
    y: b.y,
    epoch: s.players[b.owner].epoch,
    age: ageOf(s.players[b.owner]),
    heirloom: heirloomOn(s, b),
    built: b.built,
    progress: b.progress,
    variant: b.type === 'wall' ? wallMask(s, b) : b.type === 'gate' || b.type === 'dock' ? b.dir : 0,
  };
}

/** The heirlooms (#224) that dress this building, comma-joined, for those its owner has learned. */
function heirloomOn(s: GameState, b: Building): string {
  const techs = s.players[b.owner].techs as string[];
  return heirloomsFor(b.type).filter((id) => techs.includes(id)).join(',');
}
