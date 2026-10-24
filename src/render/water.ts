import * as THREE from 'three';
import type { GameState } from '../sim/types';
import { fogUniforms } from './materials';
import { seasonUniforms } from './seasonLook';

/**
 * Lakes: one shaded plane at the water line, colored by how deep the lake bed lies beneath it (read from
 * a small height texture): turquoise shallows, deep blue middles, a band of foam along the shore and
 * wave lines rolling in, sun glints and a fresnel sheen of sky. In winter ice grows out from the shore as the
 * snow settles (`uFrost`, the season's snow cover), leaving the deep middle open. It reads the fog of war like everything else.
 */

export const WATER_Y = -0.02;

const vertex = /* glsl */ `
  #include <fog_pars_vertex>
  uniform float uTime;
  uniform vec2 uFogSize;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec2 vFogUv;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    float a = world.x * 0.7 + uTime * 1.1;
    float b = world.z * 0.9 - uTime * 0.8 + world.x * 0.3;
    world.y += sin(a) * 0.015 + sin(b) * 0.012;
    float dx = cos(a) * 0.0105 + cos(b) * 0.0036;
    float dz = cos(b) * 0.0108;
    vNormal = normalize(vec3(-dx, 1.0, -dz));
    vWorld = world.xyz;
    vFogUv = world.xz / uFogSize;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform sampler2D uBed;
  uniform vec2 uBedSize;
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uSky;
  uniform float uStars;
  uniform float uFrost;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform sampler2D uFogTex;
  uniform float uFogOn;
  uniform vec3 uUnexplored;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec2 vFogUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  void main() {
    float bed = texture2D(uBed, (vWorld.xz + 0.5) / uBedSize).r * 4.0 - 3.0;
    float depth = max(0.0, ${WATER_Y.toFixed(3)} - bed);
    float n = noise(vWorld.xz * 1.6 + vec2(uTime * 0.15, -uTime * 0.11));
    vec3 col = mix(uShallow, uDeep, smoothstep(0.02, 0.9, depth + (n - 0.5) * 0.12));
    float ripple = noise(vWorld.xz * 4.0 + uTime * 0.5) * noise(vWorld.xz * 2.6 - uTime * 0.35);
    col += vec3(0.03, 0.05, 0.05) * ripple * (1.0 - smoothstep(0.1, 0.6, depth));

    float shore = 1.0 - smoothstep(0.0, 0.07 + n * 0.05, depth);
    float lines = smoothstep(0.82, 1.0, sin(depth * 26.0 - uTime * 1.8 + n * 3.0)) * (1.0 - smoothstep(0.05, 0.45, depth));
    float foam = clamp(shore * 0.9 + lines * 0.5, 0.0, 1.0);

    vec3 N = normalize(vNormal + vec3((n - 0.5) * 0.12, 0.0, (ripple - 0.25) * 0.12));
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col = mix(col, uSky, fres * 0.3);
    vec3 H = normalize(V + normalize(uSunDir));
    col += uSunColor * pow(max(dot(N, H), 0.0), 160.0) * 0.8;
    if (uStars > 0.01) {
      // At night the lake mirrors the stars: pin-pricks that glint now here, now there.
      vec2 c = floor(vWorld.xz * 5.0);
      float r = hash(c);
      float glint = smoothstep(0.55, 1.0, sin(uTime * (1.2 + r * 2.0) + r * 80.0));
      float d = length(fract(vWorld.xz * 5.0) - 0.5);
      col += vec3(0.8, 0.88, 1.0) * step(0.93, r) * glint * smoothstep(0.28, 0.0, d) * uStars * (0.4 + 0.6 * fres);
    }
    col = mix(col, vec3(0.95, 0.98, 1.0), foam);
    if (uFrost > 0.0) {
      // Ice creeps from the shallows toward the deep; its edge is ragged, and it is cracked and dull.
      float reach = uFrost * 0.62;
      float ice = 1.0 - smoothstep(reach - 0.1, reach, depth + (n - 0.5) * 0.28);
      float crack = smoothstep(0.03, 0.0, abs(noise(vWorld.xz * 3.1) - 0.5)) * 0.18;
      vec3 sheet = mix(vec3(0.74, 0.86, 0.93), vec3(0.93, 0.97, 1.0), ripple * 0.8 + n * 0.3) - crack;
      col = mix(col, sheet, ice * 0.92);
    }

    if (uFogOn > 0.5) {
      vec2 f = texture2D(uFogTex, vFogUv).rg;
      vec3 remembered = mix(vec3(dot(col, vec3(0.3, 0.55, 0.15))), col, 0.35) * 0.5;
      col = mix(uUnexplored, mix(remembered, col, f.r), f.g);
    }
    gl_FragColor = vec4(col, 0.9 - shore * 0.15);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export class WaterView {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private bed: THREE.DataTexture | null = null;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uBed: { value: null },
          uBedSize: { value: new THREE.Vector2(1, 1) },
          uSunDir: { value: new THREE.Vector3(-0.5, 0.8, 0.3) },
          uSunColor: { value: new THREE.Color('#fff2d6') },
          uSky: { value: new THREE.Color('#bfe6f2') },
          uStars: { value: 0 },
          uFrost: seasonUniforms.uSnow,
          uShallow: { value: new THREE.Color('#3a8690') },
          uDeep: { value: new THREE.Color('#2c5b78') },
        },
      ]),
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    // The fog-of-war uniforms are shared objects, so they stay in step with every other material.
    Object.assign(this.material.uniforms, { uFogTex: fogUniforms.uFogTex, uFogSize: fogUniforms.uFogSize, uFogOn: fogUniforms.uFogOn, uUnexplored: fogUniforms.uUnexplored });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 1;
  }

  setup(s: GameState): void {
    const W = s.w + 1;
    const H = s.h + 1;
    const data = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      data[i * 4] = Math.round(Math.max(0, Math.min(1, (s.height[i] + 3) / 4)) * 255);
      data[i * 4 + 3] = 255;
    }
    this.bed?.dispose();
    this.bed = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    this.bed.magFilter = THREE.LinearFilter;
    this.bed.minFilter = THREE.LinearFilter;
    this.bed.needsUpdate = true;
    this.material.uniforms.uBed.value = this.bed;
    this.material.uniforms.uBedSize.value.set(W, H);
    // Only where there is water: a plane over the whole map, the land rising through it.
    const geo = new THREE.PlaneGeometry(s.w, s.h, Math.ceil(s.w / 2), Math.ceil(s.h / 2));
    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
    this.mesh.position.set(s.w / 2, WATER_Y, s.h / 2);
  }

  /** The shore moved (#701, land pumped out of the water): re-read the bed from the heights as drawn, so the foam follows the new shore. */
  refreshBed(s: GameState, heightOf: (corner: number) => number): void {
    const bed = this.bed;
    if (!bed) return;
    const data = bed.image.data as Uint8Array;
    const n = (s.w + 1) * (s.h + 1);
    for (let i = 0; i < n; i++) data[i * 4] = Math.round(Math.max(0, Math.min(1, (heightOf(i) + 3) / 4)) * 255);
    bed.needsUpdate = true;
  }

  /** Stars glinting on the lakes: 0 by day to 1 on a clear night. */
  setStars(k: number): void {
    this.material.uniforms.uStars.value = k;
  }

  update(time: number, sunDir: THREE.Vector3, sky: THREE.Color, sunColor?: THREE.Color): void {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uSunDir.value.copy(sunDir);
    u.uSky.value.copy(sky);
    if (sunColor) u.uSunColor.value.copy(sunColor);
  }
}
