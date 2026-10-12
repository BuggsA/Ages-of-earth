import * as THREE from 'three';
import type { SoundName } from '../audio/sound';
import { AURA, BUILDINGS, TICK_HZ } from '../sim/data';
import { buildingMaxHp, statsFor } from '../sim/stats';
import type { BuildingType, Ent, GameEvent, GameState, Unit } from '../sim/types';
import { R_GOLD, R_STONE } from '../sim/types';
import { seesRect } from '../sim/vision';
import { BuildingsView } from './buildingsView';
import { CameraRig } from './camera';
import { Birds, Effects } from './effects';
import { fogUniforms, timeUniform } from './materials';
import { Overlays, type BarSpec, type RingSpec } from './overlays';
import { Post, QUALITY, loadQuality, saveQuality, type QualityName } from './post';
import { ResourcesView } from './resourcesView';
import { Sky } from './sky';
import { FogTexture, TerrainView, heightAt } from './terrain';
import { UnitsView } from './unitsView';
import { WaterView } from './water';

/**
 * The 3D view of a match through one player's eyes: lit terrain and lakes under a sky, woods and
 * mines, buildings as the player knows them, units in sight, shots in flight, and the effects and sounds
 * of what happens. It also answers what is under the pointer and which units fall inside a box.
 */

export interface Selection {
  ids: Set<number>;
  /** Show every unit's health (while a key is held). */
  allBars: boolean;
  ghost: { type: BuildingType; tx: number; ty: number; ok: boolean } | null;
  /** The building whose rally point to show. */
  rallyOf: number | null;
  /** A line of wall being laid out. */
  wall: { tiles: { x: number; y: number; ok: boolean }[]; alongY: boolean } | null;
}

export type Pick =
  | { kind: 'unit'; id: number }
  | { kind: 'building'; id: number }
  | { kind: 'animal'; id: number }
  | { kind: 'resource'; tile: number }
  | { kind: 'ground'; x: number; y: number };

