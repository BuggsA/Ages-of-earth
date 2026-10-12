import * as THREE from 'three';
import type { BuildingType } from '../sim/types';
import { Kit, bake } from './kit';

/**
 * Every building in every epoch: Stone Age thatch, hide and wattle; Bronze Age mudbrick and terracotta;
 * Middle Ages stone, timber framing and slate; Gunpowder Age brick, white trim and tile. Each fits its
 * footprint (size × size tiles, centered on the origin) and flies its owner's colors.
 */

interface Style {
  wall: string;
  wall2: string;
  roof: string;
  roof2: string;
  trim: string;
  base: string;
  post: string;
  window: string;
}

const STYLES: Style[] = [
  { wall: '#a8865e', wall2: '#8f6f4a', roof: '#d1ae62', roof2: '#b8954d', trim: '#6e4f33', base: '#8d7a62', post: '#6b4b2f', window: '#3a2b20' },
  { wall: '#dbb07e', wall2: '#c99a66', roof: '#bb5f37', roof2: '#a24c2a', trim: '#f0e4c8', base: '#b9a58a', post: '#8a6a44', window: '#3a2b20' },
  { wall: '#ece4d2', wall2: '#a9a397', roof: '#56616f', roof2: '#47515d', trim: '#4a3426', base: '#9a948a', post: '#4a3426', window: '#2c3440' },
  { wall: '#b45c42', wall2: '#efe8da', roof: '#713c2d', roof2: '#5c3024', trim: '#f2ece0', base: '#8d8579', post: '#4a3426', window: '#3b4a5a' },
];

const TEAM = '#f4f4f4';
const WOOD = '#7a5636';
const STONE = '#9d978d';
const HAY = '#d8c06a';
const LIGHT = '#ffc46b';

function banner(k: Kit, x: number, y: number, z: number, h = 0.7, big = 1): void {
  k.cyl(0.018, 0.022, h, 5, '#5b4330', x, y, z);
  k.team(k.box(0.012, 0.22 * big, 0.3 * big, TEAM, x, y + h - 0.26 * big, z + 0.15 * big));
  k.sphere(0.03, '#e2b23c', x, y + h + 0.02, z);
}

function torch(k: Kit, x: number, y: number, z: number): void {
  k.cyl(0.015, 0.02, 0.22, 4, '#4a3426', x, y, z);
  k.glow(k.octa(0.04, LIGHT, x, y + 0.26, z));
}

function window(k: Kit, st: Style, x: number, y: number, z: number, w = 0.12, h = 0.16, lit = true, side = false): void {
  const m = k.box(side ? 0.02 : w, h, side ? w : 0.02, lit ? LIGHT : st.window, x, y, z);
  if (lit) k.glow(m);
}

/** A ground pad under the building. */
function pad(k: Kit, n: number, color: string): void {
  k.box(n - 0.1, 0.06, n - 0.1, color, 0, -0.02, 0);
}

function hut(k: Kit, st: Style, x: number, z: number, r: number, h: number): void {
  k.cyl(r, r * 1.05, h, 9, st.wall, x, 0, z);
  k.cone(r * 1.35, h * 1.15, 9, st.roof, x, h, z);
  k.cone(r * 0.5, h * 0.4, 9, st.roof2, x, h + h * 0.85, z);
  k.box(r * 0.5, h * 0.7, 0.04, '#3a2b20', x, 0, z + r * 1.0);
}

// ---- Town Center -----------------------------------------------------------------------------------

