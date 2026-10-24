import * as THREE from 'three';
import { Kit, bake } from './kit';

/** Trees, bushes, mines and the little things in the grass, as baked models for instancing. */

const TRUNK = '#7a5636';

function pine(): Kit {
  const k = new Kit();
  k.cyl(0.05, 0.07, 0.3, 5, TRUNK);
  k.cone(0.32, 0.46, 7, '#1c4a2a', 0, 0.2);
  k.cone(0.25, 0.42, 7, '#2a6636', 0, 0.5);
  k.cone(0.16, 0.36, 7, '#4a8e42', 0, 0.8);
  return k;
}

function broadleaf(): Kit {
  const k = new Kit();
  k.cyl(0.05, 0.075, 0.45, 5, TRUNK);
  k.blob(0.3, '#2b6334', 0, 0.62).scale.set(1, 0.8, 1);
  k.blob(0.22, '#559a44', 0.14, 0.86, 0.08);
  k.blob(0.18, '#3f7e3c', -0.14, 0.7, -0.1);
  return k;
}

function birch(): Kit {
  const k = new Kit();
  k.cyl(0.035, 0.05, 0.6, 5, '#e8e4da');
  k.box(0.072, 0.03, 0.072, '#3a3a3a', 0, 0.25);
  k.blob(0.22, '#7fb24a', 0, 0.8).scale.set(0.85, 1.2, 0.85);
  return k;
}

function palm(): Kit {
  const k = new Kit();
  const trunk = k.cyl(0.035, 0.055, 0.75, 5, '#9a7a4a');
  trunk.rotation.z = 0.12;
  for (let f = 0; f < 6; f++) {
    const g = k.group(0.04, 0.75, 0);
    g.rotation.y = (f / 6) * Math.PI * 2;
    const leaf = k.box(0.42, 0.02, 0.1, f % 2 ? '#3f9a4a' : '#55b55c', 0.2, -0.05, 0, g);
    leaf.rotation.z = -0.35;
  }
  k.sphere(0.04, '#6b4a2a', 0.05, 0.72, 0.03);
  return k;
}

/** A felled trunk and its stump, for a tree being cut. */
function felled(): Kit {
  const k = new Kit();
  k.cyl(0.07, 0.075, 0.12, 6, TRUNK);
  k.cyl(0.06, 0.06, 0.02, 6, '#d8b98a', 0, 0.12);
  const log = k.cyl(0.055, 0.065, 0.6, 6, TRUNK, 0.35, 0.06, 0);
  log.rotation.z = Math.PI / 2;
  k.cone(0.2, 0.3, 6, '#3a8445', 0.72, 0.06, 0).rotation.z = -Math.PI / 2;
  return k;
}

/** Where fire took a tree (`fire.ts`): a charred stump on a scatter of grey ash and embers gone dark. */
function ash(): Kit {
  const k = new Kit();
  k.cyl(0.36, 0.42, 0.015, 7, '#4a4541').scale.set(1, 1, 0.8);
  k.cyl(0.22, 0.26, 0.02, 6, '#77706a', 0.06, 0.008, -0.04);
  k.cyl(0.065, 0.08, 0.2, 6, '#231c17');
  k.cyl(0.05, 0.065, 0.02, 6, '#120d0a', 0, 0.2);
  const snag = k.cyl(0.02, 0.03, 0.16, 4, '#2c221b', 0.03, 0.18, 0);
  snag.rotation.z = -0.5;
  k.octa(0.025, '#7a3a1c', -0.12, 0.02, 0.1);
  k.octa(0.02, '#5a2a16', 0.16, 0.02, -0.08);
  return k;
}

function berryBush(): Kit {
  const k = new Kit();
  k.blob(0.26, '#2d6230', 0, 0.18).scale.set(1.1, 0.8, 1.1);
  k.blob(0.18, '#387a38', 0.14, 0.26, 0.06);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = 0.16 + (i % 3) * 0.05;
    k.sphere(0.04, i % 2 ? '#d6304a' : '#b8203a', Math.cos(a) * r, 0.18 + (i % 4) * 0.06, Math.sin(a) * r, undefined, 5);
  }
  return k;
}

function stoneDeposit(): Kit {
  const k = new Kit();
  k.rock(0.32, '#a9a49b', 0, 0.16);
  k.rock(0.22, '#bdb8ae', 0.25, 0.1, 0.12);
  k.rock(0.18, '#959087', -0.22, 0.08, -0.14);
  k.rock(0.12, '#c8c3b8', 0.05, 0.36, -0.05);
  return k;
}

function goldDeposit(): Kit {
  const k = new Kit();
  k.rock(0.3, '#4f4536', 0, 0.15);
  k.rock(0.2, '#463d2f', 0.24, 0.1, 0.1);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.7;
    k.glow(k.octa(0.06 + (i % 3) * 0.02, i % 2 ? '#ffe066' : '#ffc82e', Math.cos(a) * 0.2, 0.22 + (i % 3) * 0.08, Math.sin(a) * 0.2));
  }
  return k;
}

