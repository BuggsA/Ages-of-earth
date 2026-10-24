import * as THREE from 'three';
import { BUILDINGS, INTERCEPT, LIGHTNING, SORTIE, type UnitStats } from '../sim/data';
import { ageDef, hasCoils } from '../sim/ages';
import { gunRange, statsFor } from '../sim/stats';
import type { Building, BuildingType, Ent, GameState } from '../sim/types';
import { heightAt } from './terrain';
import { WATER_Y } from './water';

/** Presentation limits, not balance: one draw call and reusable buffers even for a large army. */
export const MAX_RANGE_GUIDES = 24;
const SEGMENTS = 128;
const LIFT = 0.08;
/** Lines are 1 px in WebGL; two flanking rings (tiles off the reach, dimmer) make each guide a ~3 px band that reads on grass (#626). */
const FLANK = 0.07;
const FLANK_DIM = 0.6;
const RINGS = 3;
const OUTER = new THREE.Color('#a9e9ff');
const INNER = new THREE.Color('#ffd166');
const FIELD = new THREE.Color('#9fb8ff');
const COVER = new THREE.Color('#6ef0d0');
const BANDS = { rearm: new THREE.Color('#8dff9a'), turn: new THREE.Color('#ffd166'), reach: new THREE.Color('#ff6a5a') };

export interface RangeGuide {
  x: number;
  y: number;
  reach: number;
  minimum: number;
  /** A coil's field (the Age of Lightning, #239): drawn in blue-white, not the weapon colour. */
  field?: boolean;
  /** A fuel band round an Airfield (the Age of Aeronauts, #356): green mended, amber turns home, red burns. */
  band?: 'rearm' | 'turn' | 'reach';
  /** An Interceptor Battery's cover (#759 s2): drawn in pale teal, and through the fog, as the battery itself is. */
  cover?: boolean;
}

function unitReach(st: UnitStats): Pick<RangeGuide, 'reach' | 'minimum'> | null {
  if (!st.shot || st.attack <= 0 || st.range <= 0) return null;
  // Combat measures from the attacker's edge to the target's edge. This reference circle
  // is where a target's NEAR EDGE can be reached; its center may be farther away.
  return { reach: st.range + st.radius, minimum: st.minRange ? st.minRange + st.radius : 0 };
}

/** Only inspect the viewer's own, living, exposed selections. Never read a rival's private stats. */
export function selectedRange(s: GameState, viewer: number, e: Ent): RangeGuide | null {
  if (e.owner !== viewer || e.hp <= 0) return null;
  if (e.kind === 'unit') {
    if (e.inside) return null;
    const reach = unitReach(statsFor(s, viewer, e.type));
    return reach ? { x: e.x, y: e.y, ...reach } : null;
  }
  if (!e.built) return null;
  return BUILDINGS[e.type].guns ? { x: e.x, y: e.y, reach: gunRange(s, e.owner, e.type, e.level) + e.size / 2, minimum: 0 } : null;
}

/** A defense's future reach, including this player's researched range. */
export function placementRange(s: GameState, viewer: number, type: BuildingType, tx: number, ty: number): RangeGuide | null {
  const def = BUILDINGS[type];
  return def.guns ? {
    x: tx + def.size / 2, y: ty + def.size / 2,
    reach: gunRange(s, viewer, type) + def.size / 2, minimum: 0,
  } : null;
}

/** The reach of each of the viewer's finished, standing Coil Towers, while they are in the Age of Lightning. */
export function coilFields(s: GameState, viewer: number): RangeGuide[] {
  if (!hasCoils(s.players[viewer])) return [];
  const out: RangeGuide[] = [];
  for (const e of s.ents) {
    if (e.kind === 'building' && e.type === 'tower' && e.owner === viewer && e.built && e.hp > 0) {
      out.push({ x: e.x, y: e.y, reach: LIGHTNING.reach, minimum: 0, field: true });
    }
  }
  return out;
}

/**
 * Where the viewer's aircraft are mended, turned home and burned (`SORTIE`, `sortie.ts`): three rings round each
 * finished Airfield of theirs, nearest `max` to `near` so a big air base cannot crowd out the other guides.
 */
