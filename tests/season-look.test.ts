import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SEASON, TICK_HZ } from '../src/sim/data';
import { seasonUniform, swayMaterial } from '../src/render/materials';
import { terrainMaterial } from '../src/render/terrain';
import { TURN_FROM, paintSeason, seasonLookAt } from '../src/render/seasonLook';

const LEN = SEASON.len * TICK_HZ;
const at = (season: number, frac: number) => Math.round((season + frac) * LEN);

describe('the land shows the season (#185)', () => {
  it('opens in a fresh spring and wears each season fully in its middle', () => {
    expect(seasonLookAt(0)).toEqual({ fresh: 1, autumn: 0, winter: 0 });
    expect(seasonLookAt(at(1, 0.5))).toEqual({ fresh: 0, autumn: 0, winter: 0 });
    expect(seasonLookAt(at(2, 0.5))).toEqual({ fresh: 0, autumn: 1, winter: 0 });
    expect(seasonLookAt(at(3, 0.5)).winter).toBe(1);
    // The year comes round again.
    expect(seasonLookAt(at(4, 0.5))).toEqual(seasonLookAt(at(0, 0.5)));
  });

  it('turns smoothly, with no jump from one tick to the next over two years', () => {
    let prev = seasonLookAt(0);
    let most = 0;
    for (let t = 1; t < LEN * 8; t++) {
      const l = seasonLookAt(t);
      most = Math.max(most, Math.abs(l.fresh - prev.fresh), Math.abs(l.autumn - prev.autumn), Math.abs(l.winter - prev.winter));
      prev = l;
    }
    expect(most).toBeLessThan(0.01);
  });

  it('shows autumn coming in late summer, but not before the turn begins', () => {
    expect(seasonLookAt(at(1, TURN_FROM - 0.01)).autumn).toBe(0);
    expect(seasonLookAt(at(1, 0.95)).autumn).toBeGreaterThan(0.2);
    expect(seasonLookAt(at(2, 0)).autumn).toBeGreaterThan(0.4);
  });

  it('pins a season when forced, and paints the shared uniform', () => {
    expect(seasonLookAt(0, 3).winter).toBe(1);
    paintSeason(at(2, 0.5));
    expect(seasonUniform.value.toArray()).toEqual([0, 1, 0]);
    paintSeason(0);
  });

  it('adds the season to the ground and plant shaders against this three.js version', () => {
    for (const mat of [terrainMaterial, swayMaterial]) {
      const lib = THREE.ShaderLib.physical;
      const shader = { uniforms: THREE.UniformsUtils.clone(lib.uniforms), vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader } as unknown as THREE.WebGLProgramParametersWithUniforms;
      mat.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
      expect(shader.uniforms.uSeason).toBe(seasonUniform);
      expect(shader.vertexShader).toContain('vSeasonPos = sp.xyz');
      expect(shader.fragmentShader).toContain('diffuseColor.rgb = c;');
      expect(shader.fragmentShader.indexOf('diffuseColor.rgb = c;')).toBeGreaterThan(shader.fragmentShader.indexOf('#include <normal_fragment_maps>'));
    }
  });
});
