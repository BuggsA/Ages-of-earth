import * as THREE from 'three';
import { Owls } from './owls';

/**
 * Owl perches: in the dead of a clear night one owl sits on each of the nearest standing ruins the viewer
 * has seen, still, ear tufts up, and now and then its eyes blink shut. A dug-out ruin goes quiet. Render
 * only: nothing in the rules sees them.
 */

const SITES = 6;

const vertex = /* glsl */ `
  attribute float aPhase;
  attribute vec3 aSite;
  uniform float uTime;
  uniform float uScale;
  varying float vAlpha;
  varying float vBlink;
  void main() {
    vec3 p = aSite + vec3(0.0, 1.6, 0.0);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uScale * 0.55 / max(0.5, -mv.z), 8.0, 56.0);
    vAlpha = aSite.y < -500.0 ? 0.0 : 1.0;
    // Eyes shut for a moment every few seconds, each owl on its own beat.
    float c = fract(uTime * 0.17 + aPhase);
    vBlink = 1.0 - smoothstep(0.0, 0.015, c) * (1.0 - smoothstep(0.03, 0.05, c));
  }
`;

const fragment = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  varying float vBlink;
  void main() {
    vec2 p = gl_PointCoord - vec2(0.5, 0.5);
    p.y = -p.y;
    // A pear-shaped body, a round head and two ear tufts.
    float body = 1.0 - smoothstep(0.17, 0.2, length(vec2(p.x * 1.15, (p.y + 0.12) * 0.8)));
    float head = 1.0 - smoothstep(0.12, 0.15, length(vec2(p.x, p.y - 0.12)));
    float tuft = (1.0 - smoothstep(0.03, 0.05, abs(abs(p.x) - 0.09 - (p.y - 0.2) * 0.4))) * step(0.2, p.y) * step(p.y, 0.3);
    float a = max(max(body, head), tuft);
    if (a < 0.05) discard;
    vec3 col = mix(vec3(0.34, 0.31, 0.27), vec3(0.8, 0.76, 0.64), body * 0.55);
    float eyes = (1.0 - smoothstep(0.018, 0.034, length(vec2(abs(p.x) - 0.05, p.y - 0.13)))) * (1.0 - vBlink);
    col = mix(col, vec3(1.0, 0.82, 0.25), eyes);
    gl_FragColor = vec4(col, a * vAlpha * uOpacity);
  }
`;

export class Perches {
  readonly points: THREE.Points;
  private u: Record<string, THREE.IUniform>;
  private site: THREE.BufferAttribute;

  constructor() {
    const phase = new Float32Array(SITES);
    for (let i = 0; i < SITES; i++) phase[i] = Math.random();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SITES * 3), 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.site = new THREE.BufferAttribute(new Float32Array(SITES * 3).fill(-1000), 3);
    g.setAttribute('aSite', this.site);
    this.u = { uTime: { value: 0 }, uScale: { value: 600 }, uOpacity: { value: 0 } };
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: this.u, transparent: true, depthWrite: false, fog: false }),
    );
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  /** Same night as the flying owls. */
  setNight(moon: number, clear: boolean): void {
    this.u.uOpacity.value = Owls.level(moon, clear);
  }

  update(time: number, ruins: readonly THREE.Vector3[], target: THREE.Vector3, pixelRatio: number, viewHeight: number, on: boolean): void {
    this.points.visible = on && ruins.length > 0 && (this.u.uOpacity.value as number) > 0.05;
    if (!this.points.visible) return;
    this.u.uTime.value = time;
    this.u.uScale.value = viewHeight * pixelRatio;
    const near = [...ruins].sort((a, b) => a.distanceToSquared(target) - b.distanceToSquared(target)).slice(0, SITES);
    const a = this.site.array as Float32Array;
    for (let i = 0; i < SITES; i++) {
      const r = near[i];
      a[i * 3] = r ? r.x : 0;
      a[i * 3 + 1] = r ? r.y : -1000;
      a[i * 3 + 2] = r ? r.z : 0;
    }
    this.site.needsUpdate = true;
  }
}
