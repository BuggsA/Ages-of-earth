import * as THREE from 'three';
import { seasonUniforms } from './seasonLook';

/**
 * Shared materials and the shader additions every object in the world gets:
 *  - fog of war: a small texture of what the player sees (red) and has seen (green) darkens and greys
 *    what lies outside their sight, and hides the unexplored under a deep slate;
 *  - team colors and glowing parts, from the baked `aTeam` attribute (1 tints by the instance color,
 *    2 glows);
 *  - limbs: vertices tagged with a limb group swing about their pivot by the per-instance `aAnim`
 *    angles (legs walk, an arm strikes or chops), so instanced armies animate without skeletons;
 *  - the season (`seasonLook.ts`): meadows and leaves recolor through the year, and snow lies on what faces up.
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

const SEASON_PARS_VERTEX = /* glsl */ `
  varying vec2 vSeasonPos;
  varying vec2 vSeasonRoot;
  varying float vSeasonY;
  varying float vSeasonBare;
`;

/** Where the fragment lies in the world, where its tree stands (one autumn color a tree), and its height in the model. */
const SEASON_VERTEX = (team: boolean) => /* glsl */ `
  {
    vec4 sp = vec4(transformed, 1.0);
    vec4 sr = vec4(0.0, 0.0, 0.0, 1.0);
    #ifdef USE_INSTANCING
      sp = instanceMatrix * sp;
      sr = instanceMatrix * sr;
    #endif
    sp = modelMatrix * sp;
    sr = modelMatrix * sr;
    vSeasonPos = sp.xz;
    vSeasonRoot = sr.xz;
    vSeasonY = position.y;
    // Team colors and lights stay clear of snow, so a town can still be told by its colors.
    vSeasonBare = ${team ? 'step(0.5, aTeam)' : '0.0'};
  }
`;

const SEASON_PARS_FRAGMENT = /* glsl */ `
  uniform vec4 uSeason;
  uniform float uSnow;
  varying vec2 vSeasonPos;
  varying vec2 vSeasonRoot;
  varying float vSeasonY;
  varying float vSeasonBare;
  float seasonHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
`;

/**
 * Recolor what's green by the season (colors here are linear). Grass and low plants go gold in summer, ochre in
 * autumn and frosted in winter; broadleaf crowns (redder than they are blue, and high in the model) turn orange,
 * red or gold in autumn, a few late, and go bare in winter; evergreens (bluer) only darken.
 */
const SEASON_COLOR = (leaf: boolean) => /* glsl */ `
  {
    vec3 c = diffuseColor.rgb;
    float green = smoothstep(0.02, 0.1, c.g - max(c.r, c.b));
    if (green > 0.0) {
      float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float leafy = ${leaf ? 'smoothstep(0.38, 0.5, vSeasonY)' : '0.0'};
      float decid = leafy * step(c.b, c.r);
      float ever = leafy - decid;
      float grass = 1.0 - leafy;
      float h = seasonHash(floor(vSeasonRoot * 3.0 + 0.5));
      float k = clamp(lum / 0.25, 0.6, 1.3);
      vec3 fall = h < 0.12 ? c : h < 0.45 ? vec3(0.69, 0.17, 0.015) : h < 0.7 ? vec3(0.39, 0.035, 0.013) : vec3(0.71, 0.39, 0.035);
      vec3 spring = grass * c * vec3(0.9, 1.08, 0.9) + decid * c * vec3(0.85, 1.1, 0.85) + ever * c;
      vec3 summer = grass * mix(c, vec3(lum * 1.35, lum * 1.1, lum * 0.35), 0.45) + decid * c * vec3(0.95, 0.95, 0.85) + ever * c;
      vec3 autumn = grass * mix(c, vec3(lum * 1.4, lum * 0.95, lum * 0.3), 0.6) + decid * mix(c, fall * k, 0.85) + ever * c;
      vec3 winter = grass * mix(c, vec3(lum * 1.05, lum * 1.1, lum * 1.2), 0.65) + decid * mix(c, vec3(lum * 0.9, lum * 0.72, lum * 0.55), 0.85) + ever * c * vec3(0.85, 0.9, 0.95);
      vec3 seasoned = spring * uSeason.x + summer * uSeason.y + autumn * uSeason.z + winter * uSeason.w;
      diffuseColor.rgb = mix(c, seasoned, green);
    }
  }
`;

/**
 * Snow on whatever faces the sky, patchy as it settles and melts. On the ground some patches stay bare even in
 * deep winter; on models only the flattest tops take it, so stone and ore still read by their sides.
 */