export function sortieRings(s: GameState, viewer: number, near: { x: number; y: number }, max = 3): RangeGuide[] {
  if (!ageDef(s.players[viewer]).sortie) return [];
  const fields: Building[] = [];
  for (const e of s.ents) if (e.kind === 'building' && e.type === 'airfield' && e.owner === viewer && e.built && e.hp > 0) fields.push(e);
  const d2 = (b: Building) => (b.x - near.x) * (b.x - near.x) + (b.y - near.y) * (b.y - near.y);
  fields.sort((a, b) => d2(a) - d2(b) || a.id - b.id);
  const out: RangeGuide[] = [];
  for (const b of fields.slice(0, max)) {
    out.push({ x: b.x, y: b.y, reach: SORTIE.rearm, minimum: 0, band: 'rearm' });
    out.push({ x: b.x, y: b.y, reach: SORTIE.turn, minimum: 0, band: 'turn' });
    out.push({ x: b.x, y: b.y, reach: SORTIE.reach, minimum: 0, band: 'reach' });
  }
  return out;
}

/**
 * The cover of every finished, standing Interceptor Battery, whoever's (#759 s2): batteries are seen by all, so is their reach. With `at`,
 * a battery about to be raised there by the viewer too.
 */
export function coverRings(s: GameState, at?: { tx: number; ty: number } | null): RangeGuide[] {
  const out: RangeGuide[] = [];
  if (at) out.push({ x: at.tx + BUILDINGS.battery.size / 2, y: at.ty + BUILDINGS.battery.size / 2, reach: INTERCEPT.reach, minimum: 0, cover: true });
  for (const e of s.ents) if (e.kind === 'building' && e.type === 'battery' && e.built && e.hp > 0) out.push({ x: e.x, y: e.y, reach: INTERCEPT.reach, minimum: 0, cover: true });
  return out;
}

/** The field a Watch Tower about to be raised would add, in the Age of Lightning. */
export function placementField(s: GameState, viewer: number, type: BuildingType, tx: number, ty: number): RangeGuide | null {
  if (type !== 'tower' || !hasCoils(s.players[viewer])) return null;
  const size = BUILDINGS[type].size;
  return { x: tx + size / 2, y: ty + size / 2, reach: LIGHTNING.reach, minimum: 0, field: true };
}

/** Terrain-following weapon guides: solid outer reach, broken inner dead zone. */
export class RangeGuides {
  readonly mesh: THREE.LineSegments;
  private positions = new THREE.BufferAttribute(new Float32Array(MAX_RANGE_GUIDES * SEGMENTS * 2 * RINGS * 2 * 3), 3);
  private colors = new THREE.BufferAttribute(new Float32Array(MAX_RANGE_GUIDES * SEGMENTS * 2 * RINGS * 2 * 3), 3);

  constructor() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.positions.setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', this.colors.setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    this.mesh = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, fog: false, toneMapped: false,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
  }

  update(s: GameState, guides: readonly RangeGuide[], visible: (x: number, y: number) => boolean): void {
    let n = 0;
    const open = (x: number, y: number) => x >= 0 && y >= 0 && x < s.w && y < s.h && visible(x, y);
    for (const g of guides.slice(0, MAX_RANGE_GUIDES)) {
      for (const minimum of [false, true]) {
        const base = minimum ? g.minimum : g.reach;
        if (!(base > 0)) continue;
        const color = g.band ? BANDS[g.band] : g.cover ? COVER : g.field ? FIELD : minimum ? INNER : OUTER;
        const seen = g.cover ? (x: number, y: number) => x >= 0 && y >= 0 && x < s.w && y < s.h : open;
        for (let ring = 0; ring < RINGS; ring++) {
          const radius = Math.max(0.01, base + (ring - 1) * FLANK);
          const k = ring === 1 ? 1 : FLANK_DIM;
          for (let i = 0; i < SEGMENTS; i++) {
            if (minimum && i % 4 >= 2) continue;
            const a = i * Math.PI * 2 / SEGMENTS;
            const b = (i + 1) * Math.PI * 2 / SEGMENTS;
            const x0 = g.x + Math.cos(a) * radius;
            const y0 = g.y + Math.sin(a) * radius;
            const x1 = g.x + Math.cos(b) * radius;
            const y1 = g.y + Math.sin(b) * radius;
            // Test the midpoint too: don't bridge a hidden tile between two visible endpoints.
            if (!seen(x0, y0) || !seen(x1, y1) || !seen((x0 + x1) / 2, (y0 + y1) / 2)) continue;
            for (const [x, y] of [[x0, y0], [x1, y1]]) {
              this.positions.setXYZ(n, x, Math.max(WATER_Y, heightAt(s, x, y)) + LIFT, y);
              this.colors.setXYZ(n++, color.r * k, color.g * k, color.b * k);
            }
          }
        }
      }
    }
    this.mesh.geometry.setDrawRange(0, n);
    if (n) {
      this.positions.needsUpdate = true;
      this.colors.needsUpdate = true;
    }
  }
}