/** Bog iron (#39): a rust-filmed pool in dark marsh mud, lumps of red-brown ore, and reeds. */
function bogIron(): Kit {
  const k = new Kit();
  k.cyl(0.46, 0.5, 0.04, 9, '#5c4a32', 0, 0.0);
  k.cyl(0.32, 0.32, 0.02, 9, '#c8702e', -0.06, 0.035, 0.04);
  k.cyl(0.17, 0.17, 0.012, 7, '#e8a048', -0.1, 0.05, 0.06);
  k.rock(0.17, '#8a4424', 0.22, 0.08, -0.12);
  k.rock(0.13, '#a0562c', 0.08, 0.06, -0.26);
  k.rock(0.1, '#7a3c22', -0.28, 0.05, -0.18);
  for (let i = 0; i < 8; i++) {
    const a = 0.6 + i * 0.7;
    const reed = k.cone(0.035, 0.42 + (i % 3) * 0.1, 4, i % 2 ? '#7d8c42' : '#a0a052', Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38);
    reed.rotation.z = ((i % 3) - 1) * 0.15;
  }
  return k;
}

/** Salt (#356): bare ground crusted white, blocks of clean crystal. */
function saltVein(): Kit {
  const k = new Kit();
  k.cyl(0.46, 0.5, 0.03, 9, '#d9d2c0', 0, 0.0);
  k.rock(0.2, '#f1eee4', 0.1, 0.1, 0.05);
  k.rock(0.15, '#e4e0d2', -0.18, 0.07, -0.12);
  k.rock(0.12, '#fbf9f2', 0.02, 0.2, -0.1);
  return k;
}

/** A cave mouth (#356): a hump of rock with a dark opening, a glint of ore at the lip. */
function caveMouth(): Kit {
  const k = new Kit();
  k.rock(0.46, '#8a867c', 0, 0.2).scale.set(1.15, 0.9, 1);
  k.rock(0.3, '#9a958a', -0.3, 0.12, 0.12);
  k.rock(0.26, '#767269', 0.32, 0.1, -0.1);
  k.box(0.3, 0.26, 0.2, '#0d0b0a', 0, 0.13, 0.36);
  k.rock(0.09, '#e8e2c8', 0.18, 0.05, 0.5);
  k.rock(0.07, '#d8cf9a', -0.16, 0.04, 0.52);
  return k;
}

/** Saltpetre (#356): a pale yellow crust on damp dark rock, with fine needles. */
function saltpetreVein(): Kit {
  const k = new Kit();
  k.rock(0.3, '#6b6558', 0, 0.14);
  k.rock(0.2, '#7a7466', -0.22, 0.08, 0.1);
  for (let i = 0; i < 7; i++) {
    const a = i * 1.1;
    const n = k.cone(0.03, 0.2 + (i % 3) * 0.06, 4, i % 2 ? '#e6df8e' : '#cfc66a', Math.cos(a) * 0.2, 0.2, Math.sin(a) * 0.2);
    n.rotation.z = ((i % 3) - 1) * 0.35;
  }
  return k;
}

/** Blood-iron (#356): black ore laced with wet red veins that glow faintly, as if warm. */
function bloodIronVein(): Kit {
  const k = new Kit();
  k.rock(0.32, '#2f2326', 0, 0.16);
  k.rock(0.2, '#3a2a2e', 0.24, 0.1, 0.12);
  k.rock(0.16, '#241a1d', -0.22, 0.08, -0.14);
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    k.glow(k.octa(0.05 + (i % 2) * 0.02, i % 2 ? '#c4202f' : '#8f1624', Math.cos(a) * 0.18, 0.18 + (i % 3) * 0.07, Math.sin(a) * 0.18));
  }
  return k;
}

function tuft(): Kit {
  const k = new Kit();
  for (let i = 0; i < 4; i++) {
    const blade = k.cone(0.02, 0.12 + (i % 2) * 0.05, 3, i % 2 ? '#5c9e3c' : '#6fb24a', (i - 1.5) * 0.03, 0, (i % 2) * 0.02);
    blade.rotation.z = (i - 1.5) * 0.3;
  }
  return k;
}

function flowers(): Kit {
  const k = new Kit();
  const colors = ['#f5f0e6', '#f2d34a', '#e36a8a', '#9a7ad8'];
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.06;
    const z = (i % 2) * 0.05;
    k.cyl(0.005, 0.005, 0.08, 3, '#4f8a35', x, 0, z);
    k.sphere(0.022, colors[i], x, 0.09, z, undefined, 5);
  }
  return k;
}