const SEASON_SNOW = (ground: boolean) => /* glsl */ `
  if (uSnow > 0.0) {
    vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    float up = dot(normal, upV);
    float n = seasonHash(floor(vSeasonPos * 1.5)) * 0.6 + seasonHash(floor(vSeasonPos * 4.0)) * 0.4;
    float cover = ${ground ? 'smoothstep(0.35, 0.75, up) * smoothstep(n - 0.05, n + 0.05, uSnow * 0.85)' : 'smoothstep(0.6, 0.9, up) * smoothstep(n - 0.05, n + 0.05, uSnow) * 0.85'};
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.74, 0.78, 0.86), cover * (1.0 - vSeasonBare));
  }
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
  /** Show the season: `ground` recolors meadows, `leaf` also leaves, `snow` only lays snow. */
  season?: 'ground' | 'leaf' | 'snow';
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
    if (o.season) Object.assign(shader.uniforms, seasonUniforms);
    let vs = shader.vertexShader;
    let fs = shader.fragmentShader;
    const parsV: string[] = [];
    if (o.fog !== false) parsV.push(FOG_PARS_VERTEX);
    if (o.rig || o.team) parsV.push('attribute float aTeam;\nvarying float vGlow;');
    if (o.rig) parsV.push('attribute vec3 aRig;\nattribute vec3 aAnim;');
    else if (o.flag) parsV.push('attribute vec3 aRig;');
    if (o.flag) parsV.push('uniform vec2 uWind;');
    if (o.sway || o.rig || o.team) parsV.push('uniform float uTime;');
    if (o.season) parsV.push(SEASON_PARS_VERTEX);
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
        if (aRig.x > 3.5 && aRig.x < 4.5) {
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
    if (o.flag) {
      begin += /* glsl */ `
        if (aRig.x >= 5.0) {
          // A square sail: aRig.x - 5 is its height, aRig.y half its width, aRig.z its foot and centre x.
          float sh = max(aRig.x - 5.0, 0.01);
          // aRig.z packs the foot with the sail's centre x: 100 * (20 * x + 200) + foot.
          float cxq = floor((aRig.z + 50.0) / 100.0);
          float cx = (cxq - 200.0) / 20.0;
          float foot = aRig.z - cxq * 100.0;
          float u = clamp((transformed.x - cx) / max(aRig.y, 0.01), -1.0, 1.0);
          float v = clamp((transformed.y - foot) / sh, 0.0, 1.0);
          float speed = min(1.0, length(uWind) * 2.2);
          vec4 sp = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          #ifdef USE_INSTANCING
            sp = modelMatrix * (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0));
          #endif
          float breathe = sin(uTime * (1.4 + speed * 2.0) + sp.x * 0.8 + sp.z * 1.1);
          // The cloth fills like a belly: deepest mid-sail, pinned to the yard and the corners.
          float belly = (1.0 - u * u) * sin(v * 3.14159) * (0.5 + 0.5 * v);
          transformed.z += belly * aRig.y * (0.3 + 0.5 * speed + 0.1 * breathe * speed);
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
    if (o.season) vs = vs.replace('#include <project_vertex>', `#include <project_vertex>\n${SEASON_VERTEX(!!(o.rig || o.team))}`);
    shader.vertexShader = vs;

    const parsF: string[] = [];
    if (o.fog !== false) parsF.push(FOG_PARS_FRAGMENT);
    if (o.rig || o.team) parsF.push('varying float vGlow;\nuniform float uGlow;');
    if (o.season) parsF.push(SEASON_PARS_FRAGMENT);
    fs = fs.replace('#include <common>', `#include <common>\n${parsF.join('\n')}`);
    if (o.season && o.season !== 'snow') fs = fs.replace('#include <color_fragment>', `#include <color_fragment>\n${SEASON_COLOR(o.season === 'leaf')}`);
    if (o.season) fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${SEASON_SNOW(o.season === 'ground')}`);
    let tail = '#include <opaque_fragment>';
    if (o.rig || o.team) tail += '\n  gl_FragColor.rgb += diffuseColor.rgb * vGlow * uGlow;';
    if (o.fog !== false) tail += `\n${FOG_FRAGMENT}`;
    fs = fs.replace('#include <opaque_fragment>', tail);
    shader.fragmentShader = fs;
  };
  const key = `${o.rig ? 'r' : ''}${o.flag ? 'w' : ''}${o.team ? 't' : ''}${o.fog === false ? '' : 'f'}${o.sway ?? ''}${o.season ?? ''}`;
  const prevKey = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|${key}`;
  return mat;
}

/** Everything baked: vertex colors, faceted, with fog of war and glowing parts. */
export const bakedMaterial = inject(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 }), { team: true, flag: true, season: 'snow' });
/** Units: team colors, swinging limbs, fog of war. */
export const unitMaterial = inject(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 }), { rig: true, team: true, flag: true });
/** Trees and crops sway a little in the wind. */
export const swayMaterial = inject(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }), { team: true, sway: 0.03, season: 'leaf' });
