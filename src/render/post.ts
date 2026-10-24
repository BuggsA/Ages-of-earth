import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export type QualityName = 'low' | 'medium' | 'high';

export interface Quality {
  label: string;
  pixelRatio: number;
  /** Shadow map size, or 0 for no shadows. */
  shadows: number;
  /** The colour grade and vignette pass. */
  post: boolean;
  /** Bloom on emissive parts (the dearer half of the pass). */
  bloom: boolean;
}

export const QUALITY: Record<QualityName, Quality> = {
  low: { label: 'Low', pixelRatio: 1, shadows: 0, post: false, bloom: false },
  medium: { label: 'Medium', pixelRatio: 1.5, shadows: 1024, post: true, bloom: false },
  high: { label: 'High', pixelRatio: 2, shadows: 2048, post: true, bloom: true },
};

const KEY = 'ages-quality';

/** The saved setting, or a sensible default: smaller screens start at Medium. */
export function loadQuality(): QualityName {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'low' || saved === 'medium' || saved === 'high') return saved;
  } catch {
    // Storage can be blocked; fall through to the default.
  }
  return window.matchMedia?.('(pointer: coarse)').matches ? 'medium' : 'high';
}

export function saveQuality(q: QualityName): void {
  try {
    localStorage.setItem(KEY, q);
  } catch {
    // Not fatal: the setting just won't be remembered.
  }
}

const GradeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      // Contrast about mid grey (linear), a little more colour, cool shadows and warm highlights.
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      // The contrast fades out in the darks, so a night's shapes aren't crushed to black.
      c.rgb = max((c.rgb - 0.18) * (1.0 + 0.14 * smoothstep(0.03, 0.2, l)) + 0.18, 0.0);
      c.rgb = mix(vec3(l), c.rgb, 1.1);
      c.rgb += vec3(-0.008, 0.0, 0.014) * (1.0 - smoothstep(0.0, 0.35, l));
      c.rgb *= mix(vec3(1.0), vec3(1.04, 1.0, 0.95), smoothstep(0.5, 1.4, l));
      c.rgb *= mix(1.0, 0.82, smoothstep(0.45, 0.9, d));
      gl_FragColor = c;
    }
  `,
};

/** A colour grade and soft vignette, plus (High) bloom on bright things such as wonders, legends and lights, then tone mapping. */
export class Post {
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    // Multisampled, so edges stay as smooth as when the renderer draws straight to the screen.
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    // Only truly emissive parts (well above 1.0 before tone mapping) should glow, not sunlit ground.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.5, 1.6);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new ShaderPass(GradeShader));
    this.composer.addPass(new OutputPass());
  }

  setSize(w: number, h: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
  }

  /** Bloom is on for High only; Medium takes just the grade. */
  render(bloom: boolean): void {
    this.bloom.enabled = bloom;
    this.composer.render();
  }
}