function towncenter(k: Kit, e: number, st: Style): void {
  pad(k, 4, st.base);
  if (e === 0) {
    // A great round lodge among huts, a fire pit and a totem.
    hut(k, st, 0, -0.2, 0.9, 0.75);
    hut(k, st, -1.25, 1.0, 0.42, 0.42);
    hut(k, st, 1.25, 1.0, 0.42, 0.42);
    hut(k, st, 1.3, -1.25, 0.38, 0.38);
    k.cyl(0.22, 0.25, 0.06, 8, '#6a6258', -0.3, 0, 1.25);
    k.glow(k.cone(0.12, 0.2, 5, '#ff9a3c', -0.3, 0.05, 1.25));
    k.cyl(0.07, 0.08, 1.3, 6, st.post, -1.5, 0, -1.4);
    for (let i = 0; i < 3; i++) k.team(k.box(0.18, 0.14, 0.16, TEAM, -1.5, 0.45 + i * 0.27, -1.4));
    banner(k, 0.95, 0, 0.55, 1.4, 1.2);
    for (let i = 0; i < 4; i++) k.cyl(0.03, 0.03, 0.45, 4, st.post, -1.8 + i * 0.25, 0, 1.85);
    return;
  }
  if (e === 1) {
    // A stepped mudbrick hall with a columned porch and banners.
    k.box(3.2, 0.9, 2.6, st.wall, 0, 0, -0.3);
    k.box(2.3, 0.6, 1.8, st.wall2, 0, 0.9, -0.45);
    k.box(1.4, 0.45, 1.1, st.wall, 0, 1.5, -0.5);
    k.box(3.3, 0.06, 2.7, st.trim, 0, 0.9, -0.3);
    k.box(2.4, 0.06, 1.9, st.trim, 0, 1.5, -0.45);
    k.pyramid(1.5, 0.45, 1.2, st.roof, 0, 1.95, -0.5);
    for (let i = 0; i < 5; i++) k.cyl(0.07, 0.08, 0.85, 7, st.trim, -1.2 + i * 0.6, 0, 1.15);
    k.box(3.0, 0.1, 0.4, st.roof, 0, 0.85, 1.12);
    k.box(0.5, 0.6, 0.04, '#3a2b20', 0, 0, 1.0);
    window(k, st, -0.8, 1.05, 0.46);
    window(k, st, 0.8, 1.05, 0.46);
    banner(k, -1.75, 0, 1.65, 1.5, 1.2);
    banner(k, 1.75, 0, 1.65, 1.5, 1.2);
    torch(k, -0.45, 0, 1.55);
    torch(k, 0.45, 0, 1.55);
    return;
  }
  if (e === 2) {
    // A stone keep with a slate roof, a great hall beside it and crenellated corners.
    k.box(1.7, 1.9, 1.7, STONE, -0.7, 0, -0.6);
    for (let i = 0; i < 4; i++) {
      const cx = -0.7 + (i % 2 ? 0.7 : -0.7);
      const cz = -0.6 + (i < 2 ? -0.7 : 0.7);
      k.box(0.25, 0.22, 0.25, STONE, cx, 1.9, cz);
    }
    k.pyramid(1.3, 1.0, 1.3, st.roof, -0.7, 1.9, -0.6);
    k.box(2.0, 0.9, 1.4, st.wall, 0.75, 0, 0.75);
    for (let i = 0; i < 4; i++) k.box(0.06, 0.9, 0.04, st.trim, 0.0 + i * 0.5, 0, 1.46);
    k.box(2.0, 0.06, 1.42, st.trim, 0.75, 0.45, 0.75);
    k.prism(2.1, 0.75, 1.55, st.roof, 0.75, 0.9, 0.75);
    window(k, st, -0.7, 1.25, 0.26, 0.14, 0.24);
    window(k, st, -1.56, 1.25, -0.6, 0.14, 0.24, true, true);
    window(k, st, 0.4, 0.5, 1.47);
    window(k, st, 1.1, 0.5, 1.47);
    k.box(0.45, 0.6, 0.04, '#3a2b20', -0.7, 0, 0.26);
    banner(k, -0.7, 2.9, -0.6, 0.8, 1.1);
    banner(k, 1.7, 0, 1.7, 1.4, 1.1);
    torch(k, -1.0, 0, 0.5);
    torch(k, -0.4, 0, 0.5);
    return;
  }
  // A brick town hall with white columns and a clock tower under a dome.
  k.box(3.4, 1.1, 2.4, st.wall, 0, 0, -0.35);
  k.box(3.5, 0.08, 2.5, st.trim, 0, 1.1, -0.35);
  k.prism(3.5, 0.6, 2.5, st.roof, 0, 1.18, -0.35);
  k.box(1.6, 0.12, 0.8, st.trim, 0, 1.0, 1.15);
  k.prism(1.6, 0.35, 0.85, st.trim, 0, 1.12, 1.15).scale.set(1, 1, 1);
  for (let i = 0; i < 4; i++) k.cyl(0.07, 0.07, 1.0, 8, st.trim, -0.6 + i * 0.4, 0, 1.4);
  k.box(0.9, 1.2, 0.9, st.wall, 0, 1.18, -0.35);
  k.box(0.95, 0.08, 0.95, st.trim, 0, 2.38, -0.35);
  k.cyl(0.2, 0.2, 0.03, 12, '#f6f0dc', 0, 1.9, 0.11).rotation.x = Math.PI / 2;
  k.box(0.02, 0.14, 0.02, '#2b2420', 0, 1.84, 0.13);
  k.box(0.1, 0.02, 0.02, '#2b2420', 0.04, 1.9, 0.13);
  k.dome(0.42, st.roof2, 0, 2.46, -0.35);
  k.cyl(0.02, 0.02, 0.5, 4, '#c8a040', 0, 2.85, -0.35);
  for (let i = 0; i < 6; i++) window(k, st, -1.5 + i * 0.6, 0.45, 0.86, 0.14, 0.3);
  k.box(0.5, 0.75, 0.04, '#3a2b20', 0, 0, 0.86);
  banner(k, -1.85, 0, 1.75, 1.6, 1.2);
  banner(k, 1.85, 0, 1.75, 1.6, 1.2);
}

