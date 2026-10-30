import { Kit, rnd } from './kit';

/**
 * The Deep Road's models (#876): the Age of Megaliths' Henge first. Colours baked into the vertices, as everywhere; each age of the
 * road keeps a stone of its own (granite and chalk here), so the road reads as one people going deeper, never one look repeated.
 */

const TEAM = '#f4f4f4';
const SARSEN = '#a7a69c';
const SARSEN_DARK = '#86857c';
const LICHEN = '#b8ad7a';
const TURF = '#5d6b3c';
const CHALK = '#ddd8c8';

/**
 * A Henge: a chalk-cut ditch and turf bank round a ring of ten standing stones, uneven as real sarsens are, with a trilithon at the
 * back (its gap faces the front, where the midsummer sun comes up), an altar stone in the middle and the owner's banner on a pole.
 */
export function henge(k: Kit, base: string): void {
  k.box(2.9, 0.05, 2.9, base, 0, -0.02, 0);
  // The ditch, the bank thrown up outside it, and the chalk showing where the turf was cut.
  k.ring(1.32, 0.13, TURF, 0.04);
  k.ring(1.12, 0.06, CHALK, 0.02);
  // The ring of stones: ten uprights, no two alike, and a gap left at the front for the way in.
  for (let i = 0; i < 12; i++) {
    if (i === 0 || i === 6) continue;
    const a = (i / 12) * Math.PI * 2;
    const x = Math.sin(a) * 0.95, z = Math.cos(a) * 0.95;
    const h = 0.55 + rnd(i, 5, 11) * 0.35;
    const w = 0.16 + rnd(i, 7, 13) * 0.08;
    const s = k.box(w, h, 0.12, i % 3 ? SARSEN : SARSEN_DARK, x, 0, z);
    s.rotation.y = a;
    s.rotation.z = (rnd(i, 3, 17) - 0.5) * 0.18;
    // A crust of lichen on the weather side of every third stone.
    if (i % 3 === 1) k.box(w * 0.7, 0.08, 0.125, LICHEN, x, h * 0.75, z).rotation.y = a;
  }
  // The trilithon at the back: two great uprights and the lintel laid across them.
  for (const x of [-0.28, 0.28]) k.box(0.22, 1.05, 0.2, SARSEN_DARK, x, 0, -0.62);
  k.box(0.86, 0.17, 0.24, SARSEN, 0, 1.05, -0.62);
  // The altar stone, low and flat, and a little fire of the gathering before it.
  k.box(0.5, 0.12, 0.26, '#7d7a70', 0, 0, 0);
  k.rock(0.06, '#4a4038', 0.0, 0.0, 0.32);
  k.glow(k.cone(0.06, 0.14, 5, '#ffb24a', 0, 0.06, 0.32));
  // The owner's banner, on a pole by the way in.
  k.cyl(0.02, 0.02, 1.3, 4, '#5a4632', 0.42, 0, 1.15);
  k.team(k.box(0.28, 0.18, 0.02, TEAM, 0.56, 1.1, 1.15));
  k.team(k.box(2.98, 0.08, 2.98, TEAM, 0, -0.06, 0));
}

const EARTH = '#5e5a3e';
const PROP = '#6b4b2f';

/**
 * A Barrow (the Age of Delvings, #881): a long turfed mound with a kerb of stones, and at its foot a stone-framed mouth with a timber
 * lintel and a lamp hung inside, a heap of chalk spoil beside it, and the owner's banner on a post.
 */
export function barrow(k: Kit, base: string): void {
  k.box(1.9, 0.05, 1.9, base, 0, -0.02, 0);
  const m = k.dome(0.85, EARTH, 0, 0, -0.15);
  m.scale.set(1.05, 0.62, 1.15);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.15 + (i / 8) * Math.PI * 1.7;
    k.rock(0.07 + rnd(i, 2, 9) * 0.03, i % 2 ? SARSEN : SARSEN_DARK, Math.cos(a) * 0.86, 0, -0.15 + Math.sin(a) * 0.95);
  }
  // The mouth: two uprights and a capstone, the dark way in, the timber lintel within and the lamp.
  for (const x of [-0.2, 0.2]) k.box(0.12, 0.46, 0.14, SARSEN_DARK, x, 0, 0.62);
  k.box(0.56, 0.12, 0.18, SARSEN, 0, 0.46, 0.62);
  k.box(0.28, 0.42, 0.04, '#1a1612', 0, 0, 0.66);
  k.box(0.3, 0.05, 0.06, PROP, 0, 0.36, 0.6);
  k.glow(k.box(0.06, 0.08, 0.06, '#ffb24a', 0, 0.24, 0.62));
  k.blob(0.2, CHALK, 0.62, 0, 0.62).scale.set(1.2, 0.5, 1);
  k.cyl(0.02, 0.02, 1.1, 4, PROP, -0.6, 0, 0.6);
  k.team(k.box(0.26, 0.16, 0.02, TEAM, -0.47, 0.92, 0.6));
  k.team(k.box(1.98, 0.08, 1.98, TEAM, 0, -0.06, 0));
}

