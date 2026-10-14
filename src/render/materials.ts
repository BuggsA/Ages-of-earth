import * as THREE from 'three';

/**
 * Shared materials and the shader additions every object in the world gets:
 *  - fog of war: a small texture of what the player sees (red) and has seen (green) darkens and greys
 *    what lies outside their sight, and hides the unexplored under a deep slate;
 *  - team colors and glowing parts, from the baked `aTeam` attribute (1 tints by the instance color,
 *    2 glows);
 *  - limbs: vertices tagged with a limb group swing about their pivot by the per-instance `aAnim`
 *    angles (legs walk, an arm strikes or chops), so instanced armies animate without skeletons.
 */

/** How brightly glowing parts (windows, torches, lanterns) shine: dimmer by day, strong as dusk falls. */
export const glowUniform = { uGlow: { value: 1.25 } };

/** The day's wind (tiles a second, x and z), which streams banners and windsocks. */
export const windUniform = { value: new THREE.Vector2(0.2, 0) };

export const fogUniforms = {
  uFogTex: { value: null as THREE.Texture | null },
  uFogSize: { value: new THREE.Vector2(1, 1) },
  uFogOn: { value: 1 },
  uUnexplored: { value: new THREE.Color('#18222f') },
};

const FOG_PARS_VERTEX = /* glsl */ `
  varying vec2 vFogUv;
  uniform vec2 uFogSize;
`;

const FOG_VERTEX = /* glsl */ `
  {
    vec4 fogWorld = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      fogWorld = instanceMatrix * fogWorld;
    #endif
    fogWorld = modelMatrix * fogWorld;
    vFogUv = fogWorld.xz / uFogSize;
  }
`;

const FOG_PARS_FRAGMENT = /* glsl */ `
  varying vec2 vFogUv;
  uniform sampler2D uFogTex;
  uniform float uFogOn;
  uniform vec3 uUnexplored;
  vec3 fogOfWar(vec3 col) {
    if (uFogOn < 0.5) return col;
    vec2 f = texture2D(uFogTex, vFogUv).rg;
    float grey = dot(col, vec3(0.3, 0.55, 0.15));
    vec3 remembered = mix(vec3(grey) * vec3(0.92, 0.96, 1.08), col, 0.35) * 0.5;
    vec3 seen = mix(remembered, col, f.r);
    return mix(uUnexplored, seen, f.g);
  }
`;

const FOG_FRAGMENT = /* glsl */ `
  gl_FragColor.rgb = fogOfWar(gl_FragColor.rgb);
`;

export interface Inject {
  /** Swing limbs by the instance's `aAnim`. */
  rig?: boolean;
  /** Tint team parts by the instance color, and light glowing parts. */
  team?: boolean;
  /** Darken by fog of war. */
  fog?: boolean;
  /** Cloth tagged by `Kit.cloth` streams downwind and ripples (banners, windsocks). */
  flag?: boolean;
  /** Sway with the wind (trees, crops): vertices higher up move more, by `uTime`. */
  sway?: number;
}

export const timeUniform = { value: 0 };