// ---- Houses ----------------------------------------------------------------------------------------

function house(k: Kit, e: number, st: Style): void {
  pad(k, 2, st.base);
  if (e === 0) {
    hut(k, st, -0.1, -0.05, 0.55, 0.5);
    k.cyl(0.03, 0.03, 0.4, 4, st.post, 0.7, 0, 0.55);
    k.team(k.box(0.02, 0.14, 0.2, TEAM, 0.7, 0.24, 0.65));
    k.box(0.3, 0.12, 0.2, '#6d4a2e', 0.55, 0, -0.6);
    return;
  }
  if (e === 1) {
    k.box(1.3, 0.7, 1.2, st.wall, -0.1, 0, -0.1);
    k.box(1.36, 0.08, 1.26, st.trim, -0.1, 0.7, -0.1);
    k.box(0.6, 0.35, 0.55, st.wall2, -0.35, 0.78, -0.3);
    k.box(0.7, 0.05, 0.6, st.roof, 0.35, 0.68, 0.55);
    for (const x of [0.05, 0.6]) k.cyl(0.03, 0.03, 0.66, 5, st.post, x, 0, 0.8);
    k.box(0.28, 0.42, 0.03, '#3a2b20', -0.1, 0, 0.51);
    window(k, st, -0.5, 0.38, 0.51, 0.1, 0.12);
    k.team(k.box(0.7, 0.02, 0.6, TEAM, 0.35, 0.73, 0.55));
    return;
  }
  if (e === 2) {
    k.box(1.3, 0.35, 1.1, STONE, 0, 0, -0.05);
    k.box(1.3, 0.5, 1.1, st.wall, 0, 0.35, -0.05);
    for (const x of [-0.6, -0.2, 0.2, 0.6]) k.box(0.05, 0.5, 1.12, st.trim, x, 0.35, -0.05);
    k.box(1.32, 0.05, 1.12, st.trim, 0, 0.6, -0.05);
    k.prism(1.45, 0.75, 1.3, st.roof, 0, 0.85, -0.05);
    k.box(0.16, 0.5, 0.16, STONE, 0.45, 1.05, -0.3);
    window(k, st, -0.35, 0.5, 0.51);
    window(k, st, 0.3, 0.5, 0.51);
    k.box(0.24, 0.38, 0.03, '#3a2b20', -0.02, 0, 0.51);
    k.team(k.box(0.3, 0.04, 0.03, TEAM, -0.02, 0.4, 0.52));
    return;
  }
  k.box(1.4, 0.95, 1.15, st.wall, 0, 0, -0.05);
  k.box(1.44, 0.06, 1.2, st.trim, 0, 0.95, -0.05);
  k.prism(1.5, 0.6, 1.3, st.roof, 0, 1.0, -0.05);
  k.box(0.18, 0.55, 0.18, st.wall, -0.45, 1.05, -0.25);
  for (const x of [-0.4, 0.4]) for (const y of [0.22, 0.6]) window(k, st, x, y, 0.53, 0.16, 0.2);
  k.box(0.26, 0.45, 0.03, '#3a2b20', 0, 0, 0.53);
  k.team(k.box(0.32, 0.05, 0.12, TEAM, 0, 0.47, 0.6));
}

