import * as THREE from 'three';
import type { SoundName } from '../audio/sound';
import { ageDef, ageOf } from '../sim/ages';
import { fairground, feastOpen } from '../sim/fair';
import { AURA, BUILDINGS, KEG, SILO, RALLY, RITE, SIGNATURES, TICK_HZ, LANDMARKS, RUINS, TRADE, domainOf } from '../sim/data';
import { buildingMaxHp, statsFor } from '../sim/stats';
import type { AgeId, BuildingType, CivId, Ent, GameEvent, GameState, Unit } from '../sim/types';
import type { ScoutFlag } from '../ui/scoutFlags';
import { R_BOG, R_GOLD, R_STONE } from '../sim/types';
import { stirred } from '../sim/combat';
import { cursed, grafted } from '../sim/blood';
import { graftLast } from '../sim/hemo';
import { seesRect } from '../sim/vision';
import { BuildingsView } from './buildingsView';
import { CameraRig } from './camera';
import { Birds, Effects } from './effects';
import { Sightings, SIGHT_LORE, type Sighting } from './sightings';
import { fogUniforms, glowUniform, timeUniform, windUniform } from './materials';
import { forcedSeason, setSeasonLook } from './seasonLook';
import { seasonAt } from '../sim/seasons';
import { Overlays, type BarSpec, type RingSpec } from './overlays';
import { Post, QUALITY, loadQuality, saveQuality, type QualityName } from './post';
import { RelicsView } from './relicsView';
import { PostsView } from './postsView';
import { FairBannersView } from './fairBannersView';
import { VigilCandlesView } from './vigilCandlesView';
import { RuinsView } from './ruinsView';
import { FindsView } from './findsView';
import { RubbleView } from './rubbleView';
import { CacheView } from './cacheView';
import { KegView } from './kegView';
import { LandmarksView } from './landmarksView';
import { GrazeView } from './grazeView';
import { BorderView } from './borderView';
import { FoundationView } from './foundationView';
import { RangeGuides, MAX_RANGE_GUIDES, selectedRange, placementRange, coilFields, placementField, sortieRings, type RangeGuide } from './rangeGuides';
import { ResourcesView } from './resourcesView';
import { Sky } from './sky';
import { forcedHour, hourAt, lightAt, moonPhase } from './daylight';
import { Weather, breathe, describeWeather, forcedWeather, moodOf, seasonalDay, weatherFor, windFor, type WeatherDay } from './weather';
import { FogTexture, TerrainView, heightAt } from './terrain';
import { AIR_ALT, UnitsView } from './unitsView';
import { WATER_Y, WaterView } from './water';
import { Fireflies } from './fireflies';
import { Bats } from './bats';
import { Owls } from './owls';
import { Roosts } from './roosts';
import { Perches } from './perches';
import { Crows, spoilingSites } from './crows';
import { armyNear, coilDistance, coilHumGain, COIL_HUM_RANGE, nearWater, voiceFits, wet, type CreatureVoice } from './ambience';

/**
 * The 3D view of a match through one player's eyes: lit terrain and lakes under a sky, woods and
 * mines, buildings as the player knows them, units in sight, shots in flight, and the effects and sounds
 * of what happens. It also answers what is under the pointer and which units fall inside a box.
 */

export interface Selection {
  ids: Set<number>;
  /** Show every unit's health (while a key is held). */
  allBars: boolean;
  ghost: { type: BuildingType; tx: number; ty: number; ok: boolean; turn?: boolean } | null;
  /** The building whose rally point to show. */
  rallyOf: number | null;
  /** A line of wall being laid out. */
  wall: { tiles: { x: number; y: number; ok: boolean }[]; alongY: boolean } | null;
  /** Personal notes visible only in this browser. */
  scoutFlags: readonly ScoutFlag[];
}

export type Pick =
  | { kind: 'unit'; id: number }
  | { kind: 'building'; id: number }
  | { kind: 'animal'; id: number }
  | { kind: 'relic'; id: number }
  | { kind: 'post'; id: number }
  | { kind: 'ruin'; id: number }
  | { kind: 'landmark'; id: number }
  | { kind: 'resource'; tile: number }
  | { kind: 'ground'; x: number; y: number };

