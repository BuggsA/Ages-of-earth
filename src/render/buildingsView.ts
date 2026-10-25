import * as THREE from 'three';
import { ageOf } from '../sim/ages';
import { BUILDINGS, CIVS, POLDER, SNARE, TIDE, secs } from '../sim/data';
import { flooded } from '../sim/flood';
import { catchIn } from '../sim/snares';
import { bearing, orchardGrown, thornStage } from '../sim/grove';
import { hiveQuiet } from '../sim/hive';
import { SEAMS, seamOf } from '../sim/shafts';
import { armed, held } from '../sim/silo';
import type { AgeId, Building, BuildingType, GameState } from '../sim/types';
import { T_WATER } from '../sim/types';
import { WHEEL_HUB, tideWheel } from './tideModels';
import { SAIL_HUB, buildingGeometry, heirloomsFor, foundationGeometry, rubbleGeometry, scaffoldGeometry, windmillSails } from './buildingModels';
import { bakedMaterial, inject } from './materials';
import { heightAt } from './terrain';
import { WATER_Y } from './water';
import { damTurns } from '../sim/water';
import { isCauseway } from '../sim/tides';

/**
 * Buildings on the map, drawn as the viewer knows them: their own always, others' while in sight or,
 * once seen, as last remembered (a building razed out of sight still stands in memory until the
 * player looks again). Sites show a cleared pad, stakes and timber; rising buildings grow out of
 * scaffolding. Ruins smoulder a while where buildings fell.
 */

/** Buildings carry a pale rim on edges that turn from the eye, so walls and roofs keep an outline against grass and shade (#617). */
const buildingMaterial = inject(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 }), { team: true, flag: true, season: 'snow', rim: true });

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
  /** A flood people's field under the river in its flood season (#501 s1). */
  flood: THREE.Mesh | null;
  /** A household people's house wears a red lantern on a pole once it pays the tax (#501). */
  lantern: THREE.Group | null;
  /** A windmill's sails (#701), turning fast while it pumps and idly in the breeze otherwise. */
  sails: THREE.Mesh | null;
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
      if (v.flood) v.flood.visible = flooded(s, k.owner);
      if (v.lantern) v.lantern.visible = k.built;
      if (v.sails) {
        v.sails.visible = k.built;
        const b = s.byId.get(id);
        if (k.type === 'tidemill') {
          // A Tide Mill's wheel runs while the tide does: for a step after each turn it ground on.
          const running = !!b && b.kind === 'building' && b.milled !== undefined && s.tick - b.milled < secs(TIDE.period / (2 * TIDE.flats.length));
          v.sails.rotation.x -= dt * (running ? 1.2 : 0);
        } else {
          const working = !!b && b.kind === 'building' && b.pumped !== undefined && s.tick - b.pumped < secs(POLDER.every * 1.5);
          v.sails.rotation.z -= dt * (working ? 1.7 : 0.25);
        }
      }
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
    // A dyke (#701) stands up out of the water: its bank reaches down to the bed, its crown above the water line.
    const dyke = k.type === 'dyke' || k.type === 'sluice' || k.type === 'tidegate';
    // A Pontoon (#770) floats: it sits on the water line whatever the bed below it.
    const base = k.type === 'pontoon' ? WATER_Y : dyke || k.type === 'causeway' ? Math.max(0.02, this.baseHeight(s, k)) : this.baseHeight(s, k);
    group.position.set(k.x, base, k.y);
    const wall = k.type === 'wall' || k.type === 'thornwall' || dyke || k.type === 'channel' || k.type === 'causeway';
    const body = new THREE.Mesh(buildingGeometry(k.type, k.epoch, this.colors[k.owner] ?? '#ffffff', wall || k.type === 'snare' || k.type === 'shaft' || k.type === 'silo' || k.type === 'tower' || k.type === 'garden' || k.type === 'orchard' || k.type === 'towncenter' ? k.variant : 0, k.age, k.heirloom), buildingMaterial);
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
    // Fields and hedges (a Kitchen Garden, a Thornwall) lie on the ground as it falls.
    if (k.type !== 'farm' && k.type !== 'garden' && k.type !== 'thornwall' && !dyke && k.type !== 'causeway' && k.type !== 'pontoon') {
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
    // The Nile flood (#501 s1): a sheet of brown river water over the field, shown while it lies under the flood.
    let flood: THREE.Mesh | null = null;
    if (k.type === 'farm' && CIVS[s.players[k.owner]?.civ]?.flood) {
      flood = new THREE.Mesh(new THREE.PlaneGeometry(k.size - 0.15, k.size - 0.15), floodMaterial);
      flood.rotation.x = -Math.PI / 2;
      flood.position.y = 0.14;
      flood.visible = false;
      group.add(flood);
    }
    // The household tax (#501): a red lantern on a pole at the corner of each house that pays it.
    let lantern: THREE.Group | null = null;
    if (k.type === 'house' && CIVS[s.players[k.owner]?.civ]?.household) {
      lantern = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), lanternPole);
      pole.position.y = 0.6;
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 7, 5), lanternRed);
      lamp.scale.y = 1.25;
      lamp.position.y = 1.2;
      lantern.add(pole, lamp);
      lantern.position.set(k.size / 2 - 0.2, 0, k.size / 2 - 0.2);
      lantern.visible = false;
      group.add(lantern);
    }
    let sails: THREE.Mesh | null = null;
    if (k.type === 'windmill') {
      sails = new THREE.Mesh(windmillSails(), buildingMaterial);
      sails.position.set(0, SAIL_HUB.y, SAIL_HUB.z);
      sails.castShadow = true;
      sails.rotation.z = k.id * 0.7;
      group.add(sails);
    } else if (k.type === 'tidemill') {
      // The Tide Mill's wheel (#739) turns in the `sails` slot, about x.
      sails = new THREE.Mesh(tideWheel(), buildingMaterial);
      sails.position.set(WHEEL_HUB.x, WHEEL_HUB.y, WHEEL_HUB.z);
      sails.rotation.x = k.id * 0.7;
      group.add(sails);
    }
    this.group.add(group);
    return { group, body, site, scaffold, key, base, flood, lantern, sails };
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