// ---- Storehouse ------------------------------------------------------------------------------------

function storehouse(k: Kit, e: number, st: Style): void {
  pad(k, 2, st.base);
  // An open shed on posts over piles of logs, stone and gold.
  for (const [x, z] of [[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.4], [0.7, 0.4]]) k.cyl(0.05, 0.05, 0.75, 5, e >= 2 ? STONE : st.post, x, 0, z);
  if (e === 0) k.cone(1.15, 0.5, 4, st.roof, 0, 0.75, -0.1).rotation.y = Math.PI / 4;
  else k.prism(1.6, 0.45, 1.3, st.roof, 0, 0.75, -0.1);
  k.box(1.5, 0.35, 0.08, e >= 2 ? st.wall : st.wall2, 0, 0, -0.68);
  for (let i = 0; i < 3; i++) {
    const log = k.cyl(0.07, 0.07, 0.7, 6, '#8a6440', -0.35, 0.07 + i * 0.13, -0.3 + (i % 2) * 0.07);
    log.rotation.x = Math.PI / 2;
    log.rotation.z = Math.PI / 2;
  }
  k.box(0.22, 0.2, 0.22, '#b3aca2', 0.35, 0, -0.35);
  k.box(0.2, 0.18, 0.2, '#a39c92', 0.42, 0.2, -0.3);
  k.sphere(0.1, '#e2b23c', 0.3, 0.08, 0.15).scale.set(1, 0.8, 1);
  k.sphere(0.08, '#cfa030', 0.45, 0.07, 0.25);
  k.cyl(0.12, 0.1, 0.25, 7, '#b08a4e', -0.4, 0, 0.6);
  k.team(k.box(1.62, 0.05, 0.06, TEAM, 0, 0.74, 0.55));
  banner(k, 0.85, 0, 0.85, 0.9);
}

// ---- Farm ------------------------------------------------------------------------------------------

function farm(k: Kit, e: number, st: Style): void {
  // Tilled earth with rows of grain, fenced in later epochs.
  k.box(2.9, 0.05, 2.9, '#7a5a3c', 0, -0.02, 0);
  const crop = e === 0 ? '#c8b04a' : e === 1 ? '#d6b84e' : e === 2 ? '#c9b24a' : '#b9b048';
  for (let r = 0; r < 6; r++) {
    const z = -1.15 + r * 0.46;
    k.box(2.6, 0.05, 0.18, '#634632', 0, 0.02, z);
    for (let c = 0; c < 9; c++) {
      const x = -1.2 + c * 0.3;
      k.cone(0.07, 0.24 + ((r * 7 + c * 3) % 5) * 0.02, 4, c % 3 ? crop : '#a8b048', x, 0.05, z);
    }
  }
  if (e >= 1) {
    const post = e >= 2 ? st.trim : st.post;
    for (let i = 0; i <= 6; i++) {
      const t = -1.42 + i * 0.473;
      for (const [x, z] of [[t, -1.42], [t, 1.42], [-1.42, t], [1.42, t]]) k.cyl(0.025, 0.025, 0.22, 4, post, x, 0, z);
    }
    for (const z of [-1.42, 1.42]) k.box(2.86, 0.03, 0.03, post, 0, 0.16, z);
    for (const x of [-1.42, 1.42]) k.box(0.03, 0.03, 2.86, post, x, 0.16, 0);
  }
  k.cyl(0.02, 0.02, 0.5, 4, WOOD, 1.25, 0, 1.25);
  k.team(k.box(0.012, 0.12, 0.16, TEAM, 1.25, 0.34, 1.33));
  if (e >= 2) {
    // A scarecrow.
    k.cyl(0.015, 0.015, 0.5, 4, WOOD, -1.0, 0, 0.9);
    k.box(0.32, 0.02, 0.02, WOOD, -1.0, 0.38, 0.9);
    k.sphere(0.05, HAY, -1.0, 0.52, 0.9);
    k.cone(0.07, 0.07, 6, '#6b5a3a', -1.0, 0.55, 0.9);
  }
}