const TUFF = '#d2b890';
const TUFF_DARK = '#a88c66';
const TUFF_FLOOR = '#bfa27a';
const SOOT = '#2a2420';

/**
 * A sunk building (the Age of the Undercity, #883), as its owner and a rival who found it see it: a low mound of tuff over the
 * footprint, a rock-cut stair going down at the front with a lamp below and the millstone door rolled back beside it, vent holes ringed
 * with soot, and the owner's mark on a stone by the stair. Larger halls show more vents.
 */
export function sunken(k: Kit, size: number): void {
  k.box(size * 0.96, 0.04, size * 0.96, TUFF_FLOOR, 0, -0.02, 0);
  const m = k.dome(size * 0.47, TUFF, 0, 0, -size * 0.04);
  m.scale.set(1.04, 0.26, 1);
  for (let i = 0; i < 5 + size; i++) {
    const a = (i / (5 + size)) * Math.PI * 2 + 0.4;
    k.rock(0.06 + rnd(i, 3, 7) * 0.04, i % 2 ? TUFF_DARK : TUFF, Math.cos(a) * size * 0.46, 0, Math.sin(a) * size * 0.44);
  }
  const fz = size * 0.5 - 0.12;
  k.box(0.46, 0.14, 0.34, TUFF_DARK, 0, 0, fz - 0.06);
  k.box(0.32, 0.13, 0.3, SOOT, 0, 0.02, fz - 0.04);
  k.glow(k.box(0.06, 0.05, 0.05, '#ffb24a', 0, 0.06, fz - 0.12));
  const mill = k.cyl(0.17, 0.17, 0.07, 10, TUFF_DARK, 0.36, 0.17, fz);
  mill.rotation.x = Math.PI / 2;
  k.cyl(0.035, 0.035, 0.075, 6, SOOT, 0.36, 0.17, fz).rotation.x = Math.PI / 2;
  const vents: [number, number][] = size >= 3 ? [[-0.5, -0.35], [0.45, -0.5], [-0.05, -0.85]] : [[-0.32, -0.2], [0.3, -0.4]];
  for (const [x, z] of vents) {
    k.cyl(0.07, 0.09, 0.1, 6, TUFF_DARK, x, size * 0.07, z);
    k.cyl(0.05, 0.05, 0.02, 6, SOOT, x, size * 0.07 + 0.1, z);
  }
  k.box(0.14, 0.2, 0.1, TUFF_DARK, -0.36, 0, fz);
  k.team(k.box(0.12, 0.08, 0.02, TEAM, -0.36, 0.12, fz + 0.06));
}

const BASALT = '#3c3b40';
const BASALT_DARK = '#28272b';
const BASALT_EDGE = '#5a5860';
const EMBER = '#ff6a1a';
const EMBER_GLOW = '#ffb24a';
const SLAG = '#6a3a28';
const SULPHUR = '#c9b23a';
const STEAM = '#e4e2de';
const IRON = '#2a2624';

/**
 * A Vent Forge (the Age of Deep Forges, #884): a horseshoe of black basalt columns, hexagonal and uneven as they stand at Staffa and
 * the Giant's Causeway, roofed with a slab at the back, round the vent itself: a ring of slag and a glowing pit under an iron grate,
 * embers in the cracks of the floor. A tapering stack at the back lets the steam off in a plume; an anvil and a quench trough stand at
 * the front, and the owner's banner on a column top.
 */