const floodMaterial = new THREE.MeshStandardMaterial({ color: '#6f8f86', roughness: 0.35, metalness: 0.05, transparent: true, opacity: 0.82 });
const lanternPole = new THREE.MeshStandardMaterial({ color: '#5a3b24', flatShading: true });
const lanternRed = new THREE.MeshStandardMaterial({ color: '#c9382e', emissive: '#7a1a14', flatShading: true });
const plinthMaterial = inject(new THREE.MeshStandardMaterial({ color: '#8d7a62', flatShading: true, roughness: 1 }), {});

const HEIGHT: Record<BuildingType, number> = {
  towncenter: 2.9, house: 1.5, storehouse: 1.3, farm: 0.4, barracks: 2.0, range: 1.4, stable: 1.4, tower: 3.4,
  forge: 2.1, workshop: 1.7, temple: 2.6, market: 1.6, wonder: 4.6, wall: 1.3, gate: 1.8, dock: 1.5, airfield: 1.8, dyke: 0.45, sluice: 1.4, bridge: 0.8, dam: 1.2, windmill: 3.3, bloomery: 2.0, stockade: 1.8, gallery: 1.7, hirehall: 1.7, standard: 2.4, strand: 1.9, wheelyard: 1.6, pharos: 3.6, channel: 0.2, hive: 0.9, heart: 5.2, huntcamp: 1.4, warcamp: 1.7, caravanserai: 1.3, mission: 1.3, drainrig: 1.9, transfusion: 2.1, bloodtower: 2.9, snare: 0.9, prospector: 1.6, sapling: 0.7, silo: 1.4, shaft: 1.8, den: 1.8, thornwall: 1.3, garden: 0.6, orchard: 1.2, causeway: 0.2, tidemill: 2.0, pontoon: 1.6, battery: 1.9, spire: 4.4, greatden: 1.4, cockler: 1.4, tidegate: 1.3,
};