// ---- Barracks, range, stable -----------------------------------------------------------------------

function barracks(k: Kit, e: number, st: Style): void {
  pad(k, 3, st.base);
  if (e === 0) {
    // A palisade yard around a long hut, with a weapon rack.
    for (let i = 0; i < 11; i++) {
      const t = -1.3 + i * 0.26;
      k.cone(0.06, 0.12, 4, st.post, t, 0.6, -1.3);
      k.cyl(0.06, 0.06, 0.6, 5, st.post, t, 0, -1.3);
      k.cyl(0.06, 0.06, 0.6, 5, st.post, -1.3, 0, t);
      k.cone(0.06, 0.12, 4, st.post, -1.3, 0.6, t);
    }
    k.box(1.8, 0.55, 1.0, st.wall, 0.2, 0, -0.55);
    k.prism(1.9, 0.6, 1.2, st.roof, 0.2, 0.55, -0.55);
    for (let i = 0; i < 4; i++) k.cyl(0.015, 0.015, 0.55, 4, WOOD, 0.5 + i * 0.12, 0, 0.6).rotation.z = 0.2;
    k.box(0.6, 0.04, 0.06, WOOD, 0.68, 0.4, 0.6);
    banner(k, -1.1, 0, 1.1, 1.2, 1.1);
    torch(k, -0.4, 0, 0.2);
    return;
  }
  if (e === 1) {
    k.box(2.6, 0.8, 1.4, st.wall, 0, 0, -0.6);
    k.box(2.7, 0.07, 1.5, st.trim, 0, 0.8, -0.6);
    k.box(2.6, 0.08, 0.7, st.roof, 0, 0.75, 0.45);
    for (let i = 0; i < 5; i++) k.cyl(0.06, 0.07, 0.75, 7, st.trim, -1.15 + i * 0.575, 0, 0.75);
    k.box(0.4, 0.55, 0.04, '#3a2b20', 0, 0, 0.11);
    for (const x of [-0.8, 0.8]) {
      const shield = k.team(k.cyl(0.14, 0.14, 0.03, 10, TEAM, x, 0.42, 0.12));
      shield.rotation.x = Math.PI / 2;
    }
    banner(k, -1.25, 0, 1.25, 1.3, 1.1);
    banner(k, 1.25, 0, 1.25, 1.3, 1.1);
    return;
  }
  if (e === 2) {
    k.box(2.6, 1.0, 1.6, STONE, 0, 0, -0.5);
    for (let i = 0; i < 9; i++) k.box(0.18, 0.18, 0.18, STONE, -1.2 + i * 0.3, 1.0, 0.25);
    k.prism(2.4, 0.6, 1.2, st.roof, 0, 1.0, -0.65);
    for (const x of [-1.2, 1.2]) {
      k.cyl(0.32, 0.34, 1.35, 8, STONE, x, 0, 0.2);
      k.cone(0.4, 0.55, 8, st.roof, x, 1.35, 0.2);
    }
    k.box(0.5, 0.7, 0.04, '#3a2b20', 0, 0, 0.31);
    window(k, st, -0.6, 0.55, 0.31);
    window(k, st, 0.6, 0.55, 0.31);
    k.team(k.box(0.4, 0.5, 0.02, TEAM, 0, 0.75, 0.33));
    banner(k, 1.2, 1.9, 0.2, 0.7);
    banner(k, -1.2, 1.9, 0.2, 0.7);
    return;
  }
  k.box(2.7, 1.3, 1.6, st.wall, 0, 0, -0.5);
  k.box(2.76, 0.07, 1.66, st.trim, 0, 1.3, -0.5);
  k.prism(2.8, 0.65, 1.7, st.roof, 0, 1.36, -0.5);
  for (let i = 0; i < 5; i++) for (const y of [0.25, 0.8]) window(k, st, -1.0 + i * 0.5, y, 0.31, 0.16, 0.24);
  k.box(0.5, 0.7, 0.04, '#3a2b20', 0, 0, 0.31);
  k.cyl(0.04, 0.04, 2.6, 5, '#e8e2d0', 1.2, 0, 1.2);
  k.team(k.box(0.02, 0.4, 0.6, TEAM, 1.2, 2.1, 1.5));
  for (const x of [-0.9, -0.5]) {
    k.cyl(0.07, 0.08, 0.12, 8, IRON_DARK, x, 0, 0.9);
    k.cyl(0.05, 0.05, 0.4, 6, IRON_DARK, x, 0.08, 1.1).rotation.x = Math.PI / 2 - 0.2;
  }
}