const SUN_DIR = new THREE.Vector3(-0.45, 0.82, 0.38).normalize();

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig();
  readonly labelLayer: HTMLDivElement;
  /** A sound to play: its name, left-right placement and loudness by distance. */
  onCue: ((name: SoundName, pan: number, gain: number) => void) | null = null;
  /** Something worth a ping on the minimap happened at a map point. */
  onPing: ((x: number, y: number, color: string) => void) | null = null;

  private sky = new Sky();
  private hemi = new THREE.HemisphereLight('#dcefff', '#b9a77a', 1.0);
  private sun = new THREE.DirectionalLight('#fff3dc', 2.5);
  private fill = new THREE.AmbientLight('#cfe0ff', 0.4);
  private horizon = new THREE.Color('#cfe8f3');
  private skyTop = new THREE.Color('#5aa7e0');
  private terrain = new TerrainView();
  private water = new WaterView();
  private resources = new ResourcesView();
  private buildings = new BuildingsView();
  private units = new UnitsView();
  private overlays = new Overlays();
  private effects: Effects;
  private birds = new Birds();
  private post: Post;
  private quality: QualityName = loadQuality();
  private fog: FogTexture | null = null;
  private state: GameState | null = null;
  private viewer = 0;
  private reveal = false;
  private time = 0;
  private width = 1;
  private height = 1;
  private raycaster = new THREE.Raycaster();
  private chimneys = new Map<number, number>();
  private v = new THREE.Vector3();

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'label-layer';
    container.appendChild(this.labelLayer);
    this.effects = new Effects(this.labelLayer);

    this.scene.fog = new THREE.Fog(this.horizon, 60, 200);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sky.mesh, this.hemi, this.fill, this.sun, this.sun.target);
    this.scene.add(this.terrain.group, this.water.mesh, this.resources.group, this.buildings.group, this.units.group, this.overlays.group, this.effects.group, this.birds.mesh);
    this.sky.apply(this.skyTop, this.horizon, SUN_DIR);
    this.post = new Post(this.renderer, this.scene, this.rig.camera);
    this.applyQuality();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  get camera(): THREE.PerspectiveCamera {
    return this.rig.camera;
  }

  get qualityName(): QualityName {
    return this.quality;
  }

  setQuality(q: QualityName): void {
    this.quality = q;
    saveQuality(q);
    this.applyQuality();
  }

  private applyQuality(): void {
    const q = QUALITY[this.quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadows > 0;
    this.sun.castShadow = q.shadows > 0;
    if (q.shadows > 0) {
      this.sun.shadow.mapSize.set(q.shadows, q.shadows);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    // Materials compile differently with and without shadows.
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m) return;
      for (const mm of Array.isArray(m) ? m : [m]) mm.needsUpdate = true;
    });
    this.resize();
  }

  resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h);
    this.post.setSize(w, h, this.renderer.getPixelRatio());
    this.rig.camera.aspect = w / h;
    this.rig.camera.updateProjectionMatrix();
  }

  /** Start drawing a new match. */
  setGame(s: GameState, viewer: number): void {
    this.state = s;
    this.viewer = viewer;
    this.reveal = false;
    this.effects.clear();
    this.units.clear();
    this.buildings.clear();
    this.resources.clear();
    const colors = s.players.map((p) => p.color);
    this.units.setColors(colors);
    this.buildings.setColors(colors);
    this.terrain.build(s);
    this.water.setup(s);
    this.fog = new FogTexture(s.w, s.h);
    fogUniforms.uFogTex.value = this.fog.texture;
    fogUniforms.uFogSize.value.set(s.w, s.h);
    fogUniforms.uFogOn.value = 1;
    const p = s.players[viewer];
    this.fog.snap(p.vis, p.seen);
    this.rig.setBounds(s.w, s.h);
    this.rig.groundAt = (x, z) => heightAt(s, x, z);
    this.rig.focus(p.startX, p.startY + 3, true);
    this.chimneys.clear();
  }

  /** Lift the fog (when the match is over). */
  revealAll(): void {
    this.reveal = true;
    this.fog?.reveal();
  }

  /** Whether the viewer sees a point now. */
  sees(x: number, y: number): boolean {
    if (this.reveal || !this.fog) return true;
    return this.fog.visibleAt(x, y) > 0.45;
  }

  private visibleUnit = (u: Unit): boolean => u.owner === this.viewer || this.sees(u.x, u.y);

  /** Draw a frame. `alpha` is how far into the next tick we are (0..1). */
  frame(s: GameState, alpha: number, dt: number, sel: Selection): void {
    this.time += dt;
    timeUniform.value = this.time;
    this.rig.update(dt);
    const p = s.players[this.viewer];
    if (!this.reveal) this.fog?.update(p.vis, p.seen, dt);

    // Light follows the view so shadows stay crisp where the player looks.
    const t = this.rig.target;
    const span = 14 + this.rig.distance * 0.75;
    this.sun.position.copy(t).addScaledVector(SUN_DIR, 60);
    this.sun.target.position.copy(t);
    const cam = this.sun.shadow.camera;
    cam.left = -span;
    cam.right = span;
    cam.top = span;
    cam.bottom = -span;
    cam.near = 1;
    cam.far = 140;
    cam.updateProjectionMatrix();
    this.sky.mesh.position.copy(this.rig.camera.position);
    const fog = this.scene.fog as THREE.Fog;
    fog.near = this.rig.distance * 2.2;
    fog.far = this.rig.distance * 5 + 60;

    this.resources.update(s, dt);
    this.buildings.update(s, this.viewer, (b) => this.reveal || seesRect(s, this.viewer, b.tx, b.ty, b.size), dt, this.reveal);
    this.units.update(s, alpha, dt, this.time, this.visibleUnit, this.rig.camera, this.width, this.height, (x, y) => this.sees(x, y));
    this.overlays.setShots(s, alpha, (x, y) => this.sees(x, y));
    this.drawSelection(s, sel);
    this.ambient(s, dt);
    this.water.update(this.time, SUN_DIR, this.horizon);
    this.effects.update(dt);
    this.birds.update(this.time, dt, this.rig.target, this.rig.distance);
    this.effects.placeTexts(this.rig.camera, this.width, this.height);

    if (QUALITY[this.quality].post) this.post.render();
    else this.renderer.render(this.scene, this.rig.camera);
  }

  private drawSelection(s: GameState, sel: Selection): void {
    const rings: RingSpec[] = [];
    const bars: BarSpec[] = [];
    const own = new THREE.Color('#9dff9a').multiplyScalar(1.25);
    const foe = new THREE.Color('#ff6a5a').multiplyScalar(1.25);
    const aura = new THREE.Color('#ffd166');
    const way = new THREE.Color('#d8ffd6');
    for (const id of sel.ids) {
      const e = s.byId.get(id);
      if (!e || e.hp <= 0) continue;
      if (e.kind === 'unit') {
        const at = this.units.drawn.get(id);
        if (!at) continue;
        const st = statsFor(s, e.owner, e.type);
        rings.push({ x: at.x, y: at.y, z: at.z, r: st.radius + 0.12, color: e.owner === this.viewer ? own : foe });
        // A hero's reach, and where queued orders lead.
        if (e.type === 'hero') rings.push({ x: at.x, y: at.y, z: at.z, r: AURA.radius, color: aura, thin: true });
        if (e.owner === this.viewer) {
          for (const o of e.queue) {
            if (o.k !== 'move') continue;
            rings.push({ x: o.x, y: heightAt(s, o.x, o.y), z: o.y, r: 0.22, color: o.amove ? foe : way });
          }
        }
      } else {
        const known = this.buildings.known.get(id);
        if (!known) continue;
        const base = this.buildings.baseOf(id) ?? heightAt(s, e.x, e.y);
        rings.push({ x: e.x, y: base, z: e.y, r: (BUILDINGS[e.type].size / 2) * 1.414 + 0.05, color: e.owner === this.viewer ? own : foe, square: true });
      }
    }
    // Health: the selected, the recently hurt, or everyone while asked.
    const recent = s.tick - TICK_HZ * 4;
    for (const e of s.ents) {
      if (e.hp <= 0) continue;
      const show = sel.ids.has(e.id) || sel.allBars || e.hurt > recent;
      if (!show) continue;
      if (e.kind === 'unit') {
        const at = this.units.drawn.get(e.id);
        if (!at) continue;
        const st = statsFor(s, e.owner, e.type);
        bars.push({ at: this.v.set(at.x, at.y + (st.mounted ? 1.4 : e.type === 'siege' ? 1.0 : 1.02), at.z).clone(), width: e.type === 'hero' ? 0.7 : 0.55, frac: e.hp / st.hp });
      } else {
        const top = this.buildings.topOf(e.id);
        if (!top) continue;
        if (!(e.owner === this.viewer || this.reveal || seesRect(s, this.viewer, e.tx, e.ty, e.size))) continue;
        top.y += 0.35;
        bars.push({ at: top, width: Math.min(2.2, Math.max(0.6, e.size * 0.55)), frac: e.hp / buildingMaxHp(s, e.owner, e.type) });
      }
    }
    this.overlays.setRings(rings);
    this.overlays.setBars(bars, this.rig.camera);
    const p = s.players[this.viewer];
    this.overlays.setGhost(s, sel.ghost ? { ...sel.ghost, epoch: p.epoch, color: p.color } : null);
    this.overlays.setWallGhost(s, sel.wall?.tiles ?? [], p.epoch, p.color, sel.wall?.alongY ?? false);
    const rb = sel.rallyOf ? s.byId.get(sel.rallyOf) : undefined;
    this.overlays.setFlag(s, rb && rb.kind === 'building' && rb.rally ? rb.rally : null, p.color, this.time);
  }

  /** Chimney smoke, fires on damaged buildings, the glint of gold. */
  private ambient(s: GameState, dt: number): void {
    for (const e of s.ents) {
      if (e.kind !== 'building' || e.hp <= 0 || !e.built) continue;
      if (!(e.owner === this.viewer || this.reveal || seesRect(s, this.viewer, e.tx, e.ty, e.size))) continue;
      const next = (this.chimneys.get(e.id) ?? this.time + (e.id % 7) * 0.3) - dt;
      const max = buildingMaxHp(s, e.owner, e.type);
      const frac = e.hp / max;
      const base = this.buildings.baseOf(e.id) ?? 0;
      if (next > this.time) {
        this.chimneys.set(e.id, next + dt);
        continue;
      }
      if (frac < 0.6) {
        // Burning: flames and black smoke, more as it falls.
        const at = new THREE.Vector3(e.x + (Math.random() - 0.5) * e.size * 0.6, base + 0.6 + Math.random() * 0.6, e.y + (Math.random() - 0.5) * e.size * 0.6);
        this.effects.burst(at, { count: 2, speed: 0.4, up: 1, life: 0.7, size: 0.07, gravity: -1.2, drag: 1, colors: ['#ff9a3c', '#ffd166', '#e0471f'] });
        this.effects.burst(at, { count: 1, speed: 0.3, up: 1, life: 2.2, size: 0.12, grow: 3, gravity: -0.4, drag: 0.4, soft: true, colors: ['#3a3634', '#55504c'] });
        this.chimneys.set(e.id, this.time + (frac < 0.3 ? 0.12 : 0.3));
      } else if (e.type === 'wonder' && e.timer >= 0) {
        // A finished wonder glitters.
        const at = new THREE.Vector3(e.x + (Math.random() - 0.5) * 4, base + 1 + Math.random() * 3, e.y + (Math.random() - 0.5) * 4);
        this.effects.burst(at, { count: 3, speed: 0.5, up: 1, life: 1.4, size: 0.05, gravity: -0.6, colors: ['#ffd166', '#fff3c4'] });
        this.chimneys.set(e.id, this.time + 0.25);
      } else if (e.type === 'forge' && s.players[e.owner].epoch >= 1) {
        const at = new THREE.Vector3(e.x + 0.95, base + 2.2, e.y - 0.75);
        this.effects.burst(at, { count: 1, speed: 0.15, up: 1, life: 2.6, size: 0.08, grow: 4, gravity: -0.2, drag: 0.3, soft: true, colors: ['#6a6460', '#8a8480'] });
        if (Math.random() < 0.4) this.effects.burst(at, { count: 2, speed: 0.6, up: 1, life: 0.6, size: 0.025, gravity: -0.5, colors: ['#ffb24a', '#ff7a2a'] });
        this.chimneys.set(e.id, this.time + 0.6 + Math.random() * 0.5);
      } else if ((e.type === 'house' || e.type === 'towncenter') && s.players[e.owner].epoch >= 1) {
        const at = new THREE.Vector3(e.x + (e.type === 'house' ? 0.45 : -0.6), base + (e.type === 'house' ? 1.6 : 2.4), e.y - 0.3);
        this.effects.burst(at, { count: 1, speed: 0.12, up: 1, life: 3, size: 0.06, grow: 4, gravity: -0.12, drag: 0.3, soft: true, colors: ['#c9c6c2', '#e2dfdb'] });
        this.chimneys.set(e.id, this.time + 0.9 + Math.random() * 0.8);
      } else this.chimneys.set(e.id, this.time + 2);
    }
  }

  /** Turn what happened this tick into sights and sounds (only what the viewer can see or hear). */
  events(s: GameState, list: GameEvent[]): void {
    for (const ev of list) {
      switch (ev.k) {
        case 'hit': {
          if (!this.sees(ev.x, ev.y)) break;
          const at = this.ground(s, ev.x, ev.y, ev.building ? 0.8 : 0.45);
          this.effects.burst(at, ev.building
            ? { count: 4, speed: 1.2, life: 0.6, size: 0.06, colors: ['#9a8a74', '#c9b79c'], soft: true }
            : { count: 5, speed: 1.4, life: 0.35, size: 0.03, colors: ['#ffe2a8', '#ffffff'] });
          this.cue(ev.building ? 'hitBuilding' : 'hit', ev.x, ev.y, 0.7);
          break;
        }
        case 'swing':
          if (!this.sees(ev.x, ev.y) || ev.ranged) break;
          this.cue(ev.type === 'citizen' || ev.type === 'siege' ? 'thud' : 'strike', ev.x, ev.y, ev.type === 'siege' ? 1 : 0.75);
          break;
        case 'shot': {
          if (!this.sees(ev.x, ev.y)) break;
          const k = ev.kind;
          this.cue(k === 'bullet' ? 'musket' : k === 'ball' ? 'cannon' : k === 'boulder' ? 'catapult' : k === 'spear' ? 'spear' : k === 'stone' ? 'sling' : 'bow', ev.x, ev.y, k === 'ball' ? 0.9 : 0.6);
          if (k === 'bullet' || k === 'ball') {
            const big = k === 'ball';
            this.effects.burst(this.ground(s, ev.x, ev.y, 0.5), { count: big ? 10 : 3, speed: big ? 0.9 : 0.4, up: 0.6, life: big ? 2.4 : 1.4, size: big ? 0.16 : 0.08, grow: 3, gravity: -0.2, drag: 1, soft: true, colors: ['#e6e2dc', '#cfcac2'] });
            if (big) this.effects.burst(this.ground(s, ev.x, ev.y, 0.4), { count: 6, speed: 1.5, life: 0.25, size: 0.07, gravity: 0, colors: ['#ffd27a', '#ff9a3c'] });
          }
          break;
        }
        case 'splash': {
          if (!this.sees(ev.x, ev.y)) break;
          const at = this.ground(s, ev.x, ev.y, 0.15);
          this.effects.burst(at, { count: 18, speed: 2, up: 0.8, life: 1.6, size: 0.18, grow: 2.5, gravity: -0.1, drag: 1.4, soft: true, colors: ['#9a8a74', '#b3a594', '#6a5e52'] });
          this.effects.burst(at, { count: 10, speed: 2.6, up: 0.9, life: 0.9, size: 0.05, gravity: 6, drag: 0.3, colors: ['#7d7a72', '#5a4a3a'] });
          this.effects.ring(at, '#d9c7a8', ev.kind === 'boulder' ? 2.2 : 1.6, 0.7);
          this.cue('impact', ev.x, ev.y, 0.9);
          break;
        }
        case 'animalDie':
          if (!this.sees(ev.x, ev.y)) break;
          this.effects.burst(this.ground(s, ev.x, ev.y, 0.1), { count: 5, speed: 0.6, up: 0.4, life: 0.8, size: 0.05, grow: 1.8, gravity: -0.1, drag: 1.5, soft: true, colors: ['#bba98a', '#d6c7aa'] });
          this.resources.markDirty();
          break;
        case 'researched':
          if (ev.owner === this.viewer) this.onCue?.('research', 0, 1);
          break;
        case 'converted': {
          if (!this.sees(ev.x, ev.y) && ev.from !== this.viewer && ev.to !== this.viewer) break;
          const at = this.ground(s, ev.x, ev.y, 0.1);
          this.effects.ring(at, '#fff3c4', 1.4, 1.2);
          this.effects.burst(at.clone().setY(at.y + 0.6), { count: 24, speed: 1.2, up: 1, life: 1.4, size: 0.05, gravity: -0.8, colors: ['#fff3c4', '#ffd166', '#ffffff'] });
          this.cue('convert', ev.x, ev.y, 1);
          break;
        }
        case 'healed':
          if (!this.sees(ev.x, ev.y)) break;
          this.effects.burst(this.ground(s, ev.x, ev.y, 0.7), { count: 3, speed: 0.3, up: 1, life: 1, size: 0.05, gravity: -0.8, colors: ['#9dff9a', '#d8ffd6'] });
          this.cue('heal', ev.x, ev.y, 0.4);
          break;
        case 'garrison': {
          const b = s.byId.get(ev.building);
          if (b && ev.owner === this.viewer) this.cue('shelter', b.x, b.y, 0.5);
          break;
        }
        case 'bell':
          if (ev.owner === this.viewer) this.onCue?.(ev.ring ? 'townBell' : 'allClear', 0, 1);
          break;
        case 'wonder': {
          const at = this.ground(s, ev.x, ev.y, 0.2);
          if (ev.owner === this.viewer || this.sees(ev.x, ev.y)) {
            this.effects.ring(at, '#ffd166', 7, 2);
            this.effects.burst(at.clone().setY(at.y + 3), { count: 80, speed: 3.5, up: 0.9, life: 2.4, size: 0.08, gravity: 1.5, colors: ['#ffd166', '#fff3c4', '#ffb347'] });
          }
          this.onCue?.('wonder', 0, 1);
          this.onPing?.(ev.x, ev.y, '#ffd166');
          break;
        }
        case 'trade':
          if (ev.owner === this.viewer) this.onCue?.('coin', 0, 1);
          break;
        case 'die': {
          if (!ev.building) {
            if (!this.sees(ev.x, ev.y) && ev.owner !== this.viewer) break;
            this.units.fall(ev.type as Unit['type'], ev.epoch, ev.owner, ev.x, ev.y, ev.fx, ev.fy, ev.id);
            this.effects.burst(this.ground(s, ev.x, ev.y, 0.1), { count: 4, speed: 0.5, up: 0.4, life: 0.8, size: 0.05, grow: 1.8, gravity: -0.1, drag: 1.5, soft: true, colors: ['#bba98a', '#d6c7aa'] });
            this.cue('fall', ev.x, ev.y, 0.6);
          } else {
            if (!this.sees(ev.x, ev.y) && ev.owner !== this.viewer) break;
            this.buildings.ruin(s, ev.type as BuildingType, ev.x, ev.y, ev.size, ev.epoch);
            const at = this.ground(s, ev.x, ev.y, 0.5);
            this.effects.burst(at, { count: 30, speed: 2.2, up: 0.6, life: 2.2, size: 0.22, grow: 3, gravity: -0.2, drag: 1.4, soft: true, colors: ['#8d8072', '#b3a594', '#5a524a'] });
            this.effects.burst(at, { count: 14, speed: 3, up: 0.8, life: 1.1, size: 0.07, gravity: 5, drag: 0.5, colors: ['#6e4f33', '#9a948a'] });
            this.effects.ring(at, '#d9c7a8', ev.size * 1.2, 1.1);
            this.cue('collapse', ev.x, ev.y, 1);
            this.onPing?.(ev.x, ev.y, '#ff6a5a');
          }
          break;
        }
        case 'built': {
          const b = s.byId.get(ev.id);
          if (!b || (ev.owner !== this.viewer && !this.sees(b.x, b.y))) break;
          const at = this.ground(s, b.x, b.y, 0.1);
          this.effects.ring(at, '#ffe9b0', (b.kind === 'building' ? b.size : 1) * 0.9, 1.0);
          this.effects.burst(at.clone().setY(at.y + 0.6), { count: 14, speed: 1.4, up: 0.8, life: 1.2, size: 0.05, gravity: 1.5, colors: ['#ffd166', '#fff3c4'] });
          if (ev.owner === this.viewer) this.cue('built', b.x, b.y, 1);
          break;
        }
        case 'placed': {
          const b = s.byId.get(ev.id);
          if (b && ev.owner === this.viewer) {
            this.effects.burst(this.ground(s, b.x, b.y, 0.1), { count: 10, speed: 0.8, up: 0.4, life: 1, size: 0.12, grow: 2.5, gravity: -0.1, drag: 1.4, soft: true, colors: ['#bba98a'] });
            this.cue('place', b.x, b.y, 1);
          }
          break;
        }
        case 'trained': {
          const u = s.byId.get(ev.id);
          if (!u || ev.owner !== this.viewer) break;
          this.effects.ring(this.ground(s, u.x, u.y, 0.05), '#ffffff', 0.8, 0.6);
          this.cue(ev.type === 'citizen' ? 'readyCitizen' : 'ready', u.x, u.y, 0.9);
          break;
        }
        case 'epoch': {
          const tc = s.ents.find((e) => e.kind === 'building' && e.owner === ev.owner && e.type === 'towncenter');
          if (tc && (ev.owner === this.viewer || this.sees(tc.x, tc.y))) {
            const at = this.ground(s, tc.x, tc.y, 0.2);
            this.effects.ring(at, '#ffd166', 5, 1.6);
            this.effects.ring(at, '#fff3c4', 3.5, 1.2);
            this.effects.burst(at.clone().setY(at.y + 1.5), { count: 60, speed: 3, up: 0.9, life: 1.8, size: 0.07, gravity: 2, colors: ['#ffd166', '#fff3c4', '#ffb347'] });
          }
          break;
        }
        case 'work': {
          if (!this.sees(ev.x, ev.y)) break;
          const at = this.ground(s, ev.x, ev.y, 0.35);
          if (ev.act === 'chop') {
            this.effects.burst(at, { count: 3, speed: 1.0, up: 0.7, life: 0.5, size: 0.025, gravity: 4, colors: ['#c9a06a', '#8a6440'] });
            this.cue('chop', ev.x, ev.y, 0.35);
          } else if (ev.act === 'mine') {
            const tile = Math.floor(ev.y) * s.w + Math.floor(ev.x);
            const gold = s.res[tile] === R_GOLD;
            this.effects.burst(at, { count: 3, speed: 1.0, up: 0.7, life: 0.5, size: 0.025, gravity: 4, colors: gold ? ['#ffd24a', '#f2b830'] : ['#c8c3b8', '#9a948a'] });
            this.cue('mine', ev.x, ev.y, s.res[tile] === R_STONE || gold ? 0.35 : 0.2);
          } else if (ev.act === 'build') {
            this.effects.burst(at, { count: 2, speed: 0.6, up: 0.6, life: 0.6, size: 0.05, grow: 2, gravity: 0, drag: 1.4, soft: true, colors: ['#c9b79c'] });
            this.cue('hammer', ev.x, ev.y, 0.35);
          } else if (ev.act === 'forage' || ev.act === 'farm') this.cue('rustle', ev.x, ev.y, 0.18);
          else if (ev.act === 'chant') {
            this.cue('chant', ev.x, ev.y, 0.5);
            this.effects.burst(at.clone().setY(at.y + 0.5), { count: 4, speed: 0.4, up: 1, life: 1.2, size: 0.04, gravity: -0.6, colors: ['#fff3c4', '#ffd166'] });
          }
          break;
        }
        case 'depleted':
          this.resources.markDirty();
          break;
        case 'deliver':
          if (ev.owner === this.viewer) this.resources.markDirty();
          break;
        case 'alert':
          if (ev.owner === this.viewer) this.onPing?.(ev.x, ev.y, '#ff4d4d');
          break;
      }
    }
    // Trees felled and bushes picked show on the next layout pass.
    if (list.some((e) => e.k === 'work' && (e.act === 'chop' || e.act === 'forage' || e.act === 'mine'))) this.resources.markDirty();
  }

  /** A world point on the ground at a map position, lifted a little. */
  private ground(s: GameState, x: number, y: number, lift: number): THREE.Vector3 {
    return new THREE.Vector3(x, heightAt(s, x, y) + lift, y);
  }

  /** Ask for a sound placed by where it happens on screen and how far from the view it is. */
  private cue(name: SoundName, x: number, y: number, gain: number): void {
    if (!this.onCue) return;
    const s = this.state;
    if (!s) return;
    this.v.set(x, heightAt(s, x, y), y).project(this.rig.camera);
    const off = Math.max(Math.abs(this.v.x), Math.abs(this.v.y));
    const dx = x - this.rig.target.x;
    const dz = y - this.rig.target.z;
    const far = Math.sqrt(dx * dx + dz * dz) / (this.rig.distance * 1.4 + 6);
    const loud = gain * Math.max(0, 1 - Math.max(far - 0.4, off - 1.1) * 1.2) * (1.15 - this.rig.zoomT * 0.45);
    if (loud <= 0.03) return;
    this.onCue(name, Math.max(-1, Math.min(1, this.v.x)), loud);
  }

  /** A ring and spark where an order was given. */
  marker(s: GameState, x: number, y: number, attack: boolean): void {
    const at = this.ground(s, x, y, 0.06);
    this.effects.ring(at, attack ? '#ff5a4a' : '#9dff9a', 0.7, 0.55);
  }

  /** Words floating up from a map point. */
  say(s: GameState, x: number, y: number, words: string, kind: 'damage' | 'good' | 'gold' | 'info'): void {
    this.effects.text(this.ground(s, x, y, 1.0), words, kind);
  }

  // ---- Picking ------------------------------------------------------------------------------------

  private ndc(clientX: number, clientY: number): THREE.Vector2 {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }

  /** The map point under the pointer, or null. */
  groundAt(clientX: number, clientY: number): { x: number; y: number } | null {
    const s = this.state;
    if (!s) return null;
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.rig.camera);
    const ray = this.raycaster.ray;
    // March along the ray to where it passes under the terrain, then refine.
    let prev = 0;
    for (let t = 0; t < 600; t += 0.5) {
      const p = ray.at(t, this.v);
      const g = Math.max(-0.02, heightAt(s, p.x, p.z));
      if (p.y <= g) {
        let lo = prev;
        let hi = t;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          const q = ray.at(mid, this.v);
          if (q.y <= Math.max(-0.02, heightAt(s, q.x, q.z))) hi = mid;
          else lo = mid;
        }
        const q = ray.at(hi, this.v);
        return { x: q.x, y: q.z };
      }
      prev = t;
    }
    return null;
  }

  /** What is under the pointer: a unit, a building, a resource, or the ground. */
  pick(clientX: number, clientY: number): Pick | null {
    const s = this.state;
    if (!s) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    const px = clientX - r.left;
    const py = clientY - r.top;
    let best: number | null = null;
    let bestD = Infinity;
    for (const u of this.units.screen) {
      const d = Math.hypot(u.sx - px, u.sy - py);
      if (d < u.r * 1.3 && d < bestD) {
        bestD = d;
        best = u.id;
      }
    }
    if (best !== null) return { kind: 'unit', id: best };
    for (const a of this.units.animalScreen) {
      const d = Math.hypot(a.sx - px, a.sy - py);
      if (d < a.r * 1.3 && d < bestD) {
        bestD = d;
        best = a.id;
      }
    }
    if (best !== null) return { kind: 'animal', id: best };
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.rig.camera);
    const hits = this.raycaster.intersectObjects([...this.buildings.pickables(), ...this.resources.pickables()], true);
    for (const h of hits) {
      const id = this.buildings.idOf(h.object);
      if (id !== null) return { kind: 'building', id };
      if (h.instanceId !== undefined) {
        const tile = this.resources.tileOf(h.object, h.instanceId);
        if (tile !== null && s.res[tile]) return { kind: 'resource', tile };
      }
    }
    const g = this.groundAt(clientX, clientY);
    if (!g) return null;
    const tx = Math.floor(g.x);
    const ty = Math.floor(g.y);
    if (tx >= 0 && ty >= 0 && tx < s.w && ty < s.h) {
      const tile = ty * s.w + tx;
      if (s.res[tile] && s.players[this.viewer].seen[tile]) return { kind: 'resource', tile };
      const b = s.bldAt[tile];
      if (b && this.buildings.known.has(b)) return { kind: 'building', id: b };
    }
    return { kind: 'ground', x: g.x, y: g.y };
  }

  /** Units drawn inside a screen rectangle (client pixels). */
  unitsInBox(x0: number, y0: number, x1: number, y1: number): number[] {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ax = Math.min(x0, x1) - r.left;
    const bx = Math.max(x0, x1) - r.left;
    const ay = Math.min(y0, y1) - r.top;
    const by = Math.max(y0, y1) - r.top;
    return this.units.screen.filter((u) => u.sx >= ax && u.sx <= bx && u.sy >= ay && u.sy <= by).map((u) => u.id);
  }

  /** Units on screen right now. */
  unitsOnScreen(): number[] {
    return this.units.screen.filter((u) => u.sx >= 0 && u.sy >= 0 && u.sx <= this.width && u.sy <= this.height).map((u) => u.id);
  }

  /** Whether the viewer knows of this building (to show it on the minimap). */
  knownBuildings(): Iterable<{ id: number; owner: number; x: number; y: number; size: number }> {
    return this.buildings.known.values();
  }

  /** Whether an entity is drawn now (in sight, or remembered). */
  shows(e: Ent): boolean {
    return e.kind === 'unit' ? this.units.drawn.has(e.id) : this.buildings.known.has(e.id);
  }
}
