import * as THREE from 'three';
import type { MapType } from '../sim/types';

/**
 * Weather: the sky a match is played under. It is chosen from the match's seed and map type, so every
 * player of an online room, a saved game and a replay sees the same one. It changes how the land looks
 * and sounds (rain streaks, drifting snow, mist that closes the horizon, now and then lightning) and
 * nothing in the rules: units see and shoot exactly as far as they would on a clear day.
 */

export type WeatherKind = 'clear' | 'rain' | 'snow' | 'mist';

export interface WeatherDay {
  kind: WeatherKind;
  /** How heavy it is, 0.5 (light) to 1 (a storm). 0 for a clear day. */
  strength: number;
}

/** Odds out of 100 for clear, rain, snow and mist, by kind of land. */
const ODDS: Record<MapType, [number, number, number, number]> = {
  continental: [55, 20, 10, 15],
  highlands: [30, 10, 35, 25],
  lakes: [40, 25, 5, 30],
  forest: [30, 40, 5, 25],
  plains: [70, 15, 10, 5],
  sea: [45, 25, 5, 25],
};

const KINDS: WeatherKind[] = ['clear', 'rain', 'snow', 'mist'];

/** A small integer hash, so near seeds give unrelated days. */
function mix(n: number): number {
  let h = (n | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** The day's weather for a match. The same seed and land always give the same day. */
export function weatherFor(seed: number, mapType: MapType): WeatherDay {
  const roll = mix(seed + 77) % 100;
  const odds = ODDS[mapType];
  let acc = 0;
  let kind: WeatherKind = 'clear';
  for (let i = 0; i < 4; i++) {
    acc += odds[i];
    if (roll < acc) {
      kind = KINDS[i];
      break;
    }
  }
  if (kind === 'clear') return { kind, strength: 0 };
  return { kind, strength: 0.5 + (mix(seed + 191) % 51) / 100 };
}

/**
 * The day's sky in a season (0 spring .. 3 winter): the year's turn decides what falls. Snow comes only in
 * winter, so a seeded snow day is rain in spring and autumn and a thin mist in summer; winter rain falls as
 * snow (a winter storm is a blizzard, without lightning). Mist and clear days are the same all year.
 */
export function seasonalDay(day: WeatherDay, season: number): WeatherDay {
  if (season === 3 && day.kind === 'rain') return { kind: 'snow', strength: day.strength };
  if (season !== 3 && day.kind === 'snow') {
    return season === 1 ? { kind: 'mist', strength: day.strength * 0.5 } : { kind: 'rain', strength: day.strength * 0.8 };
  }
  return day;
}

/** Which way the air moves, and how fast (tiles a second) once smoke has caught it. */
export interface Wind {
  x: number;
  z: number;
}

/** Eight directions, as unit steps, so no trigonometry is needed. */
const COMPASS: [number, number][] = [
  [1, 0],
  [0.7071, 0.7071],
  [0, 1],
  [-0.7071, 0.7071],
  [-1, 0],
  [-0.7071, -0.7071],
  [0, -1],
  [0.7071, -0.7071],
];

/** The day's wind: a direction from the seed, a speed from the seed and the weather (a storm blows hardest). */
export function windFor(seed: number, day: WeatherDay): Wind {
  const [dx, dz] = COMPASS[mix(seed + 313) % 8];
  const base = 0.15 + (mix(seed + 509) % 31) / 100;
  const speed = base + (day.kind === 'rain' ? 0.35 * day.strength : day.kind === 'mist' ? -0.1 : day.kind === 'snow' ? 0.1 * day.strength : 0);
  const v = Math.max(0.08, speed);
  return { x: dx * v, z: dz * v };
}

/** `?weather=rain` (or snow, mist, clear) in the address forces a day, for trying them out. */
export function forcedWeather(): WeatherDay | null {
  if (typeof location === 'undefined') return null;
  const k = new URLSearchParams(location.search).get('weather');
  if (k !== 'rain' && k !== 'snow' && k !== 'mist' && k !== 'clear') return null;
  return { kind: k, strength: k === 'clear' ? 0 : 0.9 };
}

/** Minutes a mist takes to thin out and thicken again. */
const MIST_PERIOD = 8;
/** How much of its strength a mist keeps at its thinnest. */
const MIST_THIN = 0.3;

/**
 * A mist breathes: it starts the match at full strength, thins to `MIST_THIN` of it half a period on and thickens again, so a misty
 * day is no wall that never lifts. Other days are the same all match. Strength is rounded to 0.05, so the sky is redrawn rarely.
 */
export function breathe(day: WeatherDay, minutes: number): WeatherDay {
  if (day.kind !== 'mist') return day;
  const phase = (minutes / MIST_PERIOD) % 1;
  const t = Math.abs(phase * 2 - 1);
  const f = MIST_THIN + (1 - MIST_THIN) * t * t * (3 - 2 * t);
  return { kind: 'mist', strength: Math.round(day.strength * f * 20) / 20 };
}

/** What a day does to the light: how far the sky greys, the sun dims, the horizon closes in. */
export interface Mood {
  /** 0 (blue sky) to 1 (flat grey). */
  grey: number;
  /** Multiplies the sun's light. */
  sun: number;
  /** Multiplies the sky light. */
  sky: number;
  /** Multiplies how far the view reaches before the haze. */
  reach: number;
  /** The colour the sky greys towards. */
  tint: string;
}

export function moodOf(day: WeatherDay): Mood {
  const k = day.strength;
  switch (day.kind) {
    case 'rain':
      return { grey: 0.55 + 0.3 * k, sun: 0.55 - 0.25 * k, sky: 0.85 - 0.2 * k, reach: 0.8 - 0.3 * k, tint: '#6d7782' };
    case 'snow':
      return { grey: 0.5 + 0.25 * k, sun: 0.65 - 0.2 * k, sky: 0.95, reach: 0.75 - 0.3 * k, tint: '#b9c4cf' };
    case 'mist':
      return { grey: 0.45 + 0.3 * k, sun: 0.7 - 0.2 * k, sky: 0.95, reach: 0.7 - 0.25 * k, tint: '#cfd8dc' };
    default:
      return { grey: 0, sun: 1, sky: 1, reach: 1, tint: '#ffffff' };
  }
}

/** The words for the opening banner. */
export function describeWeather(day: WeatherDay): string {
  const heavy = day.strength > 0.8;
  switch (day.kind) {
    case 'rain':
      return heavy ? 'A storm rolls over the land.' : 'Rain falls on the land.';
    case 'snow':
      return heavy ? 'Heavy snow is falling.' : 'Snow drifts down.';
    case 'mist':
      return heavy ? 'A thick mist lies on the land.' : 'Mist lies over the land.';
    default:
      return '';
  }
}

/** Seconds between lightning strikes in a storm, from a counter, so they don't fall at a steady beat. */
export function stormGap(n: number): number {
  return 12 + (mix(n * 31 + 5) % 2800) / 100;
}

const RAIN_COUNT = 2600;
const SNOW_COUNT = 2000;
/** How many times a smoke wind's speed the falling rain and snow are blown. */
const RAIN_LEAN = 7;
const SNOW_LEAN = 3;

const rainVertex = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform vec3 uCenter;
  uniform vec2 uBox;
  uniform float uFall;
  uniform vec2 uWind;
  uniform float uLen;
  varying float vAlpha;
  void main() {
    vec3 s = aSeed.xyz;
    float t = uTime * uFall / uBox.y;
    vec2 wrapped = fract(s.xz - uCenter.xz / uBox.x + uWind * uTime / uBox.x);
    float h = fract(s.y - t);
    vec3 p = vec3(uCenter.x + (wrapped.x - 0.5) * uBox.x, uCenter.y + h * uBox.y, uCenter.z + (wrapped.y - 0.5) * uBox.x);
    // The lower end of the streak is the head; the upper end trails back along the fall.
    p += aSeed.w * vec3(-uWind.x, uFall, -uWind.y) * uLen;
    float edge = min(1.0 - abs(wrapped.x * 2.0 - 1.0), 1.0 - abs(wrapped.y * 2.0 - 1.0));
    vAlpha = smoothstep(0.0, 0.25, edge) * smoothstep(0.0, 0.1, h) * smoothstep(1.0, 0.8, h) * (1.0 - aSeed.w * 0.7);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const rainFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(uColor, vAlpha * uOpacity);
  }
`;

const snowVertex = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform vec3 uCenter;
  uniform vec2 uBox;
  uniform float uFall;
  uniform vec2 uWind;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vec3 s = aSeed.xyz;
    vec2 wrapped = fract(s.xz - uCenter.xz / uBox.x + uWind * uTime / uBox.x);
    float h = fract(s.y - uTime * uFall * (0.6 + aSeed.w * 0.8) / uBox.y);
    float sway = uTime * (0.5 + aSeed.w) + s.x * 40.0;
    vec3 p = vec3(uCenter.x + (wrapped.x - 0.5) * uBox.x + sin(sway) * 0.5, uCenter.y + h * uBox.y, uCenter.z + (wrapped.y - 0.5) * uBox.x + cos(sway * 0.8) * 0.5);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uScale * (0.13 + aSeed.w * 0.12) / max(0.5, -mv.z), 2.0, 22.0);
    float edge = min(1.0 - abs(wrapped.x * 2.0 - 1.0), 1.0 - abs(wrapped.y * 2.0 - 1.0));
    vAlpha = smoothstep(0.0, 0.25, edge) * smoothstep(0.0, 0.1, h) * smoothstep(1.0, 0.85, h);
  }
`;

const snowFragment = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha * uOpacity * (1.0 - d * 1.4));
  }