const IRON_DARK = '#3f4247';

function target(k: Kit, x: number, z: number): void {
  k.cyl(0.02, 0.02, 0.5, 4, WOOD, x - 0.1, 0, z - 0.05).rotation.x = -0.25;
  k.cyl(0.02, 0.02, 0.5, 4, WOOD, x + 0.1, 0, z - 0.05).rotation.x = -0.25;
  const face = k.cyl(0.2, 0.2, 0.06, 12, HAY, x, 0.42, z);
  face.rotation.x = Math.PI / 2 - 0.25;
  const ring = k.team(k.cyl(0.13, 0.13, 0.07, 12, TEAM, x, 0.42, z));
  ring.rotation.x = Math.PI / 2 - 0.25;
  const eye = k.cyl(0.05, 0.05, 0.08, 10, '#d83a2e', x, 0.42, z);
  eye.rotation.x = Math.PI / 2 - 0.25;
}

function range(k: Kit, e: number, st: Style): void {
  pad(k, 3, st.base);
  // A shooting shed at the back, targets in front.
  if (e === 0) {
    for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, -0.3], [1.2, -0.3]]) k.cyl(0.05, 0.05, 0.75, 5, st.post, x, 0, z);
    k.prism(2.7, 0.55, 1.2, st.roof, 0, 0.75, -0.75);
  } else if (e === 1) {
    k.box(2.6, 0.8, 1.0, st.wall, 0, 0, -0.85);
    k.box(2.7, 0.07, 1.1, st.trim, 0, 0.8, -0.85);
    for (let i = 0; i < 4; i++) k.cyl(0.05, 0.06, 0.8, 6, st.trim, -1.0 + i * 0.66, 0, -0.25);
    k.box(2.6, 0.06, 0.7, st.roof, 0, 0.78, -0.3);
  } else if (e === 2) {
    k.box(2.6, 0.85, 1.0, st.wall, 0, 0, -0.85);
    for (const x of [-1.0, -0.5, 0, 0.5, 1.0]) k.box(0.05, 0.85, 1.02, st.trim, x, 0, -0.85);
    k.prism(2.7, 0.65, 1.2, st.roof, 0, 0.85, -0.85);
    window(k, st, -0.6, 0.4, -0.34);
    window(k, st, 0.6, 0.4, -0.34);
  } else {
    k.box(2.6, 0.95, 1.0, st.wall, 0, 0, -0.85);
    k.box(2.66, 0.06, 1.06, st.trim, 0, 0.95, -0.85);
    k.prism(2.7, 0.55, 1.1, st.roof, 0, 1.0, -0.85);
    for (let i = 0; i < 4; i++) window(k, st, -0.9 + i * 0.6, 0.45, -0.34, 0.16, 0.26);
  }
  target(k, -0.8, 0.9);
  target(k, 0.0, 1.05);
  target(k, 0.8, 0.9);
  for (let i = 0; i < 3; i++) k.cone(0.012, 0.18, 3, '#f0f0f0', 0.5 + i * 0.05, 0, 0.2);
  banner(k, -1.3, 0, 0.3, 1.1);
}

