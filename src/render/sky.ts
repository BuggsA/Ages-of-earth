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
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float h = clamp(dir.y, -0.1, 1.0);
    vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.6, h));
    float s = max(dot(dir, normalize(uSunDir)), 0.0);
    col += uSunColor * (pow(s, 900.0) * 2.5 + pow(s, 24.0) * 0.25 + pow(s, 4.0) * 0.06);
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
      },
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), this.material);
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
  }

  apply(top: THREE.Color, horizon: THREE.Color, sunDir: THREE.Vector3): void {
    this.material.uniforms.uTop.value.copy(top);
    this.material.uniforms.uHorizon.value.copy(horizon);
    this.material.uniforms.uSunDir.value.copy(sunDir);
  }
}