function pebbles(): Kit {
  const k = new Kit();
  k.rock(0.06, '#a39e94', 0, 0.02);
  k.rock(0.04, '#8f8a80', 0.08, 0.01, 0.04);
  return k;
}

function boulder(): Kit {
  const k = new Kit();
  k.rock(0.5, '#8d8579', 0, 0.2).scale.set(1, 0.8, 1);
  k.rock(0.3, '#9a9286', 0.35, 0.1, 0.2);
  return k;
}

/** A felled deer lying on its side, ready to butcher. */
function carcass(): Kit {
  const k = new Kit();
  const coat = '#a8703e';
  const body = k.group(0, 0.07, 0);
  body.rotation.z = Math.PI / 2;
  k.box(0.13, 0.13, 0.34, coat, 0, 0, 0, body);
  k.box(0.1, 0.03, 0.28, '#e8dcc6', -0.06, 0, 0, body);
  for (const [z, a] of [[0.12, 0.3], [-0.12, -0.2]]) {
    const leg = k.box(0.24, 0.035, 0.04, coat, 0.17, 0.05 + a * 0.02, z);
    leg.rotation.y = a;
  }
  const head = k.box(0.07, 0.07, 0.14, coat, -0.02, 0.04, 0.26);
  head.rotation.y = 0.4;
  k.box(0.12, 0.012, 0.1, '#8a2a20', 0.05, 0.0, -0.05);
  k.box(0.05, 0.012, 0.07, '#a83a2a', -0.12, 0.0, 0.08);
  return k;
}

/** A carcass that has begun to turn (#521's crows come for it): greyed hide, ribs showing, the pool gone dark. */
function carcassRotten(): Kit {
  const k = new Kit();
  const coat = '#7d6d58';
  const body = k.group(0, 0.07, 0);
  body.rotation.z = Math.PI / 2;
  k.box(0.12, 0.11, 0.34, coat, 0, 0, 0, body);
  for (let i = 0; i < 4; i++) k.box(0.1, 0.012, 0.02, '#ddd4bf', -0.02, 0.06, -0.1 + i * 0.07, body);
  for (const [z, a] of [[0.12, 0.3], [-0.12, -0.2]]) {
    const leg = k.box(0.24, 0.03, 0.035, coat, 0.17, 0.05 + a * 0.02, z);
    leg.rotation.y = a;
  }
  const head = k.box(0.07, 0.06, 0.13, '#6e6050', -0.02, 0.04, 0.26);
  head.rotation.y = 0.4;
  k.box(0.14, 0.012, 0.12, '#3c2a22', 0.05, 0.0, -0.05);
  k.box(0.06, 0.012, 0.08, '#4a3326', -0.12, 0.0, 0.08);
  return k;
}

/** A shoal of fish at the surface: a dark patch, silver backs breaking the water, one leaping. */
function fish(): Kit {
  const k = new Kit();
  k.cyl(0.46, 0.46, 0.012, 14, '#285a6e', 0, -0.012, 0);
  k.cyl(0.3, 0.3, 0.012, 12, '#1f4a5c', 0.06, -0.008, -0.04);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + (i % 2) * 0.4;
    const r = 0.12 + (i % 3) * 0.09;
    const g = k.group(Math.sin(a) * r, 0, Math.cos(a) * r);
    g.rotation.y = a + Math.PI / 2;
    k.sphere(0.04, i % 3 ? '#b9c6cc' : '#8fa2aa', 0, 0.008, 0, g, 5).scale.set(0.55, 0.45, 1.9);
    k.box(0.006, 0.035, 0.03, '#6e8088', 0, 0.03, 0.01, g);
  }
  // One leaps clear.
  const j = k.group(0.22, 0.2, 0.1);
  j.rotation.set(-0.6, 0.7, 0);
  k.sphere(0.035, '#d8e2e6', 0, 0, 0, j, 5).scale.set(0.5, 0.6, 2);
  k.box(0.004, 0.05, 0.03, '#9aaab0', 0, 0, -0.07, j);
  for (let i = 0; i < 5; i++) k.sphere(0.015 + (i % 2) * 0.008, '#f4fbff', Math.sin(i * 2.3) * 0.25, 0.005, Math.cos(i * 1.7) * 0.25, undefined, 4);
  return k;
}

const MAKERS = { pine, broadleaf, birch, palm, felled, ash, berryBush, stoneDeposit, goldDeposit, bogIron, saltVein, caveMouth, saltpetreVein, bloodIronVein, carcass, carcassRotten, tuft, flowers, pebbles, boulder, fish };
export type NatureKind = keyof typeof MAKERS;

const cache = new Map<NatureKind, THREE.BufferGeometry>();

export function natureGeometry(kind: NatureKind): THREE.BufferGeometry {
  let g = cache.get(kind);
  if (!g) {
    g = bake(MAKERS[kind]().root);
    cache.set(kind, g);
  }
  return g;
}