function stable(k: Kit, e: number, st: Style): void {
  pad(k, 3, st.base);
  // A long stable with stalls, hay and a trough.
  const wall = e >= 2 ? st.wall : st.wall2;
  k.box(2.7, 0.7, 1.3, wall, 0, 0, -0.65);
  if (e === 2) for (const x of [-1.3, -0.65, 0, 0.65, 1.3]) k.box(0.05, 0.7, 1.32, st.trim, x, 0, -0.65);
  if (e === 3) k.box(2.76, 0.06, 1.36, st.trim, 0, 0.7, -0.65);
  k.prism(2.85, 0.6, 1.6, st.roof, 0, 0.7, -0.55);
  for (let i = 0; i < 4; i++) {
    const x = -1.0 + i * 0.66;
    k.box(0.5, 0.45, 0.03, '#3a2b20', x, 0, 0.01);
    k.box(0.5, 0.04, 0.04, st.post, x, 0.45, 0.02);
  }
  for (let i = 0; i < 3; i++) k.box(0.32, 0.22, 0.24, HAY, -1.1 + i * 0.36, 0, 0.7);
  k.box(0.3, 0.2, 0.26, HAY, -0.92, 0.22, 0.7);
  k.box(0.7, 0.16, 0.22, WOOD, 0.7, 0, 0.75);
  k.box(0.62, 0.02, 0.16, '#5aa0c8', 0.7, 0.15, 0.75);
  k.team(k.box(2.88, 0.06, 0.06, TEAM, 0, 0.72, 0.27));
  banner(k, 1.3, 0, 1.25, 1.2);
}

// ---- Tower -----------------------------------------------------------------------------------------

function tower(k: Kit, e: number, st: Style): void {
  pad(k, 2, st.base);
  if (e <= 1) {
    // A mudbrick (or timber) watchtower with a lookout under a shade.
    const wall = e === 0 ? st.post : st.wall;
    k.box(1.0, 1.9, 1.0, wall, 0, 0, 0);
    k.box(1.25, 0.12, 1.25, st.trim, 0, 1.9, 0);
    for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) k.cyl(0.04, 0.04, 0.55, 4, st.post, x, 2.0, z);
    k.pyramid(1.4, 0.4, 1.4, st.roof, 0, 2.55, 0);
    k.team(k.box(1.02, 0.15, 1.02, TEAM, 0, 1.55, 0));
    window(k, st, 0, 1.2, 0.51, 0.1, 0.22);
    banner(k, 0, 2.95, 0, 0.6, 0.8);
    return;
  }
  if (e === 2) {
    k.cyl(0.62, 0.72, 2.3, 10, STONE, 0, 0, 0);
    k.cyl(0.74, 0.74, 0.12, 10, '#8f897f', 0, 2.3, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.box(0.18, 0.2, 0.18, STONE, Math.cos(a) * 0.66, 2.42, Math.sin(a) * 0.66);
    }
    k.cone(0.6, 0.9, 10, st.roof, 0, 2.42, 0);
    window(k, st, 0, 1.4, 0.64, 0.1, 0.24);
    k.team(k.box(0.36, 0.5, 0.02, TEAM, 0, 0.7, 0.7));
    banner(k, 0, 3.3, 0, 0.6, 0.8);
    return;
  }
  k.box(1.3, 1.0, 1.3, STONE, 0, 0, 0);
  k.box(1.0, 1.5, 1.0, st.wall, 0, 1.0, 0);
  k.box(1.15, 0.1, 1.15, st.trim, 0, 2.5, 0);
  for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) k.box(0.2, 0.22, 0.2, st.wall, x, 2.6, z);
  k.cyl(0.05, 0.06, 0.4, 6, IRON_DARK, 0, 2.62, 0.45).rotation.x = Math.PI / 2;
  for (const y of [1.3, 1.9]) window(k, st, 0, y, 0.51, 0.12, 0.2);
  k.team(k.box(1.02, 0.12, 1.02, TEAM, 0, 1.0, 0));
  banner(k, 0, 2.6, 0, 0.8, 0.8);
}

