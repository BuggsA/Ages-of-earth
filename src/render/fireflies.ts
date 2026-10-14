import * as THREE from 'three';

/**
 * Fireflies: on a clear night, soft green-gold sparks drift low over the land near the camera, each
 * pulsing on its own beat. Render only: nothing in the rules sees them.
 */

const COUNT = 260;

const vertex = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform vec3 uCenter;
  uniform float uBox;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vec3 s = aSeed.xyz;
    float t = uTime * (0.08 + aSeed.w * 0.06);
    vec2 wrapped = fract(s.xz - uCenter.xz / uBox + vec2(sin(t * 3.0 + s.y * 20.0), cos(t * 2.3 + s.x * 20.0)) * 0.03 + vec2(t * 0.15, 0.0));
    float bob = 0.5 + 0.5 * sin(uTime * (0.4 + aSeed.w * 0.5) + s.x * 50.0);
    vec3 p = vec3(uCenter.x + (wrapped.x - 0.5) * uBox, uCenter.y + 0.3 + s.y * 1.1 + bob * 0.4, uCenter.z + (wrapped.y - 0.5) * uBox);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uScale * 0.16 / max(0.5, -mv.z), 3.0, 24.0);
    float edge = min(1.0 - abs(wrapped.x * 2.0 - 1.0), 1.0 - abs(wrapped.y * 2.0 - 1.0));
    // Each blinks on and off at its own pace, most of the time dark.
    float blink = smoothstep(0.35, 1.0, sin(uTime * (0.9 + aSeed.w * 1.4) + s.z * 90.0));
    vAlpha = smoothstep(0.0, 0.2, edge) * blink;
  }
`;

const fragment = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(mix(vec3(0.55, 0.85, 0.25), vec3(1.0, 0.95, 0.6), core * core), vAlpha * uOpacity * core);
  }
`;

export class Fireflies {
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
      new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  /** How many fireflies are out: 0 by day (and in rain, snow or mist) to 1 on a clear night. */
  setNight(k: number): void {
    this.u.uOpacity.value = k;
  }

  /** Keep the swarm (off on Low quality) around the camera's target. Only the near land is shown, so only it is lit. */
  update(time: number, target: THREE.Vector3, distance: number, pixelRatio: number, viewHeight: number, on: boolean): void {
    this.points.visible = on && (this.u.uOpacity.value as number) > 0.02;
    if (!this.points.visible) return;
    const u = this.u;
    u.uTime.value = time;
    (u.uCenter.value as THREE.Vector3).set(target.x, target.y, target.z);
    u.uBox.value = 18 + distance * 0.7;
    u.uScale.value = viewHeight * pixelRatio;
  }
}