export function ventforge(k: Kit, base: string): void {
  k.box(2.9, 0.05, 2.9, base, 0, -0.02, 0);
  k.box(2.6, 0.04, 2.6, BASALT_DARK, 0, 0, 0);
  // Ember in the cracks of the floor, running out from the vent.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const c = k.glow(k.box(0.04, 0.012, 0.5 + rnd(i, 3, 5) * 0.3, EMBER, Math.sin(a) * 0.62, 0.04, 0.2 + Math.cos(a) * 0.62));
    c.rotation.y = a;
  }
  // The horseshoe of columns: the back and both sides, open at the front.
  for (let i = 0; i < 15; i++) {
    const t = i / 14;
    const x = t < 0.3 ? -1.1 : t > 0.7 ? 1.1 : -1.1 + ((t - 0.3) / 0.4) * 2.2;
    const z = t < 0.3 ? 0.8 - (t / 0.3) * 1.9 : t > 0.7 ? -1.1 + ((t - 0.7) / 0.3) * 1.9 : -1.1;
    const h = 0.75 + rnd(i, 4, 9) * 0.45;
    k.cyl(0.17, 0.17, h, 6, i % 3 ? BASALT : BASALT_EDGE, x, 0, z).rotation.y = rnd(i, 2, 7) * 0.5;
    k.cyl(0.17, 0.17, 0.03, 6, BASALT_EDGE, x, h, z).rotation.y = rnd(i, 2, 7) * 0.5;
  }
  // The roof slab over the back of the hall.
  k.box(2.5, 0.16, 1.1, BASALT_DARK, 0, 1.05, -0.62);
  k.box(2.6, 0.06, 1.2, BASALT_EDGE, 0, 1.21, -0.62);
  // The vent: a ring of slag, the pit glowing, and an iron grate over it.
  k.cyl(0.46, 0.52, 0.09, 8, SLAG, 0, 0.02, 0.15);
  k.glow(k.cyl(0.34, 0.34, 0.03, 8, EMBER, 0, 0.1, 0.15));
  k.glow(k.cyl(0.16, 0.16, 0.035, 8, EMBER_GLOW, 0, 0.1, 0.15));
  for (const z of [-0.06, 0.15, 0.36]) k.box(0.72, 0.035, 0.05, IRON, 0, 0.13, z);
  k.blob(0.07, SULPHUR, 0.42, 0.06, 0.45).scale.set(1.3, 0.4, 1);
  // The stack at the back, and its plume.
  k.cyl(0.18, 0.3, 1.7, 6, BASALT, -0.62, 0, -0.75);
  k.cyl(0.2, 0.2, 0.08, 6, BASALT_EDGE, -0.62, 1.7, -0.75);
  for (const [dx, y, r] of [[0, 1.95, 0.2], [0.08, 2.2, 0.26], [0.2, 2.5, 0.3]] as const) k.blob(r, STEAM, -0.62 + dx, y, -0.75 - dx).scale.set(1.2, 0.75, 1.2);
  // The anvil, a hammer on it, and the quench trough at the front.
  k.box(0.2, 0.22, 0.16, BASALT_EDGE, 0.75, 0, 0.92);
  k.box(0.36, 0.1, 0.18, IRON, 0.75, 0.22, 0.92);
  k.box(0.24, 0.04, 0.04, '#6b4b2f', 0.72, 0.33, 0.92).rotation.y = 0.5;
  k.box(0.6, 0.18, 0.26, BASALT, -0.66, 0, 1.0);
  k.box(0.52, 0.02, 0.18, '#4a6a78', -0.66, 0.17, 1.0);
  // The owner's banner on the tallest column.
  k.cyl(0.02, 0.02, 0.7, 4, IRON, 1.1, 1.2, -1.1);
  k.team(k.box(0.28, 0.18, 0.02, TEAM, 1.24, 1.66, -1.1));
  k.team(k.box(2.98, 0.08, 2.98, TEAM, 0, -0.06, 0));
}

/**
 * A vent of the earth's heat (#884), as anyone who has seen its tile sees it: a scorched patch of cracked black ground round a fissure
 * glowing within, a crust of sulphur at its lips, a few basalt stones and a wisp of steam. Neutral: everyone's until a forge stands on it.
 */
export function vent(k: Kit): void {
  k.cyl(1.25, 1.35, 0.03, 9, '#2e2a28', 0, -0.01, 0);
  k.cyl(0.8, 0.86, 0.035, 8, BASALT_DARK, 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    k.rock(0.1 + rnd(i, 3, 5) * 0.06, i % 2 ? BASALT : BASALT_EDGE, Math.cos(a) * (0.9 + rnd(i, 5, 7) * 0.2), 0.03, Math.sin(a) * (0.9 + rnd(i, 7, 3) * 0.2));
  }
  // The fissure: a jagged crack of three runs, glowing, wider and brighter where it opens in the middle.
  for (const [x, z, len, rot] of [[-0.3, 0.22, 0.55, 0.9], [0, 0, 0.6, 0.3], [0.3, -0.24, 0.5, 1.1]] as const) {
    k.glow(k.box(0.13, 0.04, len, EMBER, x, 0.02, z)).rotation.y = rot;
  }
  k.glow(k.cyl(0.18, 0.2, 0.045, 7, EMBER_GLOW, 0, 0.02, 0));
  for (const [x, z] of [[0.22, 0.32], [-0.2, -0.36], [0.36, -0.1]]) k.blob(0.07, SULPHUR, x, 0.03, z).scale.set(1.4, 0.35, 1.2);
  for (const [dx, y, r] of [[0, 0.3, 0.12], [0.06, 0.55, 0.16], [0.14, 0.85, 0.2]] as const) k.blob(r, STEAM, dx, y, -dx);
}

