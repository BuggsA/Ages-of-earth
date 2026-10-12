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
  /** Bloom and vignette. */
  post: boolean;
}

export const QUALITY: Record<QualityName, Quality> = {
  low: { label: 'Low', pixelRatio: 1, shadows: 0, post: false },
  medium: { label: 'Medium', pixelRatio: 1.5, shadows: 1024, post: false },
  high: { label: 'High', pixelRatio: 2, shadows: 2048, post: true },
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

const VignetteShader = {
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
      c.rgb *= mix(1.0, 0.8, smoothstep(0.42, 0.85, d));
      gl_FragColor = c;
    }
  `,
};

/** Bloom on bright things (wonders, legends, lights) plus a soft vignette, then tone mapping. */
export class Post {
  private composer: EffectComposer;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    // Only truly emissive parts (well above 1.0 before tone mapping) should glow, not sunlit ground.
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.5, 1.6));
    this.composer.addPass(new ShaderPass(VignetteShader));
    this.composer.addPass(new OutputPass());
  }

  setSize(w: number, h: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
  }

  render(): void {
    this.composer.render();
  }
}
