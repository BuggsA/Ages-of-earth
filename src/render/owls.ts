import * as THREE from 'three';

/**
 * Owls: deep in a clear night a few pale owls glide over the land near the camera, slow and silent,
 * broad wings rising and falling in long beats, a pale breast catching the moon. Render only: nothing
 * in the rules sees them. The bats own the turn of the light; the owls own the dark between.
 */

const COUNT = 7;

const vertex = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform vec3 uCenter;
  uniform float uBox;
  uniform float uScale;
  varying float vAlpha;
  varying float vFlap;
  varying float vDir;
  void main() {
    vec3 s = aSeed.xyz;
    float t = uTime * (0.6 + aSeed.w * 0.3);
    // A long, wide, unhurried circuit: owls quarter a field, they don't jink.
    float a = t * 0.05 * (s.x > 0.5 ? 1.0 : -1.0) + s.y * 6.2832;
    vec2 loop = vec2(sin(a), cos(a * 0.8 + s.z * 6.0)) * 0.22;
    vec2 wrapped = fract(s.xz - uCenter.xz / uBox + loop + vec2(t * 0.004 * (s.z - 0.5), t * 0.004 * (s.x - 0.5)));
    float h = 2.2 + s.y * 2.6 + sin(t * 0.7 + s.z * 20.0) * 0.6;
    vec3 p = vec3(uCenter.x + (wrapped.x - 0.5) * uBox, uCenter.y + h, uCenter.z + (wrapped.y - 0.5) * uBox);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(uScale * 1.5 / max(0.5, -mv.z), 14.0, 90.0);
    float edge = min(1.0 - abs(wrapped.x * 2.0 - 1.0), 1.0 - abs(wrapped.y * 2.0 - 1.0));
    vAlpha = smoothstep(0.0, 0.15, edge);
    vFlap = sin(uTime * (4.0 + aSeed.w * 1.5) + s.x * 60.0);
    vDir = cos(a) * (s.x > 0.5 ? 1.0 : -1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  varying float vFlap;
  varying float vDir;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    // Broad wings: a shallow, thick chevron that lifts and drops with the slow beat.
    float arm = abs(p.x);
    float line = abs(p.y + 0.06 - arm * (0.25 + 0.55 * vFlap) * 0.6);
    float wing = (1.0 - smoothstep(0.06, 0.13, line)) * step(arm, 0.48);
    // A pale round body with a darker head-spot, so it reads as something with a face.
    float body = 1.0 - smoothstep(0.08, 0.14, length(p * vec2(1.7, 0.85) - vec2(0.0, 0.02)));
    float eyes = 1.0 - smoothstep(0.02, 0.04, length(vec2(arm - 0.035, p.y + 0.02)));
    float a = max(wing * 0.85, body);
    if (a < 0.05) discard;
    vec3 col = mix(vec3(0.5, 0.48, 0.42), vec3(0.86, 0.82, 0.7), body);
    col = mix(col, vec3(0.95, 0.8, 0.3), eyes * body);
    gl_FragColor = vec4(col, a * vAlpha * uOpacity);
  }
`;

export class Owls {
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
      new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: this.u, transparent: true, depthWrite: false, fog: false }),
    );
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  /** How many owls are out, from the moon level of the light: none until the night is well on, all of them in the dead of it. */
  static level(moon: number, clear: boolean): number {
    return clear ? Math.max(0, Math.min(1, (moon - 0.55) / 0.35)) : 0;
  }

  setNight(moon: number, clear: boolean): void {
    this.u.uOpacity.value = Owls.level(moon, clear);
  }

  update(time: number, target: THREE.Vector3, distance: number, pixelRatio: number, viewHeight: number, on: boolean): void {
    this.points.visible = on && (this.u.uOpacity.value as number) > 0.05;
    if (!this.points.visible) return;
    const u = this.u;
    u.uTime.value = time;
    (u.uCenter.value as THREE.Vector3).set(target.x, target.y, target.z);
    u.uBox.value = 24 + distance * 0.9;
    u.uScale.value = viewHeight * pixelRatio;
  }
}
