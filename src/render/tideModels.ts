import * as THREE from 'three';
import { Kit, bake, rnd } from './kit';

/**
 * The Age of Tides' models (#739): the Tide Mill, its undershot wheel (turned on its own, as a windmill's sails are), and a causeway
 * being laid. Colours baked into the vertices, as everywhere.
 */

const TEAM = '#f4f4f4';
const STONE = '#9d978d';
const WOOD = '#6b4b2f';

const cache = new Map<string, THREE.BufferGeometry>();

/**
 * A Tide Mill: a long stone mill house with a slate roof, set on a sluiced stone dam whose arch lets the pond in on the flood and out
 * through the wheel on the ebb; a hoist door under the eaves, a sack hanging, and the owner's colour on a flag over the gable.
 */
export function tidemill(k: Kit, base: string): void {
  k.box(1.9, 0.06, 1.9, base, 0, -0.02, 0);
  // The dam it stands on, with two sluice arches toward the sea (−z).
  k.box(1.9, 0.38, 0.62, STONE, 0, 0, -0.6);
  for (const x of [-0.5, 0.5]) k.box(0.34, 0.24, 0.66, '#3f4a4c', x, 0.0, -0.6);
  for (const x of [-0.5, 0.5]) k.box(0.4, 0.08, 0.04, WOOD, x, 0.25, -0.93);
  // The mill house: rubble stone, a slate roof and gables.
  k.box(1.5, 1.05, 1.0, '#b3a58c', 0, 0.36, 0.25);
  for (let i = 0; i < 7; i++) k.rock(0.06 + rnd(i, 3, 7) * 0.03, '#8f8574', -0.66 + i * 0.22, 0.42 + (i % 3) * 0.24, 0.76);
  const roof = k.prism(1.15, 0.55, 1.62, '#4b5258', 0, 1.41, 0.25);
  roof.rotation.y = Math.PI / 2;
  // A hoist door and its beam, and a sack on the rope.
  k.box(0.32, 0.4, 0.04, '#3a2b20', 0, 0.85, 0.76);
  k.box(0.06, 0.06, 0.4, WOOD, 0, 1.22, 0.92);
  k.cyl(0.006, 0.006, 0.34, 3, '#d8c06a', 0, 0.93, 1.1);
  k.blob(0.09, '#d9cfb0', 0, 0.86, 1.1).scale.set(1, 1.3, 1);
  // Windows, lit within.
  for (const x of [-0.45, 0.45]) k.box(0.14, 0.18, 0.03, '#ffc46b', x, 0.62, 0.76);
  // The wheel's housing on the sea side, and the owner's flag on the far gable.
  k.box(0.08, 0.7, 0.5, STONE, 0.86, 0.0, -0.35);
  k.cyl(0.02, 0.02, 0.8, 4, WOOD, -0.72, 1.3, 0.25);
  k.team(k.box(0.3, 0.18, 0.02, TEAM, -0.56, 1.82, 0.25));
  k.team(k.box(1.98, 0.1, 1.98, TEAM, 0, -0.07, 0));
}

/** Where a Tide Mill's wheel turns, in its model's space: on the sea side of the dam, its axle along x. */
export const WHEEL_HUB = { x: 1.0, y: 0.18, z: -0.35 };

/** A Tide Mill's undershot wheel: a rim and eight paddles round an axle, turning about x. */
export function tideWheel(): THREE.BufferGeometry {
  const key = 'tideWheel';
  let g = cache.get(key);
  if (!g) {
    const k = new Kit();
    k.cyl(0.05, 0.05, 0.3, 6, '#4a3426', 0, -0.15, 0).rotation.z = Math.PI / 2;
    for (const x of [-0.1, 0.1]) {
      const rim = k.ring(0.46, 0.03, WOOD, 0);
      rim.rotation.set(0, Math.PI / 2, 0);
      rim.position.x = x;
    }
    for (let i = 0; i < 8; i++) {
      const arm = k.group();
      arm.rotation.x = (i * Math.PI) / 4;
      k.box(0.04, 0.48, 0.04, WOOD, 0, 0, 0, arm);
      k.box(0.24, 0.14, 0.03, '#7a5f3e', 0, 0.36, 0, arm);
    }
    g = bake(k.root);
    cache.set(key, g);
  }
  return g;
}

/**
 * A causeway being laid (#739): kerb stones and packed rubble on a raw bank, running on toward its neighbours (`mask`, as a wall's), a
 * tamping rammer left on it and the owner's peg. Drawn from below the water so it stands up out of any depth. Once laid it is gone, and
 * the causeway is drawn with the tide (`TidesView`).
 */
export function causewaySite(k: Kit, mask: number): void {
  k.box(0.9, 0.7, 0.9, '#6e5a3e', 0, -0.68, 0);
  k.box(0.8, 0.1, 0.8, '#a59a86', 0, -0.02, 0);
  const ARMS: [number, number, number][] = [[1, 1, 0], [2, 0, 1], [4, -1, 0], [8, 0, -1]];
  for (const [bit, dx, dz] of ARMS) if (mask & bit) k.box(Math.abs(dx) * 0.2 + Math.abs(dz) * 0.8, 0.1, Math.abs(dz) * 0.2 + Math.abs(dx) * 0.8, '#a59a86', dx * 0.4, -0.02, dz * 0.4);
  for (let i = 0; i < 5; i++) k.rock(0.07 + rnd(i, mask, 3) * 0.03, STONE, -0.32 + i * 0.16, 0.05, (i % 2 ? 1 : -1) * 0.36);
  k.cyl(0.02, 0.02, 0.45, 4, '#5b4330', 0.22, 0.04, 0.1).rotation.z = 0.3;
  k.cyl(0.06, 0.06, 0.08, 6, '#5d5a55', 0.16, 0.0, 0.1);
  k.cyl(0.02, 0.02, 0.32, 4, '#5b4330', -0.3, 0.05, -0.3);
  k.team(k.box(0.08, 0.06, 0.04, TEAM, -0.3, 0.32, -0.3));
}
