import * as THREE from 'three';

const vertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    gl_Position.z = gl_Position.w;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uNight;
  uniform float uTime;
  uniform float uPhase;
  uniform float uAurora;
  uniform vec3 uMeteorA;
  uniform vec3 uMeteorV;
  uniform float uMeteorT;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  // Pin-prick stars: one candidate per cell of a 3D grid laid over the dome, most of them dark.
  float stars(vec3 dir) {
    vec3 q = dir * 90.0;
    vec3 c = floor(q);
    float h = hash(c);
    if (h < 0.88) return 0.0;
    vec3 at = c + 0.25 + 0.5 * vec3(hash(c + 1.7), hash(c + 5.3), hash(c + 9.1));
    float d = length(q - at);
    float twinkle = 0.65 + 0.35 * sin(uTime * (1.5 + h * 3.0) + h * 60.0);
    return smoothstep(0.28, 0.0, d) * (0.4 + (h - 0.88) * 5.0) * twinkle;
  }
  void main() {
    vec3 dir = normalize(vDir);
    float h = clamp(dir.y, -0.1, 1.0);
    vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.6, h));
    float s = max(dot(dir, normalize(uSunDir)), 0.0);
    col += uSunColor * (pow(s, 900.0) * 2.5 + pow(s, 24.0) * 0.25 + pow(s, 4.0) * 0.06);
    if (uNight > 0.01) {
      float up = smoothstep(0.0, 0.22, dir.y);
      // Stars, and a faint milky band across them.
      vec3 band = normalize(vec3(0.6, 0.3, -0.5));
      float milk = smoothstep(0.35, 0.0, abs(dot(dir, band))) * (0.5 + 0.5 * hash(floor(dir * 40.0)));
      col += vec3(0.55, 0.62, 0.9) * milk * 0.07 * uNight * up;
      col += vec3(0.85, 0.9, 1.0) * stars(dir) * uNight * up * 1.4;
      // The moon: a disc with its phase eaten out of it, and a halo that shows through thin cloud.
      vec3 md = normalize(vec3(-0.62, 0.42, 0.52)); // low enough for the gaze key to reach
      vec3 q = dir - md * dot(dir, md);
      float r = 0.045;
      vec3 e = normalize(cross(md, vec3(0.0, 1.0, 0.0)));
      float inDisc = step(dot(dir, md), 0.0) < 0.5 ? smoothstep(r, r * 0.92, length(q)) : 0.0;
      float bite = smoothstep(r * 0.96, r * 1.04, length(q - e * r * (2.0 - uPhase * 2.1)));
      float lit = inDisc * mix(1.0, bite, step(0.001, uPhase));
      float crater = 0.8 + 0.2 * hash(floor(q * 140.0));
      col += vec3(0.95, 0.96, 0.88) * (lit * crater * 0.85 + inDisc * 0.04);
      col += vec3(0.5, 0.58, 0.85) * pow(max(dot(dir, md), 0.0), 40.0) * 0.18 * (1.0 - uPhase * 0.5);
      // Aurora: curtains of green and violet that sway along the northern sky.
      if (uAurora > 0.01) {
        float az = atan(dir.x, -dir.z);
        float sway = sin(az * 3.0 + uTime * 0.12) * 0.5 + sin(az * 7.0 - uTime * 0.2) * 0.25;
        float base = 0.16 + 0.07 * sway;
        float curtain = smoothstep(base, base + 0.05, dir.y) * smoothstep(base + 0.42, base + 0.08, dir.y);
        float rays = 0.55 + 0.45 * sin(az * 46.0 + sway * 5.0 + uTime * 0.4);
        float north = smoothstep(-0.2, -0.75, dir.z * 1.0) ;
        float pulse = 0.7 + 0.3 * sin(uTime * 0.25 + az * 2.0);
        vec3 tint = mix(vec3(0.15, 1.0, 0.55), vec3(0.6, 0.3, 1.0), smoothstep(base + 0.1, base + 0.4, dir.y));
        col += tint * curtain * rays * north * pulse * uAurora * uNight * 0.4;
      }
      // A shooting star: a bright head dragging a tail.
      if (uMeteorT >= 0.0) {
        vec3 head = normalize(uMeteorA + uMeteorV * uMeteorT);
        vec3 tail = normalize(uMeteorA + uMeteorV * max(uMeteorT - 0.22, 0.0));
        vec3 ba = head - tail;
        float k = clamp(dot(dir - tail, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
        float d = length(dir - tail - ba * k);
        float fade = smoothstep(0.0, 0.12, uMeteorT) * smoothstep(1.0, 0.7, uMeteorT);
        col += vec3(1.0, 0.95, 0.85) * smoothstep(0.006, 0.0, d) * k * k * fade * 1.6 * uNight;
      }
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Gradient dome with a sun, tinted per season by the caller. */
export class Sky {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color('#5fb6ea') },
        uHorizon: { value: new THREE.Color('#d8f0f7') },
        uSunDir: { value: new THREE.Vector3(-0.5, 0.6, 0.4) },
        uSunColor: { value: new THREE.Color('#fff1d0') },
        uNight: { value: 0 },
        uTime: { value: 0 },
        uPhase: { value: 0 },
        uAurora: { value: 0 },
        uMeteorA: { value: new THREE.Vector3(0, 1, 0) },
        uMeteorV: { value: new THREE.Vector3(1, 0, 0) },
        uMeteorT: { value: -1 },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), this.material);
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
  }

  /** Told when a shooting star crosses, with its pan, so a faint sound can follow it. */
  onMeteor: ((pan: number) => void) | null = null;
  private meteorIn = 8;
  private meteorAge = -1;
  private night = 0;

  /** The night sky: 0 by day to 1 on a clear night; the moon's phase; how strongly the aurora burns. */
  setNight(night: number, phase: number, aurora: number): void {
    this.night = night;
    const u = this.material.uniforms;
    u.uNight.value = night;
    u.uPhase.value = phase;
    u.uAurora.value = aurora * night * night;
  }

  /** Drives the twinkle, the aurora's sway and the odd shooting star. */
  update(time: number, dt: number): void {
    const u = this.material.uniforms;
    u.uTime.value = time;
    if (this.night < 0.5) {
      this.meteorAge = -1;
      u.uMeteorT.value = -1;
      return;
    }
    if (this.meteorAge >= 0) {
      this.meteorAge += dt / 0.9;
      if (this.meteorAge >= 1) {
        this.meteorAge = -1;
        this.meteorIn = 14 + Math.random() * 26;
      }
      u.uMeteorT.value = this.meteorAge;
      return;
    }
    this.meteorIn -= dt;
    if (this.meteorIn > 0) return;
    // A streak starts high in the sky and falls toward the horizon at a slant.
    const a = Math.random() * Math.PI * 2;
    (u.uMeteorA.value as THREE.Vector3).set(Math.cos(a) * 0.5, 0.6 + Math.random() * 0.3, Math.sin(a) * 0.5).normalize();
    const side = Math.random() < 0.5 ? -1 : 1;
    (u.uMeteorV.value as THREE.Vector3).set(side * (0.4 + Math.random() * 0.3), -0.5, (Math.random() - 0.5) * 0.4);
    this.meteorAge = 0;
    this.onMeteor?.(Math.max(-0.9, Math.min(0.9, Math.cos(a))));
  }

  /** Dim the sun's glare (cloud cover): 1 is a clear day. */
  setGlare(k: number, color?: THREE.Color): void {
    this.material.uniforms.uSunColor.value.copy(color ?? new THREE.Color('#fff1d0')).multiplyScalar(k);
  }

  apply(top: THREE.Color, horizon: THREE.Color, sunDir: THREE.Vector3): void {
    this.material.uniforms.uTop.value.copy(top);
    this.material.uniforms.uHorizon.value.copy(horizon);
    this.material.uniforms.uSunDir.value.copy(sunDir);
  }
}