const MAKERS: Record<BuildingType, (k: Kit, e: number, st: Style) => void> = { towncenter, house, storehouse, farm, barracks, range, stable, tower };

const cache = new Map<string, THREE.BufferGeometry>();

/** The baked model of a building in an epoch, in a player's color. */
export function buildingGeometry(type: BuildingType, epoch: number, color: string): THREE.BufferGeometry {
  const key = `${type}:${epoch}:${color}`;
  let g = cache.get(key);
  if (!g) {
    const k = new Kit();
    MAKERS[type](k, epoch, STYLES[epoch]);
    g = bake(k.root, color);
    cache.set(key, g);
  }
  return g;
}

/** A building site: a cleared pad, stakes at the corners and a heap of timber. */
export function foundationGeometry(size: number): THREE.BufferGeometry {
  const key = `site:${size}`;
  let g = cache.get(key);
  if (!g) {
    const k = new Kit();
    k.box(size - 0.1, 0.05, size - 0.1, '#9a7b58', 0, -0.02, 0);
    const h = size / 2 - 0.12;
    for (const [x, z] of [[-h, -h], [h, -h], [-h, h], [h, h]]) {
      k.cyl(0.035, 0.035, 0.35, 4, '#7a5636', x, 0, z);
      k.box(0.08, 0.06, 0.02, '#f2e2b0', x, 0.3, z);
    }
    for (let i = 0; i < 3; i++) {
      const log = k.cyl(0.05, 0.05, size * 0.35, 5, '#8a6440', -h + 0.35, 0.05 + i * 0.09, h - 0.3 + (i % 2) * 0.05);
      log.rotation.z = Math.PI / 2;
    }
    g = bake(k.root);
    cache.set(key, g);
  }
  return g;
}

/** Scaffolding poles around a rising building. */
export function scaffoldGeometry(size: number): THREE.BufferGeometry {
  const key = `scaffold:${size}`;
  let g = cache.get(key);
  if (!g) {
    const k = new Kit();
    const h = size / 2 - 0.05;
    const top = 0.9 + size * 0.25;
    for (const [x, z] of [[-h, -h], [h, -h], [-h, h], [h, h], [0, -h], [0, h], [-h, 0], [h, 0]]) k.cyl(0.025, 0.025, top, 4, '#9a7448', x, 0, z);
    for (const y of [top * 0.45, top * 0.9]) {
      for (const z of [-h, h]) k.box(size - 0.1, 0.03, 0.05, '#9a7448', 0, y, z);
      for (const x of [-h, h]) k.box(0.05, 0.03, size - 0.1, '#9a7448', x, y, 0);
    }
    g = bake(k.root);
    cache.set(key, g);
  }
  return g;
}

/** What's left after a building falls: scattered rubble and charred timber. */
export function rubbleGeometry(size: number, epoch: number): THREE.BufferGeometry {
  const key = `rubble:${size}:${epoch}`;
  let g = cache.get(key);
  if (!g) {
    const k = new Kit();
    k.box(size - 0.2, 0.04, size - 0.2, '#5a4a3a', 0, -0.01, 0);
    const n = size * size * 2;
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996;
      const r = (Math.sqrt(i + 0.5) / Math.sqrt(n)) * (size / 2 - 0.2);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (i % 3 === 0) {
        const beam = k.box(0.5, 0.06, 0.07, '#3a2a1e', x, 0.03, z);
        beam.rotation.y = a;
        beam.rotation.z = 0.2;
      } else k.rock(0.1 + (i % 4) * 0.04, epoch >= 2 ? '#8f897f' : epoch === 1 ? '#c49a6a' : '#7a6a52', x, 0.05, z);
    }
    g = bake(k.root);
    cache.set(key, g);
  }
  return g;
}