/** Add the world's shader parts to a material. */
export function inject<T extends THREE.Material>(mat: T, o: Inject): T {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    if (o.fog !== false) Object.assign(shader.uniforms, fogUniforms);
    if (o.rig || o.team) Object.assign(shader.uniforms, glowUniform);
    if (o.sway || o.rig || o.team) shader.uniforms.uTime = timeUniform;
    if (o.flag) shader.uniforms.uWind = windUniform;
    let vs = shader.vertexShader;
    let fs = shader.fragmentShader;
    const parsV: string[] = [];
    if (o.fog !== false) parsV.push(FOG_PARS_VERTEX);
    if (o.rig || o.team) parsV.push('attribute float aTeam;\nvarying float vGlow;');
    if (o.rig) parsV.push('attribute vec3 aRig;\nattribute vec3 aAnim;');
    else if (o.flag) parsV.push('attribute vec3 aRig;');
    if (o.flag) parsV.push('uniform vec2 uWind;');
    if (o.sway || o.rig || o.team) parsV.push('uniform float uTime;');
    vs = vs.replace('#include <common>', `#include <common>\n${parsV.join('\n')}`);
    if (o.rig || o.team) {
      vs = vs.replace(
        '#include <color_vertex>',
        /* glsl */ `
        vColor = vec4(1.0);
        #ifdef USE_COLOR
          vColor.rgb = color;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vColor.rgb = mix(vColor.rgb, vColor.rgb * instanceColor.rgb, step(0.5, aTeam) * step(aTeam, 1.5));
        #endif
        vGlow = step(1.5, aTeam);
        {
          // Warm lights (fire, windows, torches) flutter, each on its own beat by where it stands.
          vec4 fp = vec4(0.0, 0.0, 0.0, 1.0);
          #ifdef USE_INSTANCING
            fp = instanceMatrix * fp;
          #endif
          float warm = step(vColor.b * 1.4, vColor.r);
          float ph = fp.x * 1.7 + fp.z * 2.3 + position.x * 9.0 + position.z * 7.0;
          float fl = 0.5 + 0.5 * sin(uTime * 9.0 + ph) * sin(uTime * 5.3 + ph * 1.9);
          vGlow *= 1.0 - warm * 0.35 * fl;
        }
        `,
      );
    }
    let begin = '#include <begin_vertex>';
    if (o.rig) {
      begin += /* glsl */ `
        {
          float ang = 0.0;
          if (aRig.x > 0.5 && aRig.x < 1.5) ang = aAnim.x;
          else if (aRig.x > 1.5 && aRig.x < 2.5) ang = -aAnim.x;
          else if (aRig.x > 2.5 && aRig.x < 3.5) ang = aAnim.y;
          if (ang != 0.0) {
            vec2 p = transformed.yz - aRig.yz;
            float c = cos(ang);
            float s = sin(ang);
            transformed.yz = aRig.yz + vec2(p.x * c - p.y * s, p.x * s + p.y * c);
          }
          transformed.y += aAnim.z;
        }
      `;
    }
    if (o.flag) {
      begin += /* glsl */ `
        if (aRig.x > 3.5) {
          // Cloth: aRig.y is its length along z from the anchor aRig.z (negative when it runs the other way).
          float f = clamp((transformed.z - aRig.z) / aRig.y, 0.0, 1.0);
          float speed = length(uWind);
          vec3 lw = vec3(uWind.x, 0.0, uWind.y);
          lw = vec3(dot(modelMatrix[0].xyz, lw), dot(modelMatrix[1].xyz, lw), dot(modelMatrix[2].xyz, lw));
          #ifdef USE_INSTANCING
            lw = vec3(dot(instanceMatrix[0].xyz, lw), dot(instanceMatrix[1].xyz, lw), dot(instanceMatrix[2].xyz, lw));
          #endif
          vec2 dir = normalize(lw.xz + vec2(0.0001));
          float run = (transformed.z - aRig.z);
          float m = min(1.0, speed * 2.2);
          // Swing from hanging toward the wind's line, further the harder it blows.
          transformed.xz += (dir * abs(run) - vec2(0.0, run)) * m;
          vec4 fw = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          #ifdef USE_INSTANCING
            fw = modelMatrix * (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0));
          #endif
          float ph = uTime * (2.5 + speed * 9.0) - f * 5.0 + fw.x * 0.9 + fw.z * 1.3;
          transformed.y += sin(ph) * f * (0.01 + 0.05 * m) - (1.0 - m) * f * 0.1 * abs(aRig.y);
          transformed.xz += vec2(-dir.y, dir.x) * sin(ph * 1.3 + 1.0) * f * 0.04 * m;
        }
      `;
    }
    if (o.sway) {
      begin += /* glsl */ `
        {
          vec4 sw = vec4(0.0, 0.0, 0.0, 1.0);
          #ifdef USE_INSTANCING
            sw = instanceMatrix * sw;
          #endif
          float k = max(transformed.y, 0.0) * ${o.sway.toFixed(3)};
          float t = uTime * 1.3 + sw.x * 0.37 + sw.z * 0.23;
          transformed.x += sin(t) * k;
          transformed.z += cos(t * 0.8 + 1.7) * k * 0.6;
        }
      `;
    }
    vs = vs.replace('#include <begin_vertex>', begin);
    if (o.fog !== false) vs = vs.replace('#include <project_vertex>', `#include <project_vertex>\n${FOG_VERTEX}`);
    shader.vertexShader = vs;

    const parsF: string[] = [];
    if (o.fog !== false) parsF.push(FOG_PARS_FRAGMENT);
    if (o.rig || o.team) parsF.push('varying float vGlow;\nuniform float uGlow;');
    fs = fs.replace('#include <common>', `#include <common>\n${parsF.join('\n')}`);
    let tail = '#include <opaque_fragment>';
    if (o.rig || o.team) tail += '\n  gl_FragColor.rgb += diffuseColor.rgb * vGlow * uGlow;';
    if (o.fog !== false) tail += `\n${FOG_FRAGMENT}`;
    fs = fs.replace('#include <opaque_fragment>', tail);
    shader.fragmentShader = fs;
  };
  const key = `${o.rig ? 'r' : ''}${o.flag ? 'w' : ''}${o.team ? 't' : ''}${o.fog === false ? '' : 'f'}${o.sway ?? ''}`;
  const prevKey = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|${key}`;
  return mat;
}

/** Everything baked: vertex colors, faceted, with fog of war and glowing parts. */
export const bakedMaterial = inject(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 }), { team: true, flag: true });
/** Units: team colors, swinging limbs, fog of war. */
export const unitMaterial = inject(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 }), { rig: true, team: true });
/** Trees and crops sway a little in the wind. */
export const swayMaterial = inject(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }), { team: true, sway: 0.03 });
