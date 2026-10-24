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

/**
 * A Cockler's Hut (#779): a low hut of grey driftwood planks with a thatched roof, raised on short posts against the spring tides; a
 * door toward the beds, baskets of cockles stacked by it (pale shells heaped in them), a long-tined rake leaned on the wall, a net
 * hung to dry on two poles, a lantern on its post for the night tide, and the owner's colour on a strip of cloth at the ridge.
 */
export function cocklerHut(k: Kit, base: string): void {
  k.box(1.9, 0.06, 1.9, base, 0, -0.02, 0);
  // Posts and a plank floor.
  for (const [x, z] of [[-0.55, -0.4], [0.55, -0.4], [-0.55, 0.45], [0.55, 0.45]]) k.cyl(0.05, 0.06, 0.24, 4, '#5d4a37', x, 0.0, z);
  k.box(1.3, 0.06, 1.0, '#8a7a66', 0, 0.2, 0.02);
  // Driftwood walls: planks of greys and browns, a door toward the sea (−z) and a small window lit within.
  for (let i = 0; i < 6; i++) k.box(0.2, 0.6, 0.9, ['#9b968c', '#857e72', '#a8a091'][i % 3], -0.5 + i * 0.2, 0.26, 0.02);
  k.box(0.26, 0.42, 0.03, '#3d2f24', 0.15, 0.26, -0.45);
  k.box(0.14, 0.12, 0.03, '#ffc46b', -0.32, 0.52, -0.45);
  // The thatch, shaggy at the eaves.
  const roof = k.prism(1.12, 0.5, 1.42, '#b59a5c', 0, 0.86, 0.02);
  roof.rotation.y = Math.PI / 2;
  k.box(0.08, 0.05, 1.16, '#8f7845', 0, 1.32, 0.02);
  // Baskets of cockles by the door, pale shells heaped in them.
  for (const [x, z] of [[-0.62, -0.72], [-0.36, -0.8], [-0.5, -0.52]]) {
    k.cyl(0.13, 0.1, 0.16, 6, '#8c6a3c', x, 0.02, z);
    k.blob(0.1, '#e8e0cc', x, 0.15, z).scale.set(1, 0.45, 1);
  }
  // A cockle rake leaned on the wall: a long handle and its tines.
  const rake = k.group(0.68, 0.0, -0.48);
  rake.rotation.z = -0.35;
  k.cyl(0.015, 0.015, 0.9, 3, WOOD, 0, 0.45, 0, rake);
  k.box(0.22, 0.03, 0.03, '#6f6a62', 0, 0.02, 0, rake);
  // A net hung to dry between two poles.
  for (const x of [0.38, 0.86]) k.cyl(0.02, 0.02, 0.7, 3, WOOD, x, 0.3, 0.75);
  k.box(0.46, 0.34, 0.01, '#6e7b6a', 0.62, 0.42, 0.75);
  // The lantern for the night tide.
  k.cyl(0.02, 0.02, 0.8, 3, WOOD, -0.82, 0.38, 0.6);
  k.box(0.08, 0.1, 0.08, '#ffc46b', -0.82, 0.82, 0.6);
  // The owner's colour, a strip of cloth at the ridge.
  k.team(k.box(0.02, 0.12, 0.24, TEAM, 0, 1.36, 0.4));
  k.team(k.box(1.98, 0.1, 1.98, TEAM, 0, -0.07, 0));
}

/**
 * A Tide Gate (#785), set in a barrage's causeway: two stone piers on a paved sill, a lintel walkway between them, and a pair of mitred
 * timber leaves that meet in a V pointing out to sea, as a tide mill's pond gates do; a capstan on the walkway, a tide gauge board on the
 * pond side painted in bands, and the owner's colour on a pennant. Open (`variant` ≥ 16): the leaves swung back flat to the piers and
 * white water pouring through. The low bits are the causeway's arms (as a wall's): the gate faces across the line it is set in.
 */
export function tideGate(k: Kit, variant: number): void {
  const open = variant >= 16;
  const mask = variant & 15;
  const g = k.group();
  // Across the line the causeway runs: along x unless it meets the gate from north or south.
  if (!(mask & 5) && mask & 10) g.rotation.y = Math.PI / 2;
  const PAVE = '#b8ad96';
  // The sill and the causeway's paving running on to either side.
  k.box(1.0, 0.5, 1.0, '#8f8574', 0, -0.28, 0, g);
  for (const side of [-1, 1]) k.box(0.2, 0.06, 0.8, PAVE, side * 0.42, 0.0, 0, g);
  // Two stone piers, cut-waters toward the sea (−z), and the lintel walkway on top.
  for (const side of [-1, 1]) {
    k.box(0.26, 1.15, 0.7, STONE, side * 0.36, 0.3, 0, g);
    k.prism(0.26, 0.3, 0.26, STONE, side * 0.36, 0.3, -0.45, g).rotation.x = Math.PI / 2;
    k.box(0.3, 0.06, 0.74, '#8d877b', side * 0.36, 0.9, 0, g);
  }
  k.box(1.0, 0.08, 0.34, WOOD, 0, 0.94, 0.12, g);
  for (const side of [-1, 1]) k.box(1.0, 0.12, 0.03, '#5b4330', 0, 1.04, 0.12 + side * 0.16, g);
  // The capstan that winds the leaves.
  k.cyl(0.07, 0.09, 0.22, 6, '#5b4330', 0, 1.08, 0.12, g);
  for (const a of [0, Math.PI / 2]) k.box(0.42, 0.03, 0.03, WOOD, 0, 1.18, 0.12, g).rotation.y = a;
  // The leaves: shut, they meet in a V out to sea; open, they lie back against the piers.
  for (const side of [-1, 1]) {
    const leaf = k.group(side * 0.23, 0.18, 0.02, g);
    leaf.rotation.y = open ? side * 1.45 : side * -0.35;
    k.box(0.26, 0.6, 0.06, '#6b4b2f', -side * 0.13, 0, 0, leaf);
    for (const y of [-0.2, 0.05, 0.25]) k.box(0.27, 0.04, 0.07, '#4a4d52', -side * 0.13, y, 0, leaf);
  }
  // The tide gauge on the pond side (+z): bands of white and red to read the head of water by.
  k.box(0.08, 0.7, 0.03, '#f2efe6', 0.3, 0.28, 0.38, g);
  for (const y of [0.05, 0.25, 0.45]) k.box(0.085, 0.07, 0.035, '#a8372f', 0.3, y, 0.38, g);
  // Open: the pond pouring through the gap, white water spreading out below it.
  if (open) {
    k.box(0.42, 0.05, 0.9, '#e6f1f2', 0, 0.02, -0.1, g);
    k.box(0.8, 0.04, 0.4, '#cfe3e6', 0, -0.01, -0.62, g);
    for (let i = 0; i < 4; i++) k.blob(0.07, '#ffffff', -0.24 + i * 0.16, 0.07, -0.55 - (i % 2) * 0.12, g).scale.set(1, 0.5, 1);
  }
  // The owner's colour on a pennant over the walkway.
  k.cyl(0.015, 0.015, 0.5, 3, WOOD, -0.36, 1.18, 0.3, g);
  k.team(k.box(0.02, 0.1, 0.2, TEAM, -0.36, 1.36, 0.4, g));
}