const RIFT = '#6e6a66';
const RIFT_EDGE = '#8a8682';
const RIFT_DARK = '#2a2c2e';
const PIT = '#0c0e10';
const CRYSTAL = '#3ad6c8';
const CRYSTAL_PALE = '#9af2e8';

/**
 * A Fault Engine (the Age of Faults, #900): a crag split in two on a floor of riven slabs, its halves leaning apart, and between them a
 * great wedge of dark stone driven down into the cleft, veined with teal crystal that glows with the strain. A crack runs out from the
 * cleft's foot to the front, crystal glinting in it; a beam braced across the halves holds the wedge, and the owner's banner flies from
 * the taller half.
 */
export function faultengine(k: Kit, base: string): void {
  k.box(2.9, 0.05, 2.9, base, 0, -0.02, 0);
  // Riven floor slabs, tilted a little each.
  for (let i = 0; i < 6; i++) {
    const x = ((i % 3) - 1) * 0.86;
    const z = (i < 3 ? -0.5 : 0.5) + 0.1;
    k.box(0.8, 0.06, 0.9, i % 2 ? RIFT : RIFT_EDGE, x, 0.01, z).rotation.y = (rnd(i, 3, 7) - 0.5) * 0.2;
  }
  // The two halves of the crag, leaning apart.
  for (const [d, h, tilt] of [[-1, 1.9, -0.2], [1, 1.6, 0.18]] as const) {
    const half = k.box(0.8, h, 1.3, d < 0 ? RIFT : RIFT_EDGE, d * 0.62, 0, -0.35);
    half.rotation.z = tilt;
    k.rock(0.3, RIFT_DARK, d * 1.05, 0.1, 0.45);
  }
  // The wedge, point down in the cleft, and its crystal veins.
  const w = k.pyramid(0.7, 1.4, 0.9, RIFT_DARK, 0, 0.5, -0.35);
  w.rotation.x = Math.PI;
  for (const [x, y] of [[-0.12, 1.2], [0.1, 1.45], [0, 0.9]] as const) k.glow(k.box(0.05, 0.36, 0.04, CRYSTAL, x, y, 0.1));
  // The beam braced across the crag, holding the wedge.
  k.box(1.9, 0.14, 0.18, '#4a3a2c', 0, 1.62, -0.35);
  for (const d of [-1, 1]) k.box(0.1, 0.26, 0.22, '#2a2624', d * 0.88, 1.55, -0.35);
  // The crack out of the cleft's foot to the front, glowing, with crystal grown at its lips.
  k.box(0.18, 0.02, 1.4, PIT, 0, 0.04, 0.6);
  k.glow(k.box(0.08, 0.025, 1.3, CRYSTAL, 0, 0.045, 0.6));
  for (const [x, z, s] of [[0.14, 0.3, 1], [-0.13, 0.75, 0.8], [0.12, 1.1, 0.7], [-0.1, 0.1, 0.9]] as const) k.glow(k.octa(0.09 * s, CRYSTAL_PALE, x, 0.08, z)).scale.set(0.7, 1.8, 0.7);
  // The banner on the taller half.
  k.cyl(0.02, 0.02, 0.7, 4, RIFT_DARK, -0.85, 1.75, -0.6);
  k.team(k.box(0.3, 0.18, 0.02, TEAM, -0.7, 2.2, -0.6));
  k.team(k.box(2.98, 0.08, 2.98, TEAM, 0, -0.06, 0));
}

/**
 * A tile of chasm (#900): the ground split open, black in its depths, the broken lips of grey rock round it and a glint of teal crystal
 * down the walls. Drawn over the ground, one to a tile, so a line of them reads as one crack.
 */
export function chasm(k: Kit): void {
  k.box(1.02, 0.03, 1.02, RIFT_DARK, 0, 0, 0);
  k.box(0.78, 0.035, 0.78, PIT, 0, 0.002, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    k.rock(0.09 + rnd(i, 3, 5) * 0.05, i % 2 ? RIFT : RIFT_EDGE, Math.cos(a) * 0.44, 0.02, Math.sin(a) * 0.44);
  }
  for (const [x, z] of [[0.22, -0.18], [-0.24, 0.2]] as const) k.glow(k.octa(0.05, CRYSTAL, x, 0.03, z)).scale.set(0.8, 1.6, 0.8);
}

/** A tile of a charging crack (#900): a thin glowing seam of teal in the ground, seen by every people before it opens. */
export function seam(k: Kit): void {
  k.box(0.9, 0.02, 0.12, RIFT_DARK, 0, 0, 0);
  k.glow(k.box(0.86, 0.025, 0.06, CRYSTAL, 0, 0.005, 0));
  k.glow(k.box(0.12, 0.025, 0.4, CRYSTAL, 0.22, 0.005, 0.1)).rotation.y = 0.7;
}
