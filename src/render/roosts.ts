import * as THREE from 'three';
import { batFragment } from './bats';

/**
 * Bat roosts: at dusk and dawn a small cloud of bats wheels around each ruin still standing that the
 * viewer has seen, a few streaming out over the grass. Render only: nothing in the rules sees them.
 */

const SITES = 10;
const PER = 7;

const vertex = /* glsl */ `
  attribute vec4 aSeed;
  attribute vec3 aSite;
  uniform float uTime;
  uniform float uScale;
  varying float vAlpha;
  varying float vFlap;
  void main() {
    vec3 s = aSeed.xyz;
    float t = uTime * (0.6 + aSeed.w * 0.4);
    // A loose ring around the ruin that swells and shrinks, each bat on its own circle and height.
    float a = t * (0.7 + s.x * 0.8) * (s.y > 0.5 ? 1.0 : -1.0) + s.z * 6.283;
    float r = 0.8 + s.y * 1.6 + 0.5 * sin(t * 0.4 + s.z * 20.0);
    float h = 0.9 + s.x * 2.4 + sin(t * 2.3 + s.z * 30.0) * 0.5;
    vec3 p = aSite + vec3(cos(a) * r, h, sin(a) * r);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uScale * 0.9 / max(0.5, -mv.z), 6.0, 48.0);
    vAlpha = aSite.y < -500.0 ? 0.0 : 1.0;
    vFlap = sin(uTime * (14.0 + aSeed.w * 6.0) + s.x * 60.0);
  }
`;

export class Roosts {
  readonly points: THREE.Points;
  private u: Record<string, THREE.IUniform>;
  private site: THREE.BufferAttribute;

  constructor() {
    const seed = new Float32Array(SITES * PER * 4);
    for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SITES * PER * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.site = new THREE.BufferAttribute(new Float32Array(SITES * PER * 3).fill(-1000), 3);
    g.setAttribute('aSite', this.site);
    this.u = { uTime: { value: 0 }, uScale: { value: 600 }, uOpacity: { value: 0 } };
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: batFragment, uniforms: this.u, transparent: true, depthWrite: false, fog: false }),
    );
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  /** Same light as the bats: most at the turn of the day, none at noon, in deep night or in bad weather. */
  setDusk(moon: number, clear: boolean): void {
    this.u.uOpacity.value = clear ? Math.min(1, 4 * moon * (1 - moon)) : 0;
  }

  /** The nearest `SITES` standing ruins to the camera roost. */
  update(time: number, ruins: readonly THREE.Vector3[], target: THREE.Vector3, pixelRatio: number, viewHeight: number, on: boolean): void {
    this.points.visible = on && ruins.length > 0 && (this.u.uOpacity.value as number) > 0.05;
    if (!this.points.visible) return;
    this.u.uTime.value = time;
    this.u.uScale.value = viewHeight * pixelRatio;
    const near = [...ruins].sort((a, b) => a.distanceToSquared(target) - b.distanceToSquared(target)).slice(0, SITES);
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
    this.site.needsUpdate = true;
  }
}
