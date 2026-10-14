import * as THREE from 'three';

/**
 * Bats: at dusk and dawn, a few dark bats flit over the land near the camera in quick, jinking loops,
 * each wing-beat a flipping chevron. Render only: nothing in the rules sees them.
 */

const COUNT = 28;

const vertex = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform vec3 uCenter;
  uniform float uBox;
  uniform float uScale;
  varying float vAlpha;
  varying float vFlap;
  void main() {
    vec3 s = aSeed.xyz;
    float t = uTime * (0.5 + aSeed.w * 0.3);
    // A wide slow drift, with fast jinks laid over it.
    vec2 drift = vec2(t * 0.02 * (s.z - 0.5) * 2.0, t * 0.015 * (s.x - 0.5) * 2.0);
    vec2 jink = vec2(sin(t * 1.7 + s.y * 40.0) + 0.5 * sin(t * 4.1 + s.x * 30.0), cos(t * 1.3 + s.x * 40.0) + 0.5 * sin(t * 3.7 + s.z * 30.0)) * 0.08;
    vec2 wrapped = fract(s.xz - uCenter.xz / uBox + drift + jink);
    float h = 2.5 + s.y * 3.5 + sin(t * 2.2 + s.z * 30.0) * 0.8;
    vec3 p = vec3(uCenter.x + (wrapped.x - 0.5) * uBox, uCenter.y + h, uCenter.z + (wrapped.y - 0.5) * uBox);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uScale * 0.9 / max(0.5, -mv.z), 8.0, 56.0);
    float edge = min(1.0 - abs(wrapped.x * 2.0 - 1.0), 1.0 - abs(wrapped.y * 2.0 - 1.0));
    vAlpha = smoothstep(0.0, 0.15, edge);
    vFlap = sin(uTime * (14.0 + aSeed.w * 6.0) + s.x * 60.0);
  }
`;

export const batFragment = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  varying float vFlap;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    // Two wings meeting at the body: a chevron whose arms rise and fall with the beat.
    float arm = abs(p.x);
    float line = abs(p.y + 0.12 - arm * (0.5 + 0.9 * vFlap) * 0.6 + arm * 0.0);
    float wing = (1.0 - smoothstep(0.05, 0.11, line)) * step(arm, 0.46);
    float body = (1.0 - smoothstep(0.05, 0.1, length(p * vec2(1.6, 0.9)))) ;
    float a = max(wing, body);
    if (a < 0.05) discard;
    gl_FragColor = vec4(0.04, 0.03, 0.06, a * vAlpha * uOpacity);
  }
`;

export class Bats {
  readonly points: THREE.Points;
  private u: Record<string, THREE.IUniform>;

  constructor() {
    const seed = new Float32Array(COUNT * 4);
    for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.u = {
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector3() },
      uBox: { value: 30 },
      uScale: { value: 600 },
      uOpacity: { value: 0 },
    };
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: batFragment, uniforms: this.u, transparent: true, depthWrite: false, fog: false }),
    );
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  /** How many bats are out, from the moon level of the light: none at noon or deep night, most at the turn of the light. */
  setDusk(moon: number, clear: boolean): void {
    this.u.uOpacity.value = clear ? Math.min(1, 4 * moon * (1 - moon)) : 0;
  }

  update(time: number, target: THREE.Vector3, distance: number, pixelRatio: number, viewHeight: number, on: boolean): void {
    this.points.visible = on && (this.u.uOpacity.value as number) > 0.05;
    if (!this.points.visible) return;
    const u = this.u;
    u.uTime.value = time;
    (u.uCenter.value as THREE.Vector3).set(target.x, target.y, target.z);
    u.uBox.value = 20 + distance * 0.8;
    u.uScale.value = viewHeight * pixelRatio;
  }
}