/** Which neighbouring tiles are land (#701 s5): the banks a bridge spans to, and a dam runs between. */
function landMask(s: GameState, b: Building): number {
  let m = 0;
  const land = (x: number, y: number, bit: number) => {
    if (x >= 0 && y >= 0 && x < s.w && y < s.h && s.terrain[y * s.w + x] !== T_WATER) m |= bit;
  };
  land(b.tx + 1, b.ty, 1);
  land(b.tx, b.ty + 1, 2);
  land(b.tx - 1, b.ty, 4);
  land(b.tx, b.ty - 1, 8);
  return m;
}

/** Which neighbouring tiles are causeway (#785): the line a Tide Gate is set in. */
function causewayMask(s: GameState, b: Building): number {
  let m = 0;
  const join = (x: number, y: number, bit: number) => {
    if (x >= 0 && y >= 0 && x < s.w && y < s.h && isCauseway(s, y * s.w + x)) m |= bit;
  };
  join(b.tx + 1, b.ty, 1);
  join(b.tx, b.ty + 1, 2);
  join(b.tx - 1, b.ty, 4);
  join(b.tx, b.ty - 1, 8);
  return m;
}

/** Which neighboring tiles hold the same owner's wall or gate (for a dyke, #701: its dykes). */
function wallMask(s: GameState, b: Building): number {
  let m = 0;
  const join = (x: number, y: number, bit: number) => {
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) return;
    const o = s.byId.get(s.bldAt[y * s.w + x]);
    // A channel (#701) runs on toward its neighbouring ditches and the water it is dug from.
    if (b.type === 'channel' && s.terrain[y * s.w + x] === T_WATER) m |= bit;
    if (o && o.kind === 'building' && o.owner === b.owner && (b.type === 'dyke' || b.type === 'sluice' ? o.type === 'dyke' || o.type === 'sluice' : b.type === 'causeway' ? o.type === 'causeway' : b.type === 'thornwall' ? o.type === 'thornwall' : b.type === 'channel' ? o.type === 'channel' : o.type === 'wall' || o.type === 'gate')) m |= bit;
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
    // A snare shows a hare in its noose once it holds a tender's worth (#485), to its owner and to a rival who sees it.
    // A Thornwall shows its stage (the Age of the Grove), a Kitchen Garden what feeds it, an Orchard whether it is grown and in fruit.
    // A Hive shows whether its bees are awake (the Age of the Hive). A Missile Silo held in Reserve shows it, arming (1) or ready (2) (#759 s3).
    variant: b.type === 'silo' ? (held(b) ? (armed(s, b) ? 2 : 1) : 0) : b.type === 'thornwall' ? wallMask(s, b) + 16 * thornStage(b) : b.type === 'garden' ? (b.fed ?? 0) : b.type === 'hive' ? (hiveQuiet(s, b) ? 1 : 0) : b.type === 'orchard' ? (bearing(s, b) ? 2 : orchardGrown(b) ? 1 : 0) : b.type === 'wall' || b.type === 'dyke' || b.type === 'channel' || b.type === 'causeway' ? wallMask(s, b) : b.type === 'sluice' ? wallMask(s, b) + (b.open ? 16 : 0) : b.type === 'tidegate' ? causewayMask(s, b) + (b.open ? 16 : 0) : b.type === 'bridge' ? landMask(s, b) : b.type === 'dam' ? landMask(s, b) + (damTurns(s, b) ? 16 : 0) : b.type === 'gate' || b.type === 'dock' ? b.dir : b.type === 'snare' ? (catchIn(b) >= SNARE.worth ? 1 : 0) : b.type === 'shaft' ? Math.max(0, SEAMS.indexOf(seamOf(s, b) ?? 'stone')) : b.type === 'tower' ? (b.level ?? 0) : b.type === 'towncenter' ? (b.behemoth ? 1 : 0) : 0,
  };
}

/** The heirlooms (#224) that dress this building, comma-joined, for those its owner has learned. */
function heirloomOn(s: GameState, b: Building): string {
  const techs = s.players[b.owner].techs as string[];
  const way = b.type === 'towncenter' && s.players[b.owner].way ? `way:${s.players[b.owner].way}` : '';
  const marks = heirloomsFor(b.type).filter((id) => techs.includes(id) || id === way);
  if (way && s.players[b.owner].deep) marks.push('deep');
  return marks.join(',');
}