/** Where the light comes from now: set every frame from the hour (`daylight.ts`). */
const SUN_DIR = new THREE.Vector3(-0.45, 0.82, 0.38).normalize();

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig();
  readonly labelLayer: HTMLDivElement;
  /** A sound to play: its name, left-right placement and loudness by distance. */
  onCue: ((name: SoundName, pan: number, gain: number) => void) | null = null;
  /** Something worth a ping on the minimap happened at a map point. */
  onPing: ((x: number, y: number, color: string, heavy?: boolean) => void) | null = null;

  private sky = new Sky();
  private phase = 0;
  /** The tick the tribute clink last sounded (#318), so a horde at work isn't a constant jingle. */
  private tributeCue = -1e9;
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
  private relics = new RelicsView();
  private posts = new PostsView();
  private fairBanners = new FairBannersView();
  private vigilCandles = new VigilCandlesView();
  readonly ruins = new RuinsView();
  readonly finds = new FindsView();
  readonly rubble = new RubbleView();
  readonly caches = new CacheView();
  readonly kegs = new KegView();
  private falloutTick = -1;
  readonly landmarks = new LandmarksView();
  /** When ground relics next sparkle. */
  private relicGlint = 0;
  private overlays = new Overlays();
  private rangeGuides = new RangeGuides();
  private borders = new BorderView();
  private foundations = new FoundationView();
  private graze = new GrazeView();
  /** Whether the land borders show (the O key). */
  showBorders = true;
  private effects: Effects;
  private sightings = new Sightings();
  private birds = new Birds();
  private fireflies = new Fireflies();
  private bats = new Bats();
  private owls = new Owls();
  private roosts = new Roosts();
  private perches = new Perches();
  private crows = new Crows();
  private owlLevel = 0;
  private nextHoot = 12;
  private nextCaw = 6;
  private nextGull = 8;
  private nextSong = 5;
  private nextHum = 3;
  private nextChirp = 6;
  private nextCroak = 9;
  private dayLevel = 0;
  private weather = new Weather();
  /** How far the haze lets the view reach today (1 on a clear day). */
  private reach = 1;
  private flash = 0;
  private baseSun = 2.5;
  private baseHemi = 1.0;
  private mood = moodOf({ kind: 'clear', strength: 0 });
  /** The hour of the day last lit, so the light is only worked out when it has moved. */
  private litHour = -1;
  private tint = new THREE.Color();
  private sunTint = new THREE.Color();
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
  /** When each ship last left foam or smoke behind. */
  private wakes = new Map<number, number>();
  /** The next time an aircraft's drone may be heard. */
  private droneAt = 0;
  /** Things to show a moment from now (an aircraft hitting the ground). */
  private later: { at: number; run: () => void }[] = [];
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
    this.scene.add(this.terrain.group, this.water.mesh, this.resources.group, this.buildings.group, this.units.group, this.relics.group, this.posts.group, this.fairBanners.group, this.vigilCandles.group, this.ruins.group, this.finds.group, this.rubble.group, this.caches.group, this.kegs.group, this.landmarks.group, this.sightings.group, this.overlays.group, this.effects.group, this.birds.mesh, this.weather.group, this.fireflies.points, this.bats.points, this.owls.points, this.roosts.points, this.perches.points, this.crows.points);
    this.scene.add(this.rangeGuides.mesh, this.borders.mesh, this.graze.mesh, this.foundations.mesh);
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
    this.relics.clear();
    this.posts.clear();
    this.fairBanners.clear();
    this.vigilCandles.clear();
    this.ruins.clear();
    this.finds.clear();
    this.rubble.clear();
    this.caches.clear();
    this.kegs.clear();
    this.landmarks.clear();
    const colors = s.players.map((p) => p.color);
    this.units.setColors(colors);
    this.buildings.setColors(colors);
    this.borders.setColors(colors);
    this.terrain.build(s);
    this.water.setup(s);
    this.fog = new FogTexture(s.w, s.h);
    fogUniforms.uFogTex.value = this.fog.texture;
    fogUniforms.uFogSize.value.set(s.w, s.h);
    fogUniforms.uFogOn.value = 1;
    const p = s.players[viewer];
    this.fog.snap(p.vis, p.seen);
    this.sightings.reset(s, (x, y) => p.seen[Math.floor(y) * s.w + Math.floor(x)] === 1);
    this.rig.setBounds(s.w, s.h);
    this.rig.groundAt = (x, z) => heightAt(s, x, z);
    this.rig.focus(p.startX, p.startY + 3, true);
    this.chimneys.clear();
    this.wakes.clear();
    this.later = [];
    this.phase = moonPhase(s.seed);
    this.baseWeather = forcedWeather();
    this.forcedDay = this.baseWeather !== null;
    this.baseWeather ??= weatherFor(s.seed, s.mapType);
    this.weatherSeason = this.currentSeason();
    this.seasonDay = this.forcedDay ? this.baseWeather : seasonalDay(this.baseWeather, this.weatherSeason);
    this.setWeather(this.seasonDay);
  }

  /** Today's weather, in words for the opening banner ('' on a clear day). */
  get weatherWords(): string {
    return describeWeather(this.weather.day);
  }

  /** The seeded day, before the season has its say. */
  private baseWeather: WeatherDay | null = null;
  private forcedDay = false;
  private weatherSeason = 0;
  /** The day the season sets, before a mist thins or thickens. */
  private seasonDay: WeatherDay | null = null;
  private heardSeason = -1;
  /** Told when the season turns, so the sound can follow it. */
  /** Called when the viewer's people first see a ruin, relic or landmark (the HUD tells its lore). */
  onSighting: ((what: Sighting['what'], x: number, y: number) => void) | null = null;
  onSeason: ((season: number) => void) | null = null;
  /** Told when the season changes what falls from the sky. */
  onWeather: ((day: WeatherDay) => void) | null = null;

  private currentSeason(): number {
    return forcedSeason() ?? (this.state ? seasonAt(this.state) : 0);
  }

  get weatherDay(): WeatherDay {
    return this.weather.day;
  }

  /** Put a day's weather over the land: its falling rain or snow, and a greyer, dimmer, closer sky. */
  private setWeather(day: WeatherDay): void {
    this.weather.set(day);
    const wind = windFor(this.state?.seed ?? 0, day);
    this.effects.setWind(wind.x, wind.z);
    this.weather.setWind(wind.x, wind.z);
    windUniform.value.set(wind.x, wind.z);
    this.mood = moodOf(day);
    this.reach = this.mood.reach;
    this.litHour = -1;
    this.light(this.hourNow());
  }

  /** The title's backdrop sets its own hour, so the town turns through dusk and night while it plays. */
  titleHour: number | null = null;

  private hourNow(): number {
    return forcedHour() ?? this.titleHour ?? (this.state ? hourAt(this.state.seed, this.state.tick / TICK_HZ) : 9);
  }

  /** Light the land for an hour of the day, greyed by today's weather. */
  private light(hour: number): void {
    if (Math.abs(hour - this.litHour) < 0.01) return;
    this.litHour = hour;
    const m = this.mood;
    const l = lightAt(hour);
    const grey = this.tint.set(m.tint);
    // A grey day takes its tint down with the dusk too, so rain at night is dark and not pale.
    const dim = (l.sky * 0.5 + 0.5);
    this.skyTop.set(l.top).lerp(grey.clone().multiplyScalar(dim), m.grey);
    this.horizon.set(l.horizon).lerp(grey.clone().multiplyScalar(dim), m.grey);
    SUN_DIR.set(l.dir[0], l.dir[1], l.dir[2]);
    this.sunTint.set(l.sunColor);
    this.sun.color.copy(this.sunTint);
    this.sky.apply(this.skyTop, this.horizon, SUN_DIR);
    this.sky.setGlare(m.sun, this.sunTint);
    // A full moon lights the night better than a crescent does; by day the phase means nothing.
    this.baseSun = 2.5 * m.sun * l.sun * (1 - 0.4 * this.phase * l.moon);
    this.water.setStars(l.moon * (1 - m.grey));
    this.fireflies.setNight(this.weather.day.kind === 'clear' ? l.moon : 0);
    this.bats.setDusk(l.moon, this.weather.day.kind === 'clear');
    this.roosts.setDusk(l.moon, this.weather.day.kind === 'clear');
    this.perches.setNight(l.moon, this.weather.day.kind === 'clear');
    this.owls.setNight(l.moon, this.weather.day.kind === 'clear');
    this.crows.setDay(this.weather.day.kind === 'clear' ? Math.max(0, 1 - l.moon * 3) : 0);
    this.dayLevel = this.weather.day.kind === 'clear' ? Math.max(0, 1 - l.moon * 3) : 0;
    this.owlLevel = Owls.level(l.moon, this.weather.day.kind === 'clear');
    // Windows and torches light up as the sun sets: the old strength by day, near double by night.
    glowUniform.uGlow.value = 0.9 + 1.2 * Math.min(1, l.moon + (1 - l.sun) * 0.9 + (1 - m.sky) * 0.3);
    this.baseHemi = 1.0 * m.sky * l.sky;
    this.fill.intensity = 0.4 * l.fill;
    this.sun.intensity = this.baseSun;
    this.hemi.intensity = this.baseHemi;
    (this.scene.fog as THREE.Fog).color.copy(this.horizon);
    // The title looks low over the land, out past the map's edge: there the edge melts into the sky.
    this.terrain.skirtTint(this.titleHour !== null ? this.horizon : null);
  }

  /** See the match through another player's eyes, or (with `reveal`) everyone's (replays). */
  setViewer(s: GameState, viewer: number, reveal: boolean): void {
    this.viewer = viewer;
    this.reveal = reveal;
    this.buildings.clear();
    if (reveal) this.fog?.reveal();
    else this.fog?.snap(s.players[viewer].vis, s.players[viewer].seen);
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
    setSeasonLook(s.tick);
    const sn = this.currentSeason();
    if (sn !== this.heardSeason) {
      this.heardSeason = sn;
      this.onSeason?.(sn);
    }
    if (sn !== this.weatherSeason && this.baseWeather && !this.forcedDay) {
      this.weatherSeason = sn;
      const day = seasonalDay(this.baseWeather, sn);
      if (day.kind !== this.seasonDay?.kind || day.strength !== this.seasonDay?.strength) {
        this.seasonDay = day;
        this.setWeather(day);
        this.onWeather?.(day);
      }
    }
    // A mist thins and thickens over the match (never on a forced day, and not on the title's backdrop).
    if (this.seasonDay?.kind === 'mist' && !this.forcedDay && this.titleHour === null) {
      const day = breathe(this.seasonDay, s.tick / TICK_HZ / 60);
      if (day.strength !== this.weather.day.strength) this.setWeather(day);
    }
    this.rig.update(dt);
    const p = s.players[this.viewer];
    if (!this.reveal) this.fog?.update(p.vis, p.seen, dt);

    this.light(this.hourNow());
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
    // The title's low camera looks far across the land: let the haze begin farther off, so a misty day stays a view.
    const far = this.titleHour === null ? 1 : 1.6;
    // Whatever the weather, the ground the player is looking at stays clear: the haze never starts before the camera's target.
    fog.near = Math.max(this.rig.distance * 2.2 * this.reach * far, this.rig.distance * 1.25);
    fog.far = (this.rig.distance * 5 + 60) * this.reach * far;
    this.weather.show(this.quality !== 'low');
    const sky = this.weather.update(this.time, dt, this.rig.target, this.rig.distance, this.renderer.getPixelRatio(), this.height);
    if (sky.thunder >= 0) {
      const pan = Math.random() * 1.6 - 0.8;
      this.later.push({ at: this.time + sky.thunder, run: () => this.onCue?.('thunder', pan, 0.7) });
    }
    this.flash = sky.flash;
    this.hemi.intensity = this.baseHemi + this.flash * 2.2;
    this.sun.intensity = this.baseSun + this.flash * 1.5;

    this.resources.update(s, dt);
    this.buildings.update(s, this.viewer, (b) => this.reveal || seesRect(s, this.viewer, b.tx, b.ty, b.size), dt, this.reveal);
    this.units.update(s, alpha, dt, this.time, this.visibleUnit, this.rig.camera, this.width, this.height, (x, y) => this.sees(x, y));
    this.relics.update(
      s,
      this.time,
      this.rig.camera,
      this.width,
      this.height,
      (x, y) => this.reveal || p.seen[Math.floor(y) * s.w + Math.floor(x)] === 1,
      (id) => this.units.drawn.get(id) ?? null,
      (id) => {
        const b = s.byId.get(id);
        if (!b || b.kind !== 'building' || !(b.owner === this.viewer || this.reveal || seesRect(s, this.viewer, b.tx, b.ty, b.size))) return null;
        return this.buildings.topOf(id);
      },
    );
    this.glintRelics();
    this.posts.update(s, (x, y) => this.reveal || p.seen[Math.floor(y) * s.w + Math.floor(x)] === 1);
    this.fairBanners.update(s, (x, y) => this.reveal || p.seen[Math.floor(y) * s.w + Math.floor(x)] === 1, this.time);
    this.vigilCandles.update(s, (x, y) => this.reveal || p.seen[Math.floor(y) * s.w + Math.floor(x)] === 1, this.time);
    this.rubble.update(s, !!ageDef(p).salvage, (x, y) => this.reveal || this.sees(x, y));
    this.caches.update(s, (x, y) => this.reveal || this.sees(x, y), (id) => this.units.drawn.get(id) ?? null);
    this.kegs.update(s, (x, y) => this.reveal || this.sees(x, y), (id) => this.units.drawn.get(id) ?? null);
    // Fallout (#605 s2): poisoned ground breathes a sickly green haze and drifting motes, a few times a second, where the viewer sees.
    if (s.fallout && s.tick !== this.falloutTick && s.tick % 4 === 0) {
      this.falloutTick = s.tick;
      for (const f of s.fallout) {
        if (!this.reveal && !this.sees(f.x, f.y)) continue;
        const a = (s.tick * 0.37 + f.id) % 6.283;
        const r = SILO.reach * (0.3 + ((s.tick / 4 + f.id) % 7) / 10);
        const at = this.ground(s, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, 0.2);
        this.effects.burst(at, { count: 2, speed: 0.25, up: 0.5, life: 2.2, size: 0.4, grow: 1.4, gravity: -0.15, drag: 1, soft: true, colors: ['#8fae3a', '#6f8c2e', '#a6bf4e'] });
      }
    }
    this.ruins.update(s, (x, y) => this.reveal || p.seen[Math.floor(y) * s.w + Math.floor(x)] === 1, (x, y) => this.reveal || this.sees(x, y));
    this.finds.update(s, (x, y) => this.reveal || p.seen[Math.floor(y) * s.w + Math.floor(x)] === 1, (x, y) => this.reveal || this.sees(x, y));
    this.landmarks.update(s, (x, y) => this.reveal || p.seen[Math.floor(y) * s.w + Math.floor(x)] === 1, (x, y) => this.reveal || this.sees(x, y));
    if (!this.reveal) {
      for (const f of this.sightings.scan(s, (x, y) => p.seen[Math.floor(y) * s.w + Math.floor(x)] === 1)) {
        const look = SIGHT_LORE[f.what];
        const at = this.ground(s, f.x, f.y, 0);
        this.sightings.raise(at, look.color);
        this.effects.ring(at.clone().setY(at.y + 0.1), look.color, 4, 1.8);
        this.effects.burst(at.clone().setY(at.y + 0.6), { count: 24, speed: 1.4, up: 1, life: 2.4, size: 0.07, gravity: -0.4, drag: 0.8, colors: [look.color, '#ffffff'] });
        this.onSighting?.(f.what, f.x, f.y);
      }
    }
    this.sightings.update(dt);
    this.overlays.setShots(s, alpha, (x, y) => this.sees(x, y));
    this.drawSelection(s, sel);
    this.ambient(s, dt);
    this.vessels(s);
    this.water.update(this.time, SUN_DIR, this.horizon, this.sunTint);
    this.dust();
    this.effects.update(dt);
    this.birds.update(this.time, dt, this.rig.target, this.rig.distance);
    this.fireflies.update(this.time, this.rig.target, this.rig.distance, this.renderer.getPixelRatio(), this.height, this.quality !== 'low');
    this.owls.update(this.time, this.rig.target, this.rig.distance, this.renderer.getPixelRatio(), this.height, this.quality !== 'low');
    // By day, over a turning carcass, the crows call.
    const crowSite = this.crows.nearest;
    if (crowSite && this.time > this.nextCaw) {
      this.nextCaw = this.time + 7 + Math.random() * 12;
      this.cue('caw', crowSite.x, crowSite.z, 0.5);
    }
    // Now and then, from somewhere in the dark, a hoot.
    if (this.owlLevel > 0.3 && this.time > this.nextHoot) {
      this.nextHoot = this.time + 18 + Math.random() * 30;
      this.onCue?.('owl', Math.random() * 1.6 - 0.8, 0.5);
    }
    // On a clear night, away from open water, crickets chirp in the grass.
    if (this.owlLevel > 0 && this.time > this.nextChirp) {
      this.nextChirp = this.time + 5 + Math.random() * 9;
      const s = this.state;
      if (this.voiceHere(s, 'cricket')) this.onCue?.('cricket', Math.random() * 1.8 - 0.9, 0.4);
    }
    // On a clear night, within sight of open water, frogs croak at the shore.
    if (this.owlLevel > 0 && this.time > this.nextCroak) {
      this.nextCroak = this.time + 4 + Math.random() * 8;
      const s = this.state;
      if (this.voiceHere(s, 'frog')) this.onCue?.('frog', Math.random() * 1.8 - 0.9, 0.4);
    }
    // By day, within sight of open water, a gull now and then.
    if (this.dayLevel > 0.3 && this.time > this.nextGull) {
      this.nextGull = this.time + 9 + Math.random() * 16;
      const s = this.state;
      if (this.voiceHere(s, 'gull')) this.onCue?.('gull', Math.random() * 1.4 - 0.7, 0.45);
    }
    // By day, away from open water and armies, a songbird now and then.
    if (this.dayLevel > 0.3 && this.time > this.nextSong) {
      this.nextSong = this.time + 7 + Math.random() * 14;
      const s = this.state;
      if (this.voiceHere(s, 'birdsong')) this.onCue?.('birdsong', Math.random() * 1.6 - 0.8, 0.4);
    }
    // A Coil Tower within a dozen tiles of the view hums; the nearer, the louder (#231).
    if (this.time > this.nextHum) {
      this.nextHum = this.time + 2.2;
      const s = this.state;
      if (s) {
        const d = coilDistance(s, this.rig.target.x, this.rig.target.z, COIL_HUM_RANGE, (b) => this.reveal || b.owner === this.viewer || this.sees(b.x, b.y));
        const g = coilHumGain(d, COIL_HUM_RANGE);
        if (g > 0.02) this.onCue?.('coilHum', 0, g);
      }
    }
    this.roosts.update(this.time, this.ruins.standingAt, this.rig.target, this.renderer.getPixelRatio(), this.height, this.quality !== 'low');
    this.perches.update(this.time, this.ruins.standingAt, this.rig.target, this.renderer.getPixelRatio(), this.height, this.quality !== 'low');
    if (this.state) this.crows.update(this.time, spoilingSites(this.state, (x, y) => this.reveal || this.sees(x, y)), this.rig.target, this.renderer.getPixelRatio(), this.height, this.quality !== 'low');
    this.bats.update(this.time, this.rig.target, this.rig.distance, this.renderer.getPixelRatio(), this.height, this.quality !== 'low');
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
    const guides: RangeGuide[] = [];
    // Placement gets the first slot, so a big selection cannot hide the defense being planned.
    if (sel.ghost) {
      const g = placementRange(s, this.viewer, sel.ghost.type, sel.ghost.tx, sel.ghost.ty);
      if (g) guides.push(g);
      const f = placementField(s, this.viewer, sel.ghost.type, sel.ghost.tx, sel.ghost.ty);
      if (f) guides.push(f);
    }
    // In the Age of Lightning every finished coil shows its field.
    for (const f of coilFields(s, this.viewer)) if (guides.length < MAX_RANGE_GUIDES) guides.push(f);
    // Selecting your own aircraft in the Age of Aeronauts shows the fuel bands round the nearest Airfields.
    for (const id of sel.ids) {
      const a = s.byId.get(id);
      if (a && a.kind === 'unit' && a.owner === this.viewer && a.hp > 0 && domainOf(a.type) === 'air') {
        for (const g of sortieRings(s, this.viewer, a)) if (guides.length < MAX_RANGE_GUIDES) guides.push(g);
        break;
      }
    }
    for (const id of sel.ids) {
      const e = s.byId.get(id);
      if (!e || e.hp <= 0) continue;
      if (sel.allBars && guides.length < MAX_RANGE_GUIDES) {
        const g = selectedRange(s, this.viewer, e);
        if (g) {
          const at = e.kind === 'unit' ? this.units.drawn.get(id) : null;
          if (e.kind === 'building' || at) guides.push(at ? { ...g, x: at.x, y: at.z } : g);
        }
      }
      if (e.kind === 'unit') {
        const at = this.units.drawn.get(id);
        if (!at) continue;
        const st = statsFor(s, e.owner, e.type);
        // An aircraft's ring lies on the ground beneath it.
        const ry = domainOf(e.type) === 'air' ? Math.max(WATER_Y, heightAt(s, at.x, at.z)) : at.y;
        rings.push({ x: at.x, y: ry, z: at.z, r: st.radius + 0.12, color: e.owner === this.viewer ? own : foe });
        if (e.cargo.length && e.owner === this.viewer) rings.push({ x: at.x, y: ry, z: at.z, r: st.radius + 0.3, color: way, thin: true });
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
    // Kings wear a crown of light (so you never lose track of your own).
    for (const id of s.kings) {
      const k = id ? s.byId.get(id) : undefined;
      const at = k ? this.units.drawn.get(id) : undefined;
      if (k && at) rings.push({ x: at.x, y: at.y, z: at.z, r: 0.7, color: aura, thin: true });
    }
    // Soldiers stirred by a Rallying Cry glow with a pulsing gold band, fading as the cry runs out.
    const cheer = new THREE.Color('#ffc94a');
    for (const e of s.ents) {
      if (e.kind !== 'unit' || e.hp <= 0 || !stirred(s, e)) continue;
      const at = this.units.drawn.get(e.id);
      if (!at) continue;
      const left = Math.min(1, (e.cry! - s.tick) / (TICK_HZ * 3));
      const pulse = 1 + 0.12 * Math.sin(this.time * 6 + e.id);
      const ry = domainOf(e.type) === 'air' ? Math.max(WATER_Y, heightAt(s, at.x, at.z)) : at.y;
      rings.push({ x: at.x, y: ry, z: at.z, r: (statsFor(s, e.owner, e.type).radius + 0.3) * pulse, color: cheer.clone().multiplyScalar(0.4 + 0.9 * left) });
    }
    // Grafted soldiers (#355 s3) wear a thin dark-red ring that beats like a heart, faster and dimmer as the graft runs dry.
    const vein = new THREE.Color('#b0182c');
    for (const e of s.ents) {
      if (e.kind !== 'unit' || e.hp <= 0 || !grafted(s, e)) continue;
      const at = this.units.drawn.get(e.id);
      if (!at) continue;
      const left = Math.min(1, (e.hemo! - s.tick) / (TICK_HZ * graftLast(e)));
      const beat = Math.max(0, Math.sin(this.time * (5 + (1 - left) * 7) + e.id));
      rings.push({ x: at.x, y: at.y, z: at.z, r: statsFor(s, e.owner, e.type).radius + 0.2 + 0.05 * beat * beat, color: vein.clone().multiplyScalar(0.45 + 0.6 * left), thin: true });
    }
    // Cursed enemies (#355 s4) wear a slow violet-black ring that sways and fades as the curse runs out.
    const hex = new THREE.Color('#7a34b0');
    for (const e of s.ents) {
      if (e.kind !== 'unit' || e.hp <= 0 || !cursed(s, e)) continue;
      const at = this.units.drawn.get(e.id);
      if (!at) continue;
      const left = Math.min(1, (e.cursed! - s.tick) / (TICK_HZ * RITE.last));
      const sway = 0.5 + 0.5 * Math.sin(this.time * 2.2 + e.id);
      rings.push({ x: at.x, y: at.y, z: at.z, r: statsFor(s, e.owner, e.type).radius + 0.3 + 0.06 * sway, color: hex.clone().multiplyScalar(0.3 + 0.7 * left), thin: true });
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
        const dom = domainOf(e.type);
        const lift = dom === 'air' ? 0.55 : dom === 'water' ? (e.type === 'fisher' ? 1.1 : 1.6) : st.mounted ? 1.4 : e.type === 'siege' ? 1.0 : 1.02;
        bars.push({ at: this.v.set(at.x, at.y + lift, at.z).clone(), width: e.type === 'hero' || dom !== 'land' ? 0.7 : 0.55, frac: e.hp / st.hp });
      } else {
        const top = this.buildings.topOf(e.id);
        if (!top) continue;
        if (!(e.owner === this.viewer || this.reveal || seesRect(s, this.viewer, e.tx, e.ty, e.size))) continue;
        top.y += 0.35;
        bars.push({ at: top, width: Math.min(2.2, Math.max(0.6, e.size * 0.55)), frac: e.hp / buildingMaxHp(s, e.owner, e.type) });
      }
    }
    this.overlays.setRings(rings);
    this.borders.update(s, this.viewer, this.reveal, this.showBorders && this.titleHour === null); // the title's film shows no map lines
    this.graze.update(s, this.viewer, this.reveal);
    this.foundations.update(s, this.viewer, (x, y) => this.reveal || s.players[this.viewer].vis[Math.floor(y) * s.w + Math.floor(x)] > 0);
    this.rangeGuides.update(s, guides, (x, y) => this.reveal || s.players[this.viewer].vis[Math.floor(y) * s.w + Math.floor(x)] > 0);
    this.overlays.setBars(bars, this.rig.camera);
    const p = s.players[this.viewer];
    this.overlays.setGhost(s, sel.ghost ? { ...sel.ghost, epoch: p.epoch, color: p.color } : null);
    this.overlays.setWallGhost(s, sel.wall?.tiles ?? [], p.epoch, p.color, sel.wall?.alongY ?? false);
    const rb = sel.rallyOf ? s.byId.get(sel.rallyOf) : undefined;
    this.overlays.setFlag(s, rb && rb.kind === 'building' && rb.rally ? rb.rally : null, p.color, this.time);
    this.overlays.setScoutFlags(s, sel.scoutFlags, this.time);
  }

  /** Chimney smoke, fires on damaged buildings, the glint of gold. */
  /** Riders and engines at a hard pace raise dust off dry ground, powder off snow; rain keeps it down. */
  private dust(): void {
    const k = this.units.kicks;
    if (this.quality === 'low' || !k.length) return;
    const kind = this.weather.day.kind;
    if (kind === 'rain') return;
    const snow = kind === 'snow';
    const colors = snow ? ['#e8eef2', '#f6f9fb'] : ['#a08c6a', '#b8a47e'];
    for (let i = 0; i < k.length; i += 4) {
      if (kind === 'mist' && Math.random() < 0.5) continue;
      const at = new THREE.Vector3(k[i]!, k[i + 2]! + 0.04, k[i + 1]!);
      const f = k[i + 3]!;
      this.effects.burst(at, { count: 1 + (f > 0.7 ? 1 : 0), speed: 0.3, up: 0.6, life: 0.9, size: 0.07, grow: 3.2, gravity: -0.15, drag: 1.2, soft: true, colors });
    }
  }

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
      if ((e.faith ?? 0) > 0) {
        // Faith takes the walls (#209): pale gold motes rise round a building being chanted over, higher and thicker as the faith builds.
        const f = e.faith!;
        const a = Math.random() * 6.283;
        // Just outside the walls, so the building doesn't hide them.
        const r = e.size * (0.6 + Math.random() * 0.2);
        const at = new THREE.Vector3(e.x + Math.cos(a) * r, base + 0.2 + Math.random() * 0.6 + f * 1.5, e.y + Math.sin(a) * r);
        this.effects.burst(at, { count: 2 + Math.round(f * 6), speed: 0.25, up: 1, life: 1.8, size: 0.13, grow: 1.4, gravity: -0.7, drag: 0.6, colors: ['#ffd166', '#ffe9a0', '#fff3c4'] });
        this.chimneys.set(e.id, this.time + 0.25 - f * 0.15);
      } else if (frac < 0.6) {
        // Burning: flames and black smoke, more as it falls.
        const at = new THREE.Vector3(e.x + (Math.random() - 0.5) * e.size * 0.6, base + 0.6 + Math.random() * 0.6, e.y + (Math.random() - 0.5) * e.size * 0.6);
        this.effects.burst(at, { count: 2, speed: 0.4, up: 1, life: 0.7, size: 0.07, gravity: -1.2, drag: 1, colors: ['#ff9a3c', '#ffd166', '#e0471f'] });
        this.effects.burst(at, { count: 1, speed: 0.3, up: 1, life: 2.2, size: 0.12, grow: 3, gravity: -0.4, drag: 0.4, soft: true, colors: ['#3a3634', '#55504c'] });
        this.chimneys.set(e.id, this.time + (frac < 0.3 ? 0.12 : 0.3));
      } else if (e.type === 'towncenter' && s.players[e.owner].workEnd !== undefined) {
        // A great work is under way: a ribbon of its people's colors rises from the Town Center.
        const a = Math.random() * 6.283;
        const at = new THREE.Vector3(e.x + Math.cos(a) * e.size * 0.35, base + 2 + Math.random() * 0.4, e.y + Math.sin(a) * e.size * 0.35);
        this.effects.burst(at, { count: 3, speed: 0.35, up: 1, life: 2, size: 0.07, gravity: -0.9, drag: 0.6, colors: WORK_GLOW[s.players[e.owner].civ] });
        this.chimneys.set(e.id, this.time + 0.12);
      } else if (e.type === 'tower' && e.beacon !== undefined && s.tick < e.beacon) {
        // A lit beacon: flames and a column of smoke rise from the roof.
        const at = new THREE.Vector3(e.x + (Math.random() - 0.5) * 0.4, base + 3.7 + Math.random() * 0.3, e.y + (Math.random() - 0.5) * 0.4);
        this.effects.burst(at, { count: 3, speed: 0.4, up: 1, life: 0.8, size: 0.09, gravity: -1.3, drag: 1, colors: ['#ff9a3c', '#ffd166', '#e0471f'] });
        this.effects.burst(at, { count: 1, speed: 0.25, up: 1, life: 3, size: 0.14, grow: 4, gravity: -0.5, drag: 0.4, soft: true, colors: ['#4a4644', '#6a6460'] });
        this.chimneys.set(e.id, this.time + 0.1);
      } else if (e.type === 'wonder' && e.timer >= 0) {
        // A finished wonder glitters.
        const at = new THREE.Vector3(e.x + (Math.random() - 0.5) * 4, base + 1 + Math.random() * 3, e.y + (Math.random() - 0.5) * 4);
        this.effects.burst(at, { count: 3, speed: 0.5, up: 1, life: 1.4, size: 0.05, gravity: -0.6, colors: ['#ffd166', '#fff3c4'] });
        this.chimneys.set(e.id, this.time + 0.25);
      } else if (e.type === 'market' && ageDef(s.players[e.owner]).fairs && feastOpen(s) && fairground(s, e.owner, e)) {
        // A feast day at the fairground (`fair.ts`): the Market's confetti swells into a shower, with gold sparks above its stalls.
        const at = new THREE.Vector3(e.x + (Math.random() - 0.5) * e.size * 0.7, base + 2.0, e.y + (Math.random() - 0.5) * e.size * 0.7);
        this.effects.burst(at, { count: 6, speed: 0.9, up: 1, life: 1.8, size: 0.045, gravity: 0.5, colors: ['#d94a3c', '#e8b43a', '#3f8fc4', '#f4efe4', '#6fbf5a'] });
        this.effects.burst(at, { count: 2, speed: 0.5, up: 1.4, life: 1.1, size: 0.035, gravity: -0.3, colors: ['#ffd166', '#fff3c4'] });
        this.chimneys.set(e.id, this.time + 0.18);
      } else if (sideAgeAmbient(this.effects, ageOf(s.players[e.owner]), e, base)) {
        this.chimneys.set(e.id, this.time + 0.35 + Math.random() * 0.4);
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

  /** Relics lying in sight give off a slow glitter of gold, so they can be spotted from afar. */
  private glintRelics(): void {
    if (this.time < this.relicGlint) return;
    this.relicGlint = this.time + 0.35;
    for (const at of this.relics.onGround) {
      if (!this.sees(at.x, at.z)) continue;
      this.effects.burst(new THREE.Vector3(at.x + (Math.random() - 0.5) * 0.4, at.y + 0.5 + Math.random() * 0.3, at.z + (Math.random() - 0.5) * 0.4), {
        count: 2,
        speed: 0.25,
        up: 1,
        life: 1.6,
        size: 0.045,
        gravity: -0.5,
        colors: ['#ffd166', '#fff3c4'],
      });
    }
  }

  /** Foam in the wake of ships under way, steamers' smoke, and the drone of aircraft overhead. */
  private vessels(s: GameState): void {
    for (let i = this.later.length - 1; i >= 0; i--) {
      if (this.later[i].at > this.time) continue;
      this.later[i].run();
      this.later.splice(i, 1);
    }
    let nearPlane: { x: number; y: number; d: number } | null = null;
    for (const e of s.ents) {
      if (e.kind !== 'unit' || e.hp <= 0 || e.inside) continue;
      const dom = domainOf(e.type);
      if (dom === 'land') continue;
      const at = this.units.drawn.get(e.id);
      if (!at) continue;
      if (dom === 'air') {
        const dx = at.x - this.rig.target.x;
        const dz = at.z - this.rig.target.z;
        const d = dx * dx + dz * dz;
        if (!nearPlane || d < nearPlane.d) nearPlane = { x: at.x, y: at.z, d };
        continue;
      }
      const next = this.wakes.get(e.id) ?? 0;
      if (next > this.time) continue;
      // Only near where the player is looking.
      const cx = at.x - this.rig.target.x;
      const cz = at.z - this.rig.target.z;
      const near = this.rig.distance * 1.6 + 8;
      if (cx * cx + cz * cz > near * near) continue;
      const moving = e.x !== e.px || e.y !== e.py;
      const steam = s.players[e.owner].epoch >= 4;
      const fy = Math.sqrt(e.fx * e.fx + e.fy * e.fy) || 1;
      const bx = e.fx / fy;
      const by = e.fy / fy;
      if (moving) {
        // Foam off the stern and the bow wave.
        const stern = new THREE.Vector3(at.x - bx * 0.75, WATER_Y + 0.03, at.z - by * 0.75);
        this.effects.burst(stern, { count: 2, speed: 0.25, up: 0.05, life: 1.6, size: 0.09, grow: 2.5, gravity: 0, drag: 1.2, soft: true, colors: ['#f4fbff', '#dcefff'] });
        const bow = new THREE.Vector3(at.x + bx * 0.7, WATER_Y + 0.03, at.z + by * 0.7);
        this.effects.burst(bow, { count: 1, speed: 0.35, up: 0.1, life: 0.8, size: 0.05, grow: 2, gravity: 0, drag: 1.5, soft: true, colors: ['#ffffff'] });
      }
      if (steam) {
        // Coal smoke from the stack.
        const top = e.type === 'warship' ? 0.75 : e.type === 'transport' ? 1.05 : 0.55;
        const back = e.type === 'warship' ? -0.15 : e.type === 'transport' ? 0.07 : -0.07;
        const stack = new THREE.Vector3(at.x + bx * back * 1.3, at.y + top, at.z + by * back * 1.3);
        this.effects.burst(stack, { count: 1, speed: 0.15, up: 1, life: 2.6, size: 0.1, grow: 4, gravity: -0.25, drag: 0.3, soft: true, colors: ['#3e3a38', '#5a5552'] });
      }
      this.wakes.set(e.id, this.time + (moving ? 0.16 : 0.5));
    }
    for (const id of this.wakes.keys()) if (!s.byId.has(id)) this.wakes.delete(id);
    // Now and then, the drone of the nearest aircraft.
    if (nearPlane && this.time >= this.droneAt) {
      this.cue('engine', nearPlane.x, nearPlane.y, 0.5);
      this.droneAt = this.time + 1.3;
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
          if (k === 'bomb' || ev.air) {
            this.cue(k === 'bomb' ? 'bombDrop' : 'mg', ev.x, ev.y, 0.6);
            break;
          }
          this.cue(k === 'bullet' ? 'musket' : k === 'ball' ? 'cannon' : k === 'boulder' ? 'catapult' : k === 'spear' ? 'spear' : k === 'stone' ? 'sling' : 'bow', ev.x, ev.y, k === 'ball' ? 0.9 : 0.6);
          if (k === 'bullet' || k === 'ball') {
            const big = k === 'ball';
            this.effects.burst(this.ground(s, ev.x, ev.y, 0.5), { count: big ? 10 : 3, speed: big ? 0.9 : 0.4, up: 0.6, life: big ? 2.4 : 1.4, size: big ? 0.16 : 0.08, grow: 3, gravity: -0.2, drag: 1, soft: true, colors: ['#e6e2dc', '#cfcac2'] });
            if (big) this.effects.burst(this.ground(s, ev.x, ev.y, 0.4), { count: 6, speed: 1.5, life: 0.25, size: 0.07, gravity: 0, colors: ['#ffd27a', '#ff9a3c'] });
          }
          break;
        }
        case 'arc': {
          // A Coil Tower's bolt (#231): from the crown through each enemy it struck.
          const [x0, y0] = ev.pts;
          if (!this.sees(x0, y0)) break;
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i < ev.pts.length; i += 2) pts.push(this.ground(s, ev.pts[i], ev.pts[i + 1], i === 0 ? 4.4 : 0.45));
          this.effects.bolt(pts, '#bfe6ff');
          const end = pts[pts.length - 1];
          this.effects.burst(end, { count: 6, speed: 1.8, life: 0.3, size: 0.03, gravity: 2, colors: ['#e8f6ff', '#8fd8ff'] });
          this.cue('zap', x0, y0, 0.7);
          break;
        }
        case 'keg': {
          // Powder (#577): a keg laid with its fuse lit, blown, or stamped out; grinding at the mills is the HUD's to tell.
          if (ev.what === 'ground' || !this.sees(ev.x, ev.y)) break;
          const at = this.ground(s, ev.x, ev.y, 0.3);
          if (ev.what === 'laid') {
            this.effects.burst(at, { count: 10, speed: 1.2, up: 1, life: 0.5, size: 0.03, gravity: 3, colors: ['#fff2a8', '#ffc94a', '#ff8a2a'] });
            this.cue('kegLit', ev.x, ev.y, 0.8);
          } else if (ev.what === 'doused') {
            this.effects.burst(at, { count: 8, speed: 0.6, up: 1, life: 1.4, size: 0.1, grow: 2, gravity: -0.6, drag: 1, soft: true, colors: ['#bdb6a8', '#8f887c'] });
            this.cue('kegDoused', ev.x, ev.y, 0.8);
          } else {
            // The blast: a fireball low and wide, a black pall, stone and timber thrown, a ring out to its reach.
            this.effects.burst(at, { count: 30, speed: 3, up: 0.6, life: 0.8, size: 0.14, grow: 2.2, gravity: -1, drag: 1.2, colors: ['#ffe08a', '#ff9a3c', '#e0471f'] });
            this.effects.burst(at, { count: 26, speed: 1.6, up: 1.1, life: 3.6, size: 0.26, grow: 3.5, gravity: -0.4, drag: 1, soft: true, colors: ['#2a2624', '#45403b', '#5e574f'] });
            this.effects.burst(at, { count: 22, speed: 4, up: 1.2, life: 1.4, size: 0.07, gravity: 7, drag: 0.3, colors: ['#7d7468', '#5a4a3a', '#9a8a74'] });
            this.effects.ring(at, '#ffcf7a', KEG.reach + 0.5, 0.9);
            this.cue('kegBlow', ev.x, ev.y, 1);
          }
          break;
        }
        case 'silo': {
          // The Atomic Age (#605): a ring on the target the moment a warhead goes up, a dome of fire where it lands.
          const at = this.ground(s, ev.x, ev.y, 0.3);
          if (ev.what === 'launched') this.effects.ring(at, '#ff4a3a', SILO.reach + 0.5, 1.4);
          else if (ev.what === 'struck' && this.sees(ev.x, ev.y)) {
            this.effects.burst(at, { count: 60, speed: 5, up: 1.2, life: 1.2, size: 0.3, grow: 3, gravity: -1.4, drag: 1, colors: ['#fff6d0', '#ffd25a', '#ff7a2a'] });
            this.effects.burst(at, { count: 50, speed: 2.2, up: 2.6, life: 5, size: 0.5, grow: 5, gravity: -0.6, drag: 0.8, soft: true, colors: ['#3a3430', '#524a44', '#6c625a'] });
            this.effects.ring(at, '#ffe9a8', SILO.reach + 1, 1.6);
            this.cue('kegBlow', ev.x, ev.y, 1);
          }
          break;
        }
        case 'splash': {
          if (!this.sees(ev.x, ev.y)) break;
          const at = this.ground(s, ev.x, ev.y, 0.15);
          if (this.wet(s, ev.x, ev.y)) {
            // A plume of spray where a shell or bomb meets the water.
            this.effects.burst(at, { count: 22, speed: 1.2, up: 1, life: 1.2, size: 0.08, grow: 1.5, gravity: 5, drag: 0.4, colors: ['#ffffff', '#dcefff', '#b8dcf0'] });
            this.effects.ring(at, '#ffffff', 0.9, 0.8);
            this.cue(ev.kind === 'bomb' ? 'explosion' : 'splashWater', ev.x, ev.y, 0.8);
            break;
          }
          if (ev.kind === 'bomb') {
            // A bomb: a fireball, a column of black smoke, earth thrown high.
            this.effects.burst(at, { count: 24, speed: 2.4, up: 0.8, life: 0.7, size: 0.12, grow: 2, gravity: -1, drag: 1.2, colors: ['#ffd27a', '#ff9a3c', '#e0471f'] });
            this.effects.burst(at, { count: 22, speed: 1.4, up: 1, life: 3.2, size: 0.22, grow: 3.5, gravity: -0.4, drag: 1, soft: true, colors: ['#2e2a28', '#4a4440', '#6a625a'] });
            this.effects.burst(at, { count: 16, speed: 3.4, up: 1, life: 1.2, size: 0.06, gravity: 6, drag: 0.3, colors: ['#5a4a3a', '#7d7a72'] });
            this.effects.ring(at, '#ffd27a', 2.6, 0.8);
            this.cue('explosion', ev.x, ev.y, 1);
            break;
          }
          this.effects.burst(at, { count: 18, speed: 2, up: 0.8, life: 1.6, size: 0.18, grow: 2.5, gravity: -0.1, drag: 1.4, soft: true, colors: ['#9a8a74', '#b3a594', '#6a5e52'] });
          this.effects.burst(at, { count: 10, speed: 2.6, up: 0.9, life: 0.9, size: 0.05, gravity: 6, drag: 0.3, colors: ['#7d7a72', '#5a4a3a'] });
          this.effects.ring(at, '#d9c7a8', ev.kind === 'boulder' ? 2.2 : 1.6, 0.7);
          this.cue('impact', ev.x, ev.y, 0.9);
          break;
        }
        case 'cry': {
          // The cry goes out: gold rings sweep to the edge of its reach.
          if (!this.sees(ev.x, ev.y)) break;
          const at = this.ground(s, ev.x, ev.y, 0.2);
          this.effects.ring(at, '#ffc94a', RALLY.radius, 0.9);
          this.effects.ring(at, '#fff0b8', RALLY.radius * 0.6, 0.6);
          break;
        }
        case 'wildCry':
          // The wild (#171): a mammoth trumpets, a pack howls as it turns to fight.
          if (this.sees(ev.x, ev.y)) this.cue(ev.kind === 'mammoth' ? 'mammoth' : ev.kind === 'boar' ? 'snarl' : ev.kind === 'raider' ? 'rally' : 'howl', ev.x, ev.y, 1);
          break;
        case 'wildStrike':
          if (!this.sees(ev.x, ev.y)) break;
          if (ev.kind === 'raider') this.cue('spear', ev.x, ev.y, 0.8);
          else if (ev.kind === 'wolf' || ev.kind === 'boar') this.cue('snarl', ev.x, ev.y, 0.8);
          else this.effects.burst(this.ground(s, ev.x, ev.y, 0.2), { count: 8, speed: 1, up: 0.8, life: 0.7, size: 0.06, grow: 1.5, gravity: -0.5, drag: 1.5, soft: true, colors: ['#a08a68', '#c8b590'] });
          break;
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
        case 'consecrated': {
          // The building turns (#209): a wide ring of light at its foot and a fountain of gold over it.
          if (!this.sees(ev.x, ev.y) && ev.from !== this.viewer && ev.to !== this.viewer) break;
          const at = this.ground(s, ev.x, ev.y, 0.1);
          this.effects.ring(at, '#fff3c4', 1.2 + ev.size * 0.8, 1.6);
          this.effects.burst(at.clone().setY(at.y + 1), { count: 30 + ev.size * 10, speed: 1.6, up: 1.4, life: 1.8, size: 0.06, gravity: -0.6, colors: ['#fff3c4', '#ffd166', '#ffffff'] });
          this.cue('consecrate', ev.x, ev.y, 1);
          break;
        }
        case 'healed':
          if (!this.sees(ev.x, ev.y)) break;
          this.effects.burst(this.ground(s, ev.x, ev.y, 0.7), { count: 3, speed: 0.3, up: 1, life: 1, size: 0.05, gravity: -0.8, colors: ['#9dff9a', '#d8ffd6'] });
          this.cue('heal', ev.x, ev.y, 0.4);
          break;
        case 'garrison': {
          const b = s.byId.get(ev.building);
          if (b && ev.owner === this.viewer) this.cue(b.kind === 'unit' ? 'board' : 'shelter', b.x, b.y, 0.5);
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
        case 'caravan': {
          if (ev.owner !== this.viewer && !this.sees(ev.x, ev.y)) break;
          const at = this.ground(s, ev.x, ev.y, 0.4);
          if (ev.what === 'paid' && ev.share) {
            // A partner's trade passing through: pale silver-gold coins drift up from the Market, with a ring.
            this.effects.ring(at, '#cfe8ff', 2.4, 1.1);
            this.effects.burst(at.clone().setY(at.y + 1.6), { count: 10, speed: 0.7, up: 1.6, life: 1.6, size: 0.04, gravity: 0.6, colors: ['#e8f1ff', '#ffe9a8', '#cfe8ff'] });
            if (ev.owner === this.viewer) this.cue('tradeShare', ev.x, ev.y, 1);
          } else if (ev.what === 'paid' && ev.bonus) {
            // A caravan home to a camp that moved (the Silk Road, #326): more gold, and a drift of silk-coloured dust off the road.
            this.effects.burst(at.clone().setY(at.y + 1.2), { count: 26, speed: 1.3, up: 1.3, life: 1.3, size: 0.05, gravity: 2.2, colors: ['#ffd166', '#f2cf4a', '#fff3c4'] });
            this.effects.burst(at.clone().setY(at.y + 0.3), { count: 14, speed: 0.8, up: 0.5, life: 1.8, size: 0.1, grow: 2, gravity: -0.1, drag: 0.7, soft: true, colors: ['#c8a46a', '#a83a3a', '#3a4e9a', '#e0a83a'] });
            this.effects.ring(at, '#e0a83a', 2.2, 1);
            if (ev.owner === this.viewer) this.cue('caravanBells', ev.x, ev.y, 1);
          } else if (ev.what === 'paid') {
            this.effects.burst(at.clone().setY(at.y + 1.2), { count: 18, speed: 1.2, up: 1.2, life: 1.2, size: 0.05, gravity: 2.2, colors: ['#ffd166', '#f2cf4a', '#fff3c4'] });
            if (ev.owner === this.viewer) this.cue('tradePaid', ev.x, ev.y, 1);
          } else this.cue('tradeLoad', ev.x, ev.y, 0.7);
          break;
        }
        case 'campCleared': {
          // The plunder is taken: a spill of gold sparks and a coin chime.
          if (ev.owner !== this.viewer && !this.sees(ev.x, ev.y)) break;
          const at = this.ground(s, ev.x, ev.y, 0.4);
          this.effects.burst(at, { count: 26, speed: 1.2, up: 1.6, life: 1.6, size: 0.06, gravity: -0.5, colors: ['#ffd166', '#f2cf4a', '#fff3c4'] });
          this.effects.ring(at, '#ffd166', 2.2, 1);
          this.cue('coin', ev.x, ev.y, ev.owner === this.viewer ? 1 : 0.6);
          break;
        }
        case 'ruin': {
          // A find comes up (#64): dust off the spoil, a shimmer rising from the pit.
          if (ev.owner !== this.viewer && !this.sees(ev.x, ev.y)) break;
          const at = this.ground(s, ev.x, ev.y, 0.2);
          this.effects.burst(at, { count: 22, speed: 1.1, up: 0.8, life: 1.6, size: 0.12, grow: 2.5, gravity: -0.1, drag: 0.7, soft: true, colors: ['#b49a78', '#9a8266', '#cdb894'] });
          this.effects.ring(at, '#e8d9a8', 2.5, 1.2);
          this.effects.burst(at.clone().setY(at.y + 0.4), { count: 30, speed: 0.9, up: 1.6, life: 2, size: 0.05, gravity: -0.5, colors: ev.find === 'hoard' ? ['#ffd166', '#f2cf4a', '#fff3c4'] : ev.find === 'map' ? ['#e8dcc0', '#c8b88a', '#fff8e0'] : ev.find === 'lore' ? ['#9ad0ff', '#d8ecff', '#ffffff'] : ['#ffd166', '#fff3c4', '#ffffff'] });
          this.cue('ruinFind', ev.x, ev.y, ev.owner === this.viewer ? 1 : 0.6);
          break;
        }
        case 'landmark': {
          // A landmark changes hands: a ring in the new keeper's colour (or grey dust when it falls to nobody), and a horn.
          const mine = ev.owner === this.viewer || ev.from === this.viewer;
          if (!mine && !this.sees(ev.x, ev.y)) break;
          const at = this.ground(s, ev.x, ev.y, 0.2);
          const color = ev.owner >= 0 ? s.players[ev.owner].color : '#cfc8b8';
          this.effects.ring(at, color, LANDMARKS.reach + 1, 1.4);
          this.effects.burst(at.clone().setY(at.y + 0.6), { count: ev.owner >= 0 ? 26 : 14, speed: 0.8, up: 1.4, life: 1.8, size: 0.06, gravity: -0.3, colors: ev.owner >= 0 ? [color, '#ffffff', '#fff3c4'] : ['#b49a78', '#9a8266'] });
          this.cue(ev.owner >= 0 ? 'landmarkTaken' : 'landmarkLost', ev.x, ev.y, mine ? 1 : 0.6);
          this.onPing?.(ev.x, ev.y, color);
          break;
        }
        case 'relic': {
          if (ev.owner !== this.viewer && !this.sees(ev.x, ev.y)) break;
          const at = this.ground(s, ev.x, ev.y, 0.2);
          if (ev.what === 'kept') {
            this.effects.ring(at, '#ffd166', 3.5, 1.6);
            this.effects.burst(at.clone().setY(at.y + 2.4), { count: 40, speed: 1.6, up: 1, life: 2, size: 0.06, gravity: -0.3, colors: ['#ffd166', '#fff3c4', '#ffffff'] });
            this.cue('relicKeep', ev.x, ev.y, 1);
          } else {
            this.effects.ring(at, '#fff3c4', 1, 0.8);
            this.effects.burst(at.clone().setY(at.y + 0.6), { count: 14, speed: 0.8, up: 1, life: 1.2, size: 0.045, gravity: -0.6, colors: ['#ffd166', '#fff3c4'] });
            if (ev.what === 'taken') this.cue('relicTake', ev.x, ev.y, 0.8);
          }
          break;
        }
        case 'die': {
          if (!ev.building) {
            if (!this.sees(ev.x, ev.y) && ev.owner !== this.viewer) break;
            const type = ev.type as Unit['type'];
            const drawnAt = this.units.drawn.get(ev.id);
            this.units.fall(type, ev.epoch, ev.owner, ev.x, ev.y, ev.fx, ev.fy, ev.id, SIGNATURES[s.players[ev.owner].civ].type === type ? s.players[ev.owner].civ : undefined);
            const dom = domainOf(type);
            if (dom === 'water') {
              // A ship breaks up: spray, splinters, a slick of smoke.
              const at = this.ground(s, ev.x, ev.y, 0.2);
              this.effects.burst(at, { count: 26, speed: 1.4, up: 1, life: 1.3, size: 0.08, grow: 1.5, gravity: 5, drag: 0.4, colors: ['#ffffff', '#dcefff'] });
              this.effects.burst(at, { count: 12, speed: 1.8, up: 0.8, life: 1.4, size: 0.05, gravity: 5, drag: 0.3, colors: ['#6e4f33', '#8a6440'] });
              this.effects.burst(at, { count: 8, speed: 0.4, up: 1, life: 3, size: 0.18, grow: 3, gravity: -0.3, drag: 0.6, soft: true, colors: ['#3a3634', '#55504c'] });
              this.cue('splashWater', ev.x, ev.y, 0.9);
              this.cue('collapse', ev.x, ev.y, 0.5);
            } else if (dom === 'air') {
              // Hit in the air: a puff of fire and smoke; it hits the ground a moment later.
              const up = drawnAt ? drawnAt.clone() : this.ground(s, ev.x, ev.y, AIR_ALT);
              this.effects.burst(up, { count: 14, speed: 1, up: 0.5, life: 1.6, size: 0.14, grow: 3, gravity: -0.2, drag: 0.8, soft: true, colors: ['#2e2a28', '#4a4440'] });
              this.effects.burst(up, { count: 10, speed: 1.4, up: 0.5, life: 0.5, size: 0.07, gravity: 0, colors: ['#ffd27a', '#ff9a3c'] });
              const yaw = Math.atan2(ev.fx, ev.fy);
              const gx = ev.x + Math.sin(yaw) * 1.2;
              const gz = ev.y + Math.cos(yaw) * 1.2;
              this.later.push({
                at: this.time + 1.35,
                run: () => {
                  const at = this.ground(s, gx, gz, 0.2);
                  if (this.wet(s, gx, gz)) {
                    this.effects.burst(at, { count: 20, speed: 1.2, up: 1, life: 1.2, size: 0.08, gravity: 5, drag: 0.4, colors: ['#ffffff', '#dcefff'] });
                    this.cue('splashWater', gx, gz, 0.8);
                  } else {
                    this.effects.burst(at, { count: 18, speed: 1.8, up: 0.8, life: 0.6, size: 0.1, grow: 2, gravity: -1, colors: ['#ffd27a', '#ff9a3c', '#e0471f'] });
                    this.effects.burst(at, { count: 12, speed: 0.8, up: 1, life: 3, size: 0.2, grow: 3, gravity: -0.3, drag: 0.8, soft: true, colors: ['#2e2a28', '#4a4440'] });
                    this.cue('explosion', gx, gz, 0.7);
                  }
                },
              });
              this.cue('impact', ev.x, ev.y, 0.5);
            } else if (type === 'hero') {
              // A hero falls: gold rings over the ground, embers rising, a low toll.
              const at = this.ground(s, ev.x, ev.y, 0.1);
              this.effects.ring(at, '#ffd166', 2.4, 1.4);
              this.effects.ring(at, '#fff3c4', 1.4, 1);
              this.effects.burst(at.clone().setY(at.y + 0.4), { count: 22, speed: 0.9, up: 0.9, life: 2.2, size: 0.06, gravity: -0.4, drag: 0.8, colors: ['#ffd166', '#ffb347', '#fff3c4'] });
              this.effects.burst(at, { count: 6, speed: 0.5, up: 0.4, life: 0.9, size: 0.06, grow: 1.8, gravity: -0.1, drag: 1.5, soft: true, colors: ['#bba98a', '#d6c7aa'] });
              this.cue('fall', ev.x, ev.y, 0.6);
              this.cue('heroFall', ev.x, ev.y, 0.9);
            } else {
              this.effects.burst(this.ground(s, ev.x, ev.y, 0.1), { count: 4, speed: 0.5, up: 0.4, life: 0.8, size: 0.05, grow: 1.8, gravity: -0.1, drag: 1.5, soft: true, colors: ['#bba98a', '#d6c7aa'] });
              this.cue('fall', ev.x, ev.y, 0.6);
            }
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
          const dom = domainOf(ev.type);
          this.cue(dom === 'water' ? 'shipHorn' : dom === 'air' ? 'engine' : ev.type === 'citizen' ? 'readyCitizen' : 'ready', u.x, u.y, 0.9);
          break;
        }
        case 'epoch': {
          const tc = s.ents.find((e) => e.kind === 'building' && e.owner === ev.owner && e.type === 'towncenter');
          if (tc && (ev.owner === this.viewer || this.sees(tc.x, tc.y))) {
            const at = this.ground(s, tc.x, tc.y, 0.2);
            // A step back (#47) glows dusk-blue instead of gold, and its sparks fall rather than rise.
            const c = ev.back ? ['#8fa8d8', '#d8e2f4', '#6a7fb0'] : ['#ffd166', '#fff3c4', '#ffb347'];
            this.effects.ring(at, c[0], 5, 1.6);
            this.effects.ring(at, c[1], 3.5, 1.2);
            this.effects.burst(at.clone().setY(at.y + 1.5), { count: 60, speed: 3, up: ev.back ? 0.2 : 0.9, life: 1.8, size: 0.07, gravity: 2, colors: c });
            // The age-up pulse (wonder): light leaps from the Town Center and a wave crosses the whole town.
            if (!ev.back && ev.owner === this.viewer) {
              this.sightings.raise(at, c[0]);
              [[10, 1.4], [18, 2.2], [28, 3]].forEach(([size, life], i) => this.effects.ring(at.clone().setY(at.y + 0.1 + i * 0.01), c[i], size, life));
            }
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
            const bog = s.res[tile] === R_BOG;
            this.effects.burst(at, { count: 3, speed: 1.0, up: 0.7, life: 0.5, size: 0.025, gravity: 4, colors: gold ? ['#ffd24a', '#f2b830'] : bog ? ['#b8642a', '#6a4a2a'] : ['#c8c3b8', '#9a948a'] });
            this.cue('mine', ev.x, ev.y, s.res[tile] === R_STONE || gold || bog ? 0.35 : 0.2);
          } else if (ev.act === 'build') {
            this.effects.burst(at, { count: 2, speed: 0.6, up: 0.6, life: 0.6, size: 0.05, grow: 2, gravity: 0, drag: 1.4, soft: true, colors: ['#c9b79c'] });
            this.cue('hammer', ev.x, ev.y, 0.35);
          } else if (ev.act === 'fish') {
            const w = new THREE.Vector3(ev.x, WATER_Y + 0.05, ev.y);
            this.effects.burst(w, { count: 4, speed: 0.6, up: 1, life: 0.6, size: 0.03, gravity: 4, colors: ['#ffffff', '#b8dcf0', '#c0c8cc'] });
          } else if (ev.act === 'forage' || ev.act === 'farm') this.cue('rustle', ev.x, ev.y, 0.18);
          else if (ev.act === 'chant') {
            this.cue('chant', ev.x, ev.y, 0.5);
            this.effects.burst(at.clone().setY(at.y + 0.5), { count: 4, speed: 0.4, up: 1, life: 1.2, size: 0.04, gravity: -0.6, colors: ['#fff3c4', '#ffd166'] });
          }
          break;
        }
        case 'regrown':
        case 'depleted':
        case 'spawned':
          this.resources.markDirty();
          break;
        case 'deliver':
          if (ev.owner === this.viewer) this.resources.markDirty();
          break;
        case 'rank':
          this.cue('rankUp', ev.x, ev.y, 0.5);
          this.effects.burst(this.ground(s, ev.x, ev.y, 1.2), { count: 6, speed: 0.5, up: 1, life: 0.9, size: 0.05, gravity: -0.5, colors: ['#fff3c4', '#ffd24d'] });
          if (ev.owner === this.viewer) this.onPing?.(ev.x, ev.y, '#ffd24d');
          break;
        case 'plunder': {
          // Spoils from the fallen (#299): a spatter of crimson and a few gold coins, and a clink for the taker.
          if (ev.owner !== this.viewer && !this.sees(ev.x, ev.y)) break;
          this.effects.burst(this.ground(s, ev.x, ev.y, 0.8), { count: 8, speed: 0.8, up: 1.1, life: 1, size: 0.05, gravity: 2, colors: ['#ffd166', '#9b1c2c', '#f2cf4a'] });
          if (ev.owner === this.viewer) this.cue('tradePaid', ev.x, ev.y, 0.4);
          break;
        }
        case 'stow': {
          // A Sea-Raider's pack handed into a ship's hold (#585): a few coins tossed toward the water, a soft clink for its people.
          if (ev.owner !== this.viewer && !this.sees(ev.x, ev.y)) break;
          this.effects.burst(this.ground(s, ev.x, ev.y, 0.9), { count: 5, speed: 0.6, up: 1.4, life: 0.8, size: 0.045, gravity: 2.4, colors: ['#ffd166', '#f2cf4a', '#7fb3c9'] });
          if (ev.owner === this.viewer) this.cue('tradePaid', ev.x, ev.y, 0.25);
          break;
        }
        case 'thrall': {
          // A rival citizen taken captive (#502): dust and a flash of rope where the thrall rises.
          if (ev.owner !== this.viewer && ev.from !== this.viewer && !this.sees(ev.x, ev.y)) break;
          this.effects.burst(this.ground(s, ev.x, ev.y, 0.6), { count: 6, speed: 0.5, up: 0.8, life: 0.8, size: 0.05, gravity: 1.5, colors: ['#8a6a3a', '#c9b48a'] });
          this.cue('thrall', ev.x, ev.y, 0.5);
          break;
        }
        case 'tribute': {
          // Tribute (#318): a glint of gold over each rider taking it, and now and then a clink in the taker's saddlebag.
          for (const id of ev.ids) {
            const u = s.byId.get(id);
            if (!u || (ev.owner !== this.viewer && !this.sees(u.x, u.y))) continue;
            this.effects.burst(this.ground(s, u.x, u.y, 1.5), { count: 3, speed: 0.3, up: 0.8, life: 0.8, size: 0.045, gravity: 1.2, colors: ['#ffd166', '#f2cf4a', '#fff3c4'] });
            // A nomad's tribute (#501) is paid in cut stone too: grey chips with the gold.
            if (ev.stone) this.effects.burst(this.ground(s, u.x, u.y, 1.4), { count: 2, speed: 0.25, up: 0.6, life: 0.7, size: 0.05, gravity: 1.6, colors: ['#b8b2a6', '#8f8a80'] });
          }
          if (ev.owner === this.viewer && (s.tick - this.tributeCue > TICK_HZ * 6 || s.tick < this.tributeCue)) {
            this.tributeCue = s.tick;
            this.cue('tribute', ev.x, ev.y, 0.35);
          }
          break;
        }
        case 'tax': {
          // The household tax (#501): coins rise from each paying house of the viewer's, and one soft chime.
          if (ev.owner !== this.viewer) break;
          let first: Ent | undefined;
          for (const id of ev.ids.slice(0, 12)) {
            const b = s.byId.get(id);
            if (!b || b.kind !== 'building') continue;
            first ??= b;
            this.effects.burst(this.ground(s, b.x, b.y, 1.2), { count: 3, speed: 0.4, up: 1.0, life: 0.9, size: 0.045, gravity: 1.2, colors: ['#ffd166', '#f2cf4a', '#c9382e'] });
          }
          if (first) this.cue('coin', first.x, first.y, 0.25);
          break;
        }
        case 'toll': {
          // Safe passage (#334): coins spill from the rival trader's load, and the taker hears them counted.
          if (ev.owner !== this.viewer && ev.from !== this.viewer && !this.sees(ev.x, ev.y)) break;
          this.effects.burst(this.ground(s, ev.x, ev.y, 1.0), { count: 7, speed: 0.6, up: 1.1, life: 0.9, size: 0.05, gravity: 2, colors: ['#ffd166', '#f2cf4a', '#3f8f9a'] });
          if (ev.owner === this.viewer) this.cue('toll', ev.x, ev.y, 0.4);
          break;
        }
        case 'blood': {
          // Blood drawn (#355): a dark red spray where the drawn fell, or at the rig for a levy.
          if (ev.owner !== this.viewer && !this.sees(ev.x, ev.y)) break;
          if (ev.how === 'flock' || ev.how === 'captive') {
            // A bled flock, or the captives held at a rig (#355): the same thin mist, quieter, and no sound of its own.
            this.effects.burst(this.ground(s, ev.x, ev.y, 0.6), { count: 2, speed: 0.2, up: 1.3, life: 0.6, size: 0.035, gravity: -0.6, colors: ['#5a0e18', '#8a1a2a'] });
            break;
          }
          if (ev.how === 'drain') {
            // Hemocraft's drain (#355 s2): a thin dark mist drawn up off each bled body, and every third second a low suck at the nearest.
            this.effects.burst(this.ground(s, ev.x, ev.y, 0.8), { count: 3, speed: 0.25, up: 1.6, life: 0.7, size: 0.04, gravity: -0.6, colors: ['#5a0e18', '#8a1a2a'] });
            if (s.tick % (TICK_HZ * 3) === 0) this.cue('drain', ev.x, ev.y, 0.3);
            break;
          }
          this.effects.burst(this.ground(s, ev.x, ev.y, 0.5), { count: 9, speed: 0.6, up: 1.0, life: 0.8, size: 0.05, gravity: 2.2, colors: ['#7a1822', '#4a0e16', '#a3283a'] });
          break;
        }
        case 'captive': {
          // A captive (#355): iron-dark sparks where one is taken into a rig, a pale burst where the freed step out.
          if (ev.owner !== this.viewer && ev.from !== this.viewer && !this.sees(ev.x, ev.y)) break;
          if (ev.what === 'spent') break;
          const freed = ev.what === 'freed';
          this.effects.burst(this.ground(s, ev.x, ev.y, 0.6), { count: freed ? 14 : 10, speed: freed ? 0.9 : 0.5, up: freed ? 1.6 : 0.9, life: 0.9, size: 0.05, gravity: freed ? 0.6 : 2, colors: freed ? ['#f2e6c8', '#d9c89a', '#ffffff'] : ['#3a3a40', '#5a1018', '#22222a'] });
          this.cue(freed ? 'unshackle' : 'shackle', ev.x, ev.y, 0.6);
          break;
        }
        case 'rite': {
          // A Blood-rite priest's rite finished (#355 s4): a red column rising off the sacrificed, or a violet-black swirl over the cursed.
          if (ev.owner !== this.viewer && ev.against !== this.viewer && !this.sees(ev.x, ev.y)) break;
          if (ev.how === 'sacrifice') {
            this.effects.burst(this.ground(s, ev.x, ev.y, 0.5), { count: 28, speed: 0.5, up: 2.4, life: 1.4, size: 0.07, gravity: -0.4, colors: ['#7a1822', '#a3283a', '#2a0610'] });
            this.cue('sacrifice', ev.x, ev.y, 0.9);
          } else {
            this.effects.burst(this.ground(s, ev.x, ev.y, 0.6), { count: 34, speed: 1.2, up: 0.8, life: 1.2, size: 0.06, gravity: -0.2, colors: ['#3a1450', '#5a1f7a', '#14061c'] });
            this.cue('curse', ev.x, ev.y, 0.9);
          }
          break;
        }
        case 'graft': {
          // A soldier grafted (#355 s3): a dark spray and a steel-grey hiss at the Station; a graft run dry: a pale gout where it stands.
          if (ev.owner !== this.viewer && !this.sees(ev.x, ev.y)) break;
          const crash = ev.how === 'crash';
          this.effects.burst(this.ground(s, ev.x, ev.y, crash ? 0.6 : 1.2), { count: crash ? 7 : 12, speed: crash ? 0.5 : 0.9, up: 1.2, life: 0.9, size: 0.05, gravity: 2.4, colors: crash ? ['#c9b8b0', '#7a1822', '#3a3134'] : ['#7a1822', '#b0182c', '#c9d4d6'] });
          break;
        }
        case 'callUp': {
          // The call to arms (#313): dust kicked up and a flash of crimson where each new soldier stands.
          for (const id of ev.ids) {
            const u = s.byId.get(id);
            if (!u || (ev.owner !== this.viewer && !this.sees(u.x, u.y))) continue;
            this.effects.burst(this.ground(s, u.x, u.y, 0.4), { count: 10, speed: 0.7, up: 1.2, life: 0.9, size: 0.05, gravity: 2.5, colors: ['#9b1c2c', '#c9b48a', '#6e0f1c', '#e8dcc0'] });
          }
          break;
        }
        case 'alert':
          if (ev.owner === this.viewer) this.onPing?.(ev.x, ev.y, ev.heart ? '#ff9f1c' : '#ff4d4d', !!ev.heart);
          break;
      }
    }
    // Trees felled and bushes picked show on the next layout pass.
    if (list.some((e) => e.k === 'work' && (e.act === 'chop' || e.act === 'forage' || e.act === 'mine'))) this.resources.markDirty();
  }

  /** A world point on the ground (or the water) at a map position, lifted a little. */
  private ground(s: GameState, x: number, y: number, lift: number): THREE.Vector3 {
    return new THREE.Vector3(x, Math.max(WATER_Y, heightAt(s, x, y)) + lift, y);
  }

  /** Whether open water lies within a few tiles of the view's centre (a coast, a lake, the sea). */
  private nearWater(s: GameState): boolean {
    return nearWater(s, this.rig.target.x, this.rig.target.z, this.rig.distance);
  }

  /** Whether a column of soldiers (five or more, seen) marches near the view's centre: the small creatures hush. */
  private armyNear(s: GameState): boolean {
    return armyNear(s, this.rig.target.x, this.rig.target.z, this.visibleUnit);
  }

  /** Whether a map point is open water. */
  private wet(s: GameState, x: number, y: number): boolean {
    return wet(s, x, y);
  }

  /** Whether a creature's voice belongs where the view looks now. */
  private voiceHere(s: GameState | null, voice: CreatureVoice): boolean {
    if (!s) return false;
    const water = this.nearWater(s);
    // The wrong side of the shore whatever marches by: skip counting soldiers.
    const sn = this.currentSeason();
    if (!voiceFits(voice, water, false, sn)) return false;
    return voiceFits(voice, water, this.armyNear(s), sn);
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
    for (const r of this.relics.screen) {
      const d = Math.hypot(r.sx - px, r.sy - py);
      if (d < r.r * 1.3 && d < bestD) {
        bestD = d;
        best = r.id;
      }
    }
    if (best !== null) return { kind: 'relic', id: best };
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
      // A trading post's plaza, once seen.
      for (const post of s.posts) {
        if (Math.abs(g.x - post.x) <= TRADE.plaza + 0.6 && Math.abs(g.y - post.y) <= TRADE.plaza + 0.6 && (this.reveal || s.players[this.viewer].seen[tile])) return { kind: 'post', id: post.id };
      }
      // A contested landmark, once seen.
      for (const m of s.landmarks ?? []) {
        if (Math.abs(g.x - m.x) <= 1.6 && Math.abs(g.y - m.y) <= 1.6 && (this.reveal || s.players[this.viewer].seen[tile])) return { kind: 'landmark', id: m.id };
      }
      // An ancient ruin (#64), once seen.
      for (const r of s.ruins ?? []) {
        if (Math.abs(g.x - r.x) <= RUINS.reach && Math.abs(g.y - r.y) <= RUINS.reach && (this.reveal || s.players[this.viewer].seen[tile])) return { kind: 'ruin', id: r.id };
      }
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

/** The colors of each people's great work as it runs (render only). */
const WORK_GLOW: Record<CivId, string[]> = {
  egyptians: ['#4fc3d9', '#9be7f2', '#ffd166'],
  greeks: ['#e8edf2', '#7fa6d6', '#ffffff'],
  romans: ['#c0392b', '#ffd166', '#f4e3c1'],
  mongols: ['#8fd36a', '#e8e0b0', '#ffffff'],
  chinese: ['#e84a3c', '#ffd166', '#4fd1a5'],
  britons: ['#3a6fd0', '#e8e8e8', '#d0443a'],
};

/**
 * What a side age (#55) adds to the air over its buildings: black smithy smoke and sparks in the Iron
 * Age, incense over a pilgrims' Temple, paper confetti over a fair's Market. Returns whether it drew.
 */
function sideAgeAmbient(fx: Effects, age: AgeId, e: Ent, base: number): boolean {
  if (e.kind !== 'building') return false;
  if (age === 'iron' && (e.type === 'forge' || e.type === 'towncenter' || e.type === 'house')) {
    const at = new THREE.Vector3(e.x + (e.type === 'forge' ? 0.95 : 0.4), base + (e.type === 'house' ? 1.6 : e.type === 'forge' ? 2.2 : 2.4), e.y - 0.5);
    fx.burst(at, { count: 1, speed: 0.15, up: 1, life: 2.8, size: 0.09, grow: 4, gravity: -0.2, drag: 0.3, soft: true, colors: ['#3a3634', '#55504c'] });
    if (e.type === 'forge') fx.burst(at, { count: 2, speed: 0.6, up: 1, life: 0.6, size: 0.025, gravity: -0.5, colors: ['#ffb24a', '#ff7a2a'] });
    return true;
  }
  if (age === 'pilgrim' && e.type === 'temple') {
    fx.burst(new THREE.Vector3(e.x, base + 2.7, e.y), { count: 1, speed: 0.08, up: 1, life: 3.4, size: 0.07, grow: 3, gravity: -0.1, drag: 0.4, soft: true, colors: ['#efe9d6', '#fff6dc'] });
    return true;
  }
  if (age === 'sail' && e.type === 'dock') {
    fx.burst(new THREE.Vector3(e.x + 0.4, base + 0.3, e.y + 1.7), { count: 1, speed: 0.25, up: 0.4, life: 1.3, size: 0.05, grow: 2, gravity: -0.1, drag: 0.5, soft: true, colors: ['#ffffff', '#cfe9ef'] });
    return true;
  }
  if (age === 'fair' && e.type === 'market') {
    fx.burst(new THREE.Vector3(e.x, base + 2.0, e.y), { count: 2, speed: 0.5, up: 1, life: 1.6, size: 0.04, gravity: 0.5, colors: ['#d94a3c', '#e8b43a', '#3f8fc4', '#f4efe4'] });
    return true;
  }
  return false;
}
