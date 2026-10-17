import * as THREE from 'three';
import type { GameState, LandmarkKind } from '../sim/types';

/**
 * First sight (wonder): the moment a scout's eyes first fall on a ruin, a relic or a landmark. The
 * land is already drawn there; this adds the reveal: a pillar of light that fades over a few seconds,
 * and a line of lore for the HUD. Purely a view of what the player has seen, so the rules never know.
 */

export interface Sighting {
  what: 'ruin' | 'relic' | LandmarkKind;
  key: string;
  x: number;
  y: number;
}

/** What each find looks like when first seen: the title, a line of lore, and the colour of its light. */
export const SIGHT_LORE: Record<Sighting['what'], { title: string; lore: string; color: string }> = {
  ruin: { title: 'Ancient ruins', lore: 'Columns of a people older than any you know, leaning in the grass. Something may lie beneath.', color: '#d9c7ff' },
  relic: { title: 'A gilded relic', lore: 'Something holy was left here, and it still shines. A priest could carry it home.', color: '#ffe08a' },
  spring: { title: 'A Sacred Spring', lore: 'The water runs warm and clear, and the wounded say they sleep well beside it.', color: '#8fe3ff' },
  crag: { title: 'A Lookout Crag', lore: 'From its top a whole country lies open, and anyone who walks it.', color: '#ffd7a0' },
  cairn: { title: "The Ancestors' Cairn", lore: 'Stone on stone, each placed by a hand long gone. The dead keep a room for the living.', color: '#c9d4ff' },
  grove: { title: 'A Sacred Grove', lore: 'The trees here grow in a ring, and the birds go quiet as you come near.', color: '#9dffb0' },
  ford: { title: 'The Old Ford', lore: 'Every road in the country was laid to reach this crossing.', color: '#a8dcff' },
  flint: { title: 'A Flint Scatter', lore: 'Bright chips glitter on the ground: someone knapped a thousand blades here.', color: '#ffd0e0' },
};

const PILLAR_LIFE = 7;
const MAX_PILLARS = 6;

export class Sightings {
  readonly group = new THREE.Group();
  private known = new Set<string>();
  private pillars: { mesh: THREE.Mesh; age: number }[] = [];
  private free: THREE.Mesh[] = [];

  /** Forget everything and mark what is already seen as old news (a new match, a loaded save). */
  reset(s: GameState, seen: (x: number, y: number) => boolean): void {
    for (const p of this.pillars) this.release(p.mesh);
    this.pillars.length = 0;
    this.known.clear();
    this.scan(s, seen);
  }

  /** Newly sighted finds since the last call. */
  scan(s: GameState, seen: (x: number, y: number) => boolean): Sighting[] {
    const fresh: Sighting[] = [];
    const check = (key: string, what: Sighting['what'], x: number, y: number): void => {
      if (this.known.has(key) || !seen(x, y)) return;
      this.known.add(key);
      fresh.push({ what, key, x, y });
    };
    for (const r of s.ruins ?? []) if (r.by < 0) check(`r${r.id}`, 'ruin', r.x, r.y);
    for (const m of s.landmarks ?? []) check(`l${m.id}`, m.kind, m.x, m.y);
    for (const r of s.relics) if (!r.carrier && !r.temple) check(`x${r.id}`, 'relic', r.x, r.y);
    return fresh;
  }

  /** Raise a pillar of light at a point on the ground. */
  raise(at: THREE.Vector3, color: string): void {
    if (this.pillars.length >= MAX_PILLARS) this.release(this.pillars.shift()!.mesh);
    const mesh = this.free.pop() ?? this.make();
    (mesh.material as THREE.MeshBasicMaterial).color.set(color);
    mesh.position.copy(at);
    mesh.visible = true;
    this.pillars.push({ mesh, age: 0 });
  }

  update(dt: number): void {
    for (let i = this.pillars.length - 1; i >= 0; i--) {
      const p = this.pillars[i];
      p.age += dt;
      const t = p.age / PILLAR_LIFE;
      if (t >= 1) {
        this.release(p.mesh);
        this.pillars.splice(i, 1);
        continue;
      }
      // Leaps up, holds a breath, then thins away.
      const grow = Math.min(1, p.age / 0.6);
      const fade = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.7;
      const pulse = 0.9 + 0.1 * Math.sin(p.age * 5);
      p.mesh.scale.set((1 - t * 0.6) * pulse, grow, (1 - t * 0.6) * pulse);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.42 * fade * fade;
    }
  }

  private release(mesh: THREE.Mesh): void {
    mesh.visible = false;
    this.free.push(mesh);
  }

  private make(): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(0.12, 0.45, 9, 8, 1, true);
    geo.translate(0, 4.5, 0);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    return mesh;
  }
}