`;

/** Falling rain or snow in a box that follows the camera, and the flashes of a storm. */
export class Weather {
  readonly group = new THREE.Group();
  private rain: THREE.LineSegments;
  private snow: THREE.Points;
  private rainU: Record<string, THREE.IUniform>;
  private snowU: Record<string, THREE.IUniform>;
  day: WeatherDay = { kind: 'clear', strength: 0 };
  /** Seconds until the next lightning; negative when there's none to come. */
  private bolt = -1;
  private bolts = 0;
  /** A flash in progress: seconds since it began, or -1. */
  private flashAge = -1;

  constructor() {
    const rainSeed = new Float32Array(RAIN_COUNT * 2 * 4);
    const rainPos = new Float32Array(RAIN_COUNT * 2 * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      const a = Math.random(), b = Math.random(), c = Math.random();
      for (let end = 0; end < 2; end++) rainSeed.set([a, b, c, end], (i * 2 + end) * 4);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    rg.setAttribute('aSeed', new THREE.BufferAttribute(rainSeed, 4));
    this.rainU = {
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector2(30, 24) },
      uFall: { value: 26 },
      uWind: { value: new THREE.Vector2(4, 1.5) },
      uLen: { value: 0.045 },
      uColor: { value: new THREE.Color('#c4d8ea') },
      uOpacity: { value: 0.4 },
    };
    this.rain = new THREE.LineSegments(
      rg,
      new THREE.ShaderMaterial({ vertexShader: rainVertex, fragmentShader: rainFragment, uniforms: this.rainU, transparent: true, depthWrite: false, fog: false }),
    );
    this.rain.frustumCulled = false;

    const snowSeed = new Float32Array(SNOW_COUNT * 4);
    for (let i = 0; i < snowSeed.length; i++) snowSeed[i] = Math.random();
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SNOW_COUNT * 3), 3));
    sg.setAttribute('aSeed', new THREE.BufferAttribute(snowSeed, 4));
    this.snowU = {
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector2(30, 24) },
      uFall: { value: 2.2 },
      uWind: { value: new THREE.Vector2(0.6, 0.2) },
      uScale: { value: 600 },
      uOpacity: { value: 0.85 },
    };
    this.snow = new THREE.Points(
      sg,
      new THREE.ShaderMaterial({ vertexShader: snowVertex, fragmentShader: snowFragment, uniforms: this.snowU, transparent: true, depthWrite: false, fog: false }),
    );
    this.snow.frustumCulled = false;
    this.group.add(this.rain, this.snow);
    this.set({ kind: 'clear', strength: 0 });
  }

  /**
   * Lean the falling rain and snow into the day's wind (tiles a second, as `windFor` gives it).
   * Rain is quick and slants hard; snow, which floats, drifts gently.
   */
  setWind(x: number, z: number): void {
    (this.rainU.uWind.value as THREE.Vector2).set(x * RAIN_LEAN, z * RAIN_LEAN);
    (this.snowU.uWind.value as THREE.Vector2).set(x * SNOW_LEAN, z * SNOW_LEAN);
  }

  /** Begin a new day. */
  set(day: WeatherDay): void {
    this.day = day;
    this.rain.visible = day.kind === 'rain';
    this.snow.visible = day.kind === 'snow';
    this.rain.geometry.setDrawRange(0, Math.floor(RAIN_COUNT * (0.35 + 0.65 * day.strength)) * 2);
    this.snow.geometry.setDrawRange(0, Math.floor(SNOW_COUNT * (0.35 + 0.65 * day.strength)));
    this.bolts = 0;
    this.flashAge = -1;
    this.bolt = day.kind === 'rain' && day.strength > 0.8 ? 6 + stormGap(0) * 0.5 : -1;
  }

  /** Whether particles are drawn at all (off on Low quality). */
  show(on: boolean): void {
    this.group.visible = on;
  }

  /**
   * Move the falling box to the camera's target. Returns the light a flash adds (0 when none), and
   * `thunder` set to how many seconds until the clap, when lightning has just struck.
   */
  update(time: number, dt: number, target: THREE.Vector3, distance: number, pixelRatio: number, viewHeight: number): { flash: number; thunder: number } {
    const box = 22 + distance * 1.1;
    const high = 14 + distance * 0.5;
    const base = target.y - 1;
    const centre = new THREE.Vector3(target.x, base, target.z);
    for (const u of [this.rainU, this.snowU]) {
      u.uTime.value = time;
      (u.uCenter.value as THREE.Vector3).copy(centre);
      (u.uBox.value as THREE.Vector2).set(box, high);
    }
    this.snowU.uScale.value = viewHeight * pixelRatio;
    this.rainU.uLen.value = 0.04 + distance * 0.0015;

    let flash = 0;
    let thunder = -1;
    if (this.bolt >= 0) {
      this.bolt -= dt;
      if (this.bolt < 0) {
        this.flashAge = 0;
        thunder = 0.4 + (mix(this.bolts * 17 + 3) % 220) / 100;
        this.bolts++;
        this.bolt = stormGap(this.bolts);
      }
    }
    if (this.flashAge >= 0) {
      this.flashAge += dt;
      // Two quick beats: a strike and its echo.
      const a = this.flashAge;
      flash = Math.max(0, 1 - a / 0.14) + 0.6 * Math.max(0, 1 - Math.abs(a - 0.22) / 0.1);
      if (a > 0.4) this.flashAge = -1;
    }
    return { flash, thunder };
  }
}
