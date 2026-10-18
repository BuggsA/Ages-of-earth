import * as THREE from 'three';
import { ROT, TICK_HZ } from '../sim/data';
import type { GameState } from '../sim/types';
import { heightAt } from './terrain';

/**
 * Carrion crows: by day a few black crows wheel over each carcass that has begun to turn (past `ROT.grace`)
 * and land and hop about it once it is mostly gone, a tell you can read from the camera that meat is spoiling and
 * that wolves may come. Render only: nothing in the rules sees them.
 */

const SITES = 8;
const PER = 5;

const vertex = /* glsl */ `
  attribute vec4 aSeed;
  attribute vec3 aSite;
  attribute float aPerch;
  uniform float uTime;
  uniform float uScale;
  varying float vAlpha;
  varying float vFlap;
  void main() {
    vec3 s = aSeed.xyz;
    float t = uTime * (0.7 + aSeed.w * 0.3);
    // A slow ring above the kill, each crow on its own radius, height and direction.
    float a = t * (0.45 + s.x * 0.3) * (s.y > 0.5 ? 1.0 : -1.0) + s.z * 6.283;
    float r = 1.2 + s.y * 1.4 + 0.4 * sin(t * 0.3 + s.z * 20.0);
    float h = 2.0 + s.x * 1.6 + sin(t * 0.9 + s.z * 30.0) * 0.4;
    // Once the meat is nearly gone they drop to the ground and hop about it.
    float pr = 0.35 + s.y * 0.7;
    vec3 ground = vec3(cos(s.z * 6.283) * pr, 0.08 + max(0.0, sin(uTime * (2.0 + s.x * 2.0) + s.z * 50.0)) * 0.12 * step(0.8, fract(s.x * 7.0 + uTime * 0.15)), sin(s.z * 6.283) * pr);
    vec3 p = aSite + mix(vec3(cos(a) * r, h, sin(a) * r), ground, aPerch);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uScale * 0.8 / max(0.5, -mv.z), 6.0, 40.0);
    vAlpha = aSite.y < -500.0 ? 0.0 : 1.0;
    vFlap = mix(sin(uTime * (7.0 + aSeed.w * 3.0) + s.x * 60.0), -0.6, aPerch);
  }
`;

const fragment = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  varying float vFlap;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    // A black chevron that beats, with a dark body at its heart.
    float arm = abs(p.x);
    float line = abs(p.y - arm * (0.2 + 0.5 * vFlap) * 0.6);
    float wing = (1.0 - smoothstep(0.04, 0.09, line)) * step(arm, 0.46);
    float body = 1.0 - smoothstep(0.05, 0.09, length(p * vec2(1.6, 0.9)));
    float a = max(wing, body);
    if (a < 0.05) discard;
    gl_FragColor = vec4(vec3(0.05, 0.05, 0.07), a * vAlpha * uOpacity);
  }
`;

/** A spoiling carcass on the ground; `perch` is 0 while crows circle and 1 once the meat is nearly gone and they have landed. */
export class Site extends THREE.Vector3 {
  perch = 0;
}

/** The tiles of carcasses that have begun to turn and are in sight, as world positions on the ground. */
export function spoilingSites(s: GameState, sees: (x: number, y: number) => boolean): Site[] {
  const out: Site[] = [];
  for (const c of s.carcasses ?? []) {
    if (s.tick - c.born < ROT.grace * TICK_HZ) continue;
    const x = (c.tile % s.w) + 0.5;
    const y = Math.floor(c.tile / s.w) + 0.5;
    if (s.amount[c.tile] > 0 && sees(x, y)) {
      const site = new Site(x, heightAt(s, x, y), y);
      site.perch = Math.max(0, Math.min(1, (0.4 - s.amount[c.tile] / Math.max(1, c.full)) / 0.15));
      out.push(site);
    }
  }
  return out;
}

export class Crows {
  readonly points: THREE.Points;
  private u: Record<string, THREE.IUniform>;
  private site: THREE.BufferAttribute;
  private perch: THREE.BufferAttribute;
  /** The spoiling carcass nearest the camera while crows are drawn, for their calls; else null. */
  nearest: THREE.Vector3 | null = null;

  constructor() {
    const seed = new Float32Array(SITES * PER * 4);
    for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SITES * PER * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.site = new THREE.BufferAttribute(new Float32Array(SITES * PER * 3).fill(-1000), 3);
    g.setAttribute('aSite', this.site);
    this.perch = new THREE.BufferAttribute(new Float32Array(SITES * PER), 1);
    g.setAttribute('aPerch', this.perch);
    this.u = { uTime: { value: 0 }, uScale: { value: 600 }, uOpacity: { value: 0 } };
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: this.u, transparent: true, depthWrite: false, fog: false }),
    );
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  /** Crows keep to the day: the light of the clear-day level from the view. */
  setDay(level: number): void {
    this.u.uOpacity.value = Math.max(0, Math.min(1, level));
  }

  /** The nearest `SITES` spoiling carcasses to the camera draw crows. */
  update(time: number, sites: readonly Site[], target: THREE.Vector3, pixelRatio: number, viewHeight: number, on: boolean): void {
    this.points.visible = on && sites.length > 0 && (this.u.uOpacity.value as number) > 0.05;
    this.nearest = null;
    if (!this.points.visible) return;
    this.u.uTime.value = time;
    this.u.uScale.value = viewHeight * pixelRatio;
    const near = [...sites].sort((a, b) => a.distanceToSquared(target) - b.distanceToSquared(target)).slice(0, SITES);
    const a = this.site.array as Float32Array;
    for (let i = 0; i < SITES; i++) {
      const r = near[i];
      for (let j = 0; j < PER; j++) {
        const k = (i * PER + j) * 3;
        a[k] = r ? r.x : 0;
        a[k + 1] = r ? r.y : -1000;
        a[k + 2] = r ? r.z : 0;
      }
    }
    this.nearest = near[0] ?? null;
    const pa = this.perch.array as Float32Array;
    for (let i = 0; i < SITES; i++) for (let j = 0; j < PER; j++) pa[i * PER + j] = near[i]?.perch ?? 0;
    this.site.needsUpdate = true;
    this.perch.needsUpdate = true;
  }
}
