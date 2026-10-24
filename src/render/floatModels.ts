import { Kit, rnd } from './kit';

/**
 * The Age of Floating Cities' models (#770): the Pontoon, a district on floats, and the same district under tow behind a steam tug.
 * Colours baked into the vertices, as everywhere. The look is the reed islands of Lake Titicaca grown into a town: tarred floats, a
 * planked deck laid over bundled reeds, reed-thatched houses and a lantern mast, the owner's colour on the deck's rail and the awnings.
 */

const TEAM = '#f4f4f4';
const TAR = '#2c2a28';
const PLANK = '#8a6a46';
const DARK = '#5b4330';
const REED = '#c9b06a';
const THATCH = '#b59650';

/** A reed house on a deck: low walls of bundled reed, a steep thatched roof, a dark door and a team-coloured awning. */
function hut(k: Kit, x: number, z: number, turn: number, i: number): void {
  const g = k.group(x, 0.24, z);
  g.rotation.y = turn;
  k.box(0.62, 0.42, 0.5, '#d8c27e', 0, 0, 0, g);
  for (let j = 0; j < 4; j++) k.box(0.63, 0.025, 0.51, '#a98f4f', 0, 0.08 + j * 0.1, 0, g);
  const roof = k.prism(0.6, 0.38, 0.72, THATCH, 0, 0.42, 0, g);
  roof.rotation.y = Math.PI / 2;
  k.box(0.14, 0.24, 0.02, '#3a2b20', 0, 0, 0.26, g);
  k.team(k.box(0.36, 0.03, 0.18, TEAM, 0, 0.3, 0.32, g)).rotation.x = -0.35;
  // A window lit within, on the house's far gable.
  k.box(0.1, 0.1, 0.02, '#ffc46b', 0.18 - (i % 2) * 0.36, 0.2, -0.26, g);
}

/**
 * A Pontoon: three tarred floats under a planked deck edged with reed bundles, two reed houses, a lantern mast with the owner's pennant,
 * bollards at the corners, a coil of mooring rope and a fish rack. Sits on the water line (its group is set at the water by the view).
 */
export function pontoon(k: Kit): void {
  // The floats, low in the water under the deck, running the length of the district, their ends showing at the edges.
  for (const x of [-1.0, 0, 1.0]) {
    k.box(0.5, 0.2, 2.96, TAR, x, -0.14, 0);
    for (const z of [-1.48, 1.48]) k.box(0.42, 0.14, 0.04, '#3a3530', x, -0.1, z);
  }
  // The deck: planks over cross-beams, a little above the water.
  for (const z of [-1.1, 0, 1.1]) k.box(2.94, 0.06, 0.16, DARK, 0, 0.08, z);
  k.box(2.9, 0.08, 2.9, PLANK, 0, 0.14, 0);
  for (let i = 0; i < 9; i++) k.box(0.02, 0.005, 2.86, '#6e5236', -1.3 + i * 0.325, 0.22, 0);
  // Reed bundles along the edges, the old way, bound in short lengths, and the owner's colour on a low rail above them.
  for (let i = 0; i < 8; i++) {
    const t = -1.31 + i * 0.375;
    const c = rnd(i, 3, 7) > 0.5 ? REED : '#b89c58';
    k.box(0.36, 0.13, 0.14, c, t, 0.12, 1.42);
    k.box(0.36, 0.13, 0.14, c, -t, 0.12, -1.42);
    k.box(0.14, 0.13, 0.36, c, 1.42, 0.12, -t);
    k.box(0.14, 0.13, 0.36, c, -1.42, 0.12, t);
  }
  for (const [w, d, x, z] of [
    [2.9, 0.04, 0, 1.45],
    [2.9, 0.04, 0, -1.45],
    [0.04, 2.9, 1.45, 0],
    [0.04, 2.9, -1.45, 0],
  ] as const)
    k.team(k.box(w, 0.04, d, TEAM, x, 0.3, z));
  // Bollards at the corners, a coil of rope by one.
  for (const [x, z] of [
    [1.3, 1.3],
    [-1.3, 1.3],
    [1.3, -1.3],
    [-1.3, -1.3],
  ] as const)
    k.cyl(0.06, 0.07, 0.18, 6, '#3f3a35', x, 0.22, z);
  k.ring(0.12, 0.035, '#c2a874', 0.24).position.set(1.05, 0.25, 1.25);
  // Two reed houses and a fish-drying rack between them.
  hut(k, -0.65, -0.55, 0, 0);
  hut(k, 0.7, 0.45, Math.PI, 1);
  for (const x of [-0.2, 0.3]) k.cyl(0.02, 0.02, 0.5, 4, DARK, x, 0.22, 0.75);
  k.box(0.56, 0.02, 0.02, DARK, 0.05, 0.7, 0.75);
  for (let i = 0; i < 4; i++) k.box(0.05, 0.16, 0.02, '#9aa4a8', -0.12 + i * 0.12, 0.54, 0.75);
  // The lantern mast and the owner's pennant.
  k.cyl(0.03, 0.035, 1.5, 5, DARK, 0.85, 0.22, -0.85);
  k.box(0.12, 0.12, 0.12, '#ffc46b', 0.85, 1.25, -0.85);
  k.team(k.box(0.36, 0.18, 0.02, TEAM, 1.04, 1.5, -0.85));
}

/**
 * A Pontoon under tow (a unit, so its model faces +z): the district's deck and one reed house, riding high behind a small steam tug
 * on a taut line, with a wake of white at the tug's stern.
 */
export function towKit(): Kit {
  const k = new Kit();
  // The district, cut down to its middle: floats, deck, a house.
  const d = k.group(0, 0, -0.25);
  for (const x of [-0.42, 0.42]) k.box(0.24, 0.12, 1.0, TAR, x, -0.08, 0, d);
  k.box(1.0, 0.06, 1.0, PLANK, 0, 0.06, 0, d);
  for (let i = 0; i < 5; i++) k.box(0.015, 0.005, 0.98, '#6e5236', -0.4 + i * 0.2, 0.12, 0, d);
  k.box(0.4, 0.26, 0.32, '#d8c27e', -0.15, 0.12, -0.1, d);
  k.prism(0.38, 0.24, 0.46, THATCH, -0.15, 0.38, -0.1, d).rotation.y = Math.PI / 2;
  k.team(k.box(1.02, 0.03, 1.02, TEAM, 0, 0.12, 0, d));
  k.cyl(0.02, 0.02, 0.8, 4, DARK, 0.3, 0.12, 0.3, d);
  k.team(k.box(0.2, 0.1, 0.015, TEAM, 0.41, 0.82, 0.3, d));
  // The tow line, and the tug: a short black hull, a white wheelhouse and a funnel.
  k.box(0.02, 0.02, 0.5, '#c2a874', 0, 0.12, 0.45);
  const t = k.group(0, 0, 0.9);
  k.box(0.28, 0.14, 0.5, '#26282b', 0, -0.04, 0, t);
  k.box(0.22, 0.03, 0.44, '#7c6a52', 0, 0.1, 0, t);
  k.box(0.18, 0.14, 0.16, '#e8e4da', 0, 0.12, 0.05, t);
  k.cyl(0.04, 0.04, 0.2, 6, '#2f3135', 0, 0.12, -0.12, t);
  k.team(k.cyl(0.042, 0.042, 0.04, 6, TEAM, 0, 0.3, -0.12, t));
  return k;
}
