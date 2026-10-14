import * as THREE from 'three';
import type { AgeId, BuildingType } from '../sim/types';
import { Kit, bake, rnd } from './kit';

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
  { wall: '#8a3c2c', wall2: '#d8d0c0', roof: '#4a5058', roof2: '#3a4048', trim: '#e8e2d4', base: '#7a756c', post: '#3a3a3e', window: '#2c3440' },
];

const TEAM = '#f4f4f4';
const WOOD = '#7a5636';
const STONE = '#9d978d';
const HAY = '#d8c06a';
const LIGHT = '#ffc46b';

function banner(k: Kit, x: number, y: number, z: number, h = 0.7, big = 1): void {
  k.cyl(0.018, 0.022, h, 5, '#5b4330', x, y, z);
  k.cloth(k.team(k.box(0.012, 0.22 * big, 0.3 * big, TEAM, x, y + h - 0.26 * big, z + 0.15 * big)), 0.3 * big, z);
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
  if (e >= 3) k.box(2.76, 0.06, 1.36, st.trim, 0, 0.7, -0.65);
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

// ---- Forge -----------------------------------------------------------------------------------------

function anvil(k: Kit, x: number, z: number): void {
  k.box(0.12, 0.18, 0.12, '#4a3a2c', x, 0, z);
  k.box(0.26, 0.08, 0.12, IRON_DARK, x, 0.18, z);
  k.cone(0.05, 0.1, 4, IRON_DARK, x + 0.16, 0.2, z).rotation.z = -Math.PI / 2;
}

function forge(k: Kit, e: number, st: Style): void {
  pad(k, 3, st.base);
  const wall = e >= 2 ? STONE : st.wall;
  // A smithy with a roaring furnace, a tall chimney and an anvil out front.
  k.box(2.3, 0.95, 1.3, e >= 3 ? st.wall : wall, -0.2, 0, -0.6);
  if (e === 2) for (const x of [-1.2, -0.6, 0, 0.6, 0.8]) k.box(0.05, 0.95, 1.32, st.trim, x, 0, -0.6);
  k.box(2.36, 0.06, 1.36, st.trim, -0.2, 0.95, -0.6);
  if (e === 1 || e === 0) k.box(2.3, 0.1, 1.3, st.roof, -0.2, 1.0, -0.6);
  else k.prism(2.4, 0.6, 1.45, st.roof, -0.2, 1.0, -0.6);
  // Open-fronted forge under a lean-to.
  k.box(1.0, 0.08, 0.8, st.roof2, 0.8, 0.85, 0.35);
  for (const x of [0.35, 1.25]) k.cyl(0.05, 0.05, 0.85, 6, st.post, x, 0, 0.72);
  k.box(0.7, 0.4, 0.5, '#5a4c40', 0.8, 0, 0.1);
  k.glow(k.box(0.36, 0.16, 0.06, '#ff7a2a', 0.8, 0.12, 0.36));
  // The chimney.
  k.box(0.42, 2.0, 0.42, e >= 3 ? st.wall : STONE, 0.95, 0, -0.75);
  k.box(0.5, 0.1, 0.5, '#5a544c', 0.95, 2.0, -0.75);
  if (e >= 3) {
    k.box(0.32, 1.7, 0.32, st.wall, -1.0, 0.9, -0.85);
    k.box(0.4, 0.08, 0.4, '#5a544c', -1.0, 2.6, -0.85);
  }
  k.glow(k.box(0.3, 0.04, 0.3, '#ff9a3c', 0.95, 2.06, -0.75));
  anvil(k, 0.2, 0.7);
  // A rack of finished blades and a quench barrel.
  k.box(0.04, 0.5, 0.5, WOOD, -1.25, 0, 0.45);
  for (let i = 0; i < 3; i++) k.box(0.02, 0.42, 0.05, '#c8ccd0', -1.22, 0.08, 0.3 + i * 0.15);
  k.cyl(0.14, 0.12, 0.3, 8, WOOD, -0.6, 0, 0.8);
  k.cyl(0.12, 0.12, 0.02, 8, '#4a7090', -0.6, 0.3, 0.8);
  window(k, st, -0.6, 0.45, 0.06);
  k.box(0.36, 0.55, 0.04, '#3a2b20', -0.15, 0, 0.06);
  k.team(k.box(2.38, 0.08, 0.04, TEAM, -0.2, 0.86, 0.08));
  banner(k, -1.3, 0, 1.3, 1.2);
}

// ---- Siege workshop --------------------------------------------------------------------------------

function workshop(k: Kit, e: number, st: Style): void {
  pad(k, 3, st.base);
  // A great open shed on heavy posts, a half-built engine inside and a crane over the yard.
  const post = e >= 2 ? st.trim : st.post;
  for (const x of [-1.25, -0.4, 0.45, 1.25]) for (const z of [-1.2, 0.1]) k.cyl(0.07, 0.08, 1.1, 6, post, x, 0, z);
  k.box(2.6, 0.9, 0.08, e >= 2 ? STONE : st.wall, 0, 0, -1.25);
  if (e <= 1) k.box(2.75, 0.1, 1.55, st.roof, 0, 1.1, -0.55);
  else k.prism(2.8, 0.6, 1.7, st.roof, 0, 1.1, -0.55);
  // The engine on the stocks: a frame on wheels.
  for (const x of [-0.6, 0.4]) {
    for (const z of [-0.95, -0.15]) {
      const w = k.cyl(0.16, 0.16, 0.06, 10, '#5b4330', x, 0.16, z);
      w.rotation.x = Math.PI / 2;
      w.position.y = 0.16;
    }
  }
  k.box(1.3, 0.1, 0.7, WOOD, -0.1, 0.26, -0.55);
  const arm = k.box(0.08, 0.08, 1.2, '#8a6440', -0.1, 0.36, -0.55);
  arm.rotation.x = -0.6;
  k.box(0.12, 0.5, 0.12, WOOD, -0.1, 0.36, -0.55);
  // Timber and a crane.
  for (let i = 0; i < 3; i++) {
    const log = k.cyl(0.08, 0.08, 0.9, 6, '#8a6440', 0.9, 0.08 + i * 0.15, 0.85 - (i % 2) * 0.08);
    log.rotation.z = Math.PI / 2;
  }
  k.cyl(0.05, 0.06, 1.7, 5, WOOD, -1.1, 0, 1.0);
  const jib = k.box(0.05, 0.05, 1.1, WOOD, -1.1, 1.55, 0.6);
  jib.rotation.x = 0.35;
  k.cyl(0.006, 0.006, 0.7, 3, '#d8d0b8', -1.1, 0.85, 0.2);
  k.box(0.16, 0.16, 0.16, STONE, -1.1, 0.7, 0.2);
  if (e >= 3) {
    k.cyl(0.09, 0.1, 0.12, 8, IRON_DARK, 0.6, 0, 0.5);
    k.cyl(0.06, 0.07, 0.6, 8, IRON_DARK, 0.6, 0.1, 0.75).rotation.x = Math.PI / 2;
  }
  k.team(k.box(2.82, 0.06, 0.06, TEAM, 0, 1.08, 0.2));
  banner(k, 1.3, 0, 1.3, 1.3);
}

// ---- Temple ----------------------------------------------------------------------------------------

function temple(k: Kit, e: number, st: Style): void {
  pad(k, 3, st.base);
  if (e <= 1) {
    // A stepped platform, a columned shrine and a pediment, a sacred fire before it.
    k.box(2.7, 0.15, 2.3, st.trim, 0, 0, -0.1);
    k.box(2.45, 0.15, 2.05, st.trim, 0, 0.15, -0.1);
    k.box(1.7, 0.9, 1.2, st.wall, 0, 0.3, -0.35);
    for (let i = 0; i < 6; i++) {
      k.cyl(0.07, 0.08, 0.95, 8, '#f2ead8', -1.0 + i * 0.4, 0.3, 0.65);
      k.cyl(0.07, 0.08, 0.95, 8, '#f2ead8', -1.0 + i * 0.4, 0.3, -1.0);
    }
    k.box(2.3, 0.14, 1.95, '#f2ead8', 0, 1.25, -0.17);
    k.prism(2.3, 0.45, 2.0, st.roof, 0, 1.39, -0.17);
    k.team(k.box(2.32, 0.06, 0.04, TEAM, 0, 1.3, 0.81));
    k.cyl(0.14, 0.16, 0.3, 8, '#8d7a62', 0, 0, 1.25);
    k.glow(k.cone(0.1, 0.24, 5, '#ffb24a', 0, 0.3, 1.25));
    banner(k, -1.25, 0, 1.25, 1.4);
    banner(k, 1.25, 0, 1.25, 1.4);
    return;
  }
  if (e === 2) {
    // A stone church with a long nave, a bell tower and a spire.
    k.box(1.4, 1.1, 2.4, STONE, 0.3, 0, -0.1);
    k.prism(2.5, 0.8, 1.55, st.roof, 0.3, 1.1, -0.1).rotation.y = Math.PI / 2;
    k.box(0.8, 2.0, 0.8, STONE, -0.9, 0, 0.6);
    k.box(0.86, 0.08, 0.86, '#8f897f', -0.9, 2.0, 0.6);
    k.cone(0.55, 1.2, 4, st.roof, -0.9, 2.08, 0.6).rotation.y = Math.PI / 4;
    k.box(0.04, 0.5, 0.04, '#e2b23c', -0.9, 3.25, 0.6);
    k.box(0.24, 0.04, 0.04, '#e2b23c', -0.9, 3.55, 0.6);
    k.cyl(0.24, 0.24, 0.04, 12, '#c8a040', 0.3, 0.8, 1.11).rotation.x = Math.PI / 2;
    k.glow(k.cyl(0.17, 0.17, 0.05, 12, '#7ab0ff', 0.3, 0.8, 1.11)).rotation.x = Math.PI / 2;
    for (const z of [-0.8, -0.2, 0.4]) window(k, st, 1.01, 0.55, z, 0.12, 0.34, true, true);
    k.box(0.36, 0.6, 0.04, '#3a2b20', 0.3, 0, 1.1);
    k.team(k.box(0.5, 0.36, 0.02, TEAM, -0.9, 1.3, 1.01));
    banner(k, 1.3, 0, 1.3, 1.2);
    return;
  }
  // A domed church of brick and white stone with a portico and a bell tower.
  k.box(2.0, 1.2, 1.9, st.wall2, 0.1, 0, -0.3);
  k.box(2.06, 0.08, 1.96, st.trim, 0.1, 1.2, -0.3);
  k.cyl(0.62, 0.66, 0.4, 12, st.wall2, 0.1, 1.28, -0.3);
  k.dome(0.64, '#5f8a8a', 0.1, 1.68, -0.3);
  k.cyl(0.02, 0.02, 0.4, 4, '#e2b23c', 0.1, 2.3, -0.3);
  k.box(0.2, 0.03, 0.03, '#e2b23c', 0.1, 2.55, -0.3);
  for (let i = 0; i < 4; i++) k.cyl(0.06, 0.06, 0.95, 8, st.wall2, -0.5 + i * 0.4, 0, 0.9);
  k.box(1.5, 0.1, 0.55, st.trim, 0.1, 0.95, 0.72);
  k.prism(1.5, 0.35, 0.6, st.wall2, 0.1, 1.05, 0.72);
  k.box(0.6, 2.1, 0.6, st.wall, -1.05, 0, -1.0);
  k.box(0.66, 0.06, 0.66, st.trim, -1.05, 2.1, -1.0);
  k.cone(0.4, 0.7, 4, st.roof, -1.05, 2.16, -1.0).rotation.y = Math.PI / 4;
  for (const x of [-0.5, 0.7]) window(k, st, x, 0.5, 0.66, 0.16, 0.36);
  k.box(0.4, 0.7, 0.04, '#3a2b20', 0.1, 0, 0.66);
  k.team(k.box(1.52, 0.06, 0.04, TEAM, 0.1, 1.0, 1.0));
  banner(k, 1.3, 0, 1.3, 1.3);
}

// ---- Market ----------------------------------------------------------------------------------------

function stall(k: Kit, st: Style, x: number, z: number, goods: string): void {
  for (const [dx, dz] of [[-0.3, -0.25], [0.3, -0.25], [-0.3, 0.25], [0.3, 0.25]]) k.cyl(0.025, 0.025, 0.6, 4, st.post, x + dx, 0, z + dz);
  const awn = k.team(k.box(0.75, 0.04, 0.66, TEAM, x, 0.6, z));
  awn.rotation.x = -0.15;
  k.box(0.65, 0.3, 0.3, WOOD, x, 0, z - 0.1);
  for (let i = 0; i < 3; i++) k.sphere(0.07, goods, x - 0.18 + i * 0.18, 0.36, z - 0.1);
}

function market(k: Kit, e: number, st: Style): void {
  pad(k, 3, st.base);
  if (e >= 2) {
    // A covered market hall on arches behind the stalls.
    k.box(2.6, 0.12, 1.2, st.wall2, 0, 0.95, -0.75);
    for (const x of [-1.2, -0.4, 0.4, 1.2]) for (const z of [-1.25, -0.25]) k.box(0.18, 0.95, 0.18, e >= 3 ? st.wall2 : STONE, x, 0, z);
    k.box(2.6, 0.7, 1.2, st.wall, 0, 1.07, -0.75);
    if (e === 2) for (const x of [-1.0, -0.5, 0, 0.5, 1.0]) k.box(0.05, 0.7, 1.22, st.trim, x, 1.07, -0.75);
    k.prism(2.7, 0.6, 1.35, st.roof, 0, 1.77, -0.75);
    for (const x of [-0.8, 0, 0.8]) window(k, st, x, 1.3, -0.14);
    k.box(0.6, 0.35, 0.4, '#8a6440', -0.6, 0, -0.8);
    k.box(0.4, 0.3, 0.3, '#a07a50', 0.6, 0, -0.75);
  } else {
    k.box(2.6, 0.7, 0.9, st.wall, 0, 0, -0.95);
    k.box(2.7, 0.07, 1.0, st.trim, 0, 0.7, -0.95);
    k.box(2.6, 0.08, 0.5, st.roof, 0, 0.66, -0.35);
    for (let i = 0; i < 4; i++) k.cyl(0.04, 0.05, 0.66, 6, st.trim, -1.1 + i * 0.73, 0, -0.15);
  }
  stall(k, st, -0.85, 0.55, '#d8c048');
  stall(k, st, 0.85, 0.55, '#c84a3a');
  stall(k, st, 0, 1.0, '#7aa848');
  // Barrels, sacks and a cart.
  for (const [x, z] of [[1.3, -0.1], [1.15, 0.05]]) k.cyl(0.12, 0.1, 0.28, 8, '#8a6440', x, 0, z);
  k.sphere(0.13, '#d8c08a', -1.3, 0.1, 0.0).scale.set(1, 0.8, 1);
  k.sphere(0.12, '#c8b07a', -1.15, 0.09, 0.15).scale.set(1, 0.8, 1);
  k.sphere(0.1, '#e2b23c', 0.0, 0.35, 0.95);
  banner(k, 1.35, 0, 1.35, 1.3);
}

// ---- Wonder ----------------------------------------------------------------------------------------

function wonder(k: Kit, e: number, st: Style): void {
  if (e >= 4) {
    ironTower(k, st);
    return;
  }
  pad(k, 5, st.base);
  if (e === 0) {
    // A great henge: two rings of standing stones with lintels round an altar fire.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const x = Math.cos(a) * 2.0;
      const z = Math.sin(a) * 2.0;
      const s = k.box(0.32, 1.5, 0.22, '#a8a294', x, 0, z);
      s.rotation.y = -a;
      if (i % 2 === 0) {
        const b = (i + 1) / 14;
        const l = k.box(0.95, 0.2, 0.24, '#9a9488', Math.cos(b * Math.PI * 2) * 2.0, 1.5, Math.sin(b * Math.PI * 2) * 2.0);
        l.rotation.y = -b * Math.PI * 2 + Math.PI / 2;
      }
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      k.box(0.36, 2.1, 0.26, '#b0aa9c', Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05).rotation.y = -a;
    }
    k.box(0.8, 0.3, 0.5, '#8f897f', 0, 0, 0);
    k.glow(k.cone(0.2, 0.4, 6, '#ffb24a', 0, 0.3, 0));
    k.team(k.box(0.82, 0.08, 0.52, TEAM, 0, 0.22, 0));
    return;
  }
  if (e === 1) {
    // A ziggurat: terraces of mudbrick up to a shrine of gold, a long stair up the front.
    const tiers = [[4.4, 0.7], [3.5, 0.65], [2.6, 0.6], [1.7, 0.55]];
    let y = 0;
    for (let i = 0; i < tiers.length; i++) {
      const [w, h] = tiers[i];
      k.box(w, h, w, i % 2 ? st.wall2 : st.wall, 0, y, -0.1);
      k.box(w + 0.06, 0.06, w + 0.06, st.trim, 0, y + h - 0.03, -0.1);
      if (i < 3) k.team(k.box(w + 0.04, 0.1, w + 0.04, TEAM, 0, y + h * 0.5, -0.1));
      y += h;
    }
    k.box(0.9, 0.7, 0.9, '#e2b23c', 0, y, -0.1);
    k.pyramid(1.1, 0.5, 1.1, '#e8c050', 0, y + 0.7, -0.1);
    k.glow(k.octa(0.14, LIGHT, 0, y + 1.4, -0.1));
    // The great stair.
    for (let i = 0; i < 10; i++) k.box(0.8, 0.25, 0.25, st.trim, 0, i * 0.25, 2.25 - i * 0.24);
    for (const x of [-2.2, 2.2]) torch(k, x, 0, 2.2);
    banner(k, -1.4, y - 0.55, 1.1, 1.0, 1.1);
    banner(k, 1.4, y - 0.55, 1.1, 1.0, 1.1);
    return;
  }
  if (e === 2) {
    // A cathedral: a tall nave, transepts, twin spires and a great rose window.
    k.box(1.8, 2.0, 4.2, STONE, 0, 0, -0.2);
    k.prism(4.2, 1.2, 2.0, st.roof, 0, 2.0, -0.2).rotation.y = Math.PI / 2;
    k.box(4.0, 1.7, 1.2, STONE, 0, 0, -0.8);
    k.prism(4.0, 1.0, 1.4, st.roof, 0, 1.7, -0.8);
    for (const x of [-0.75, 0.75]) {
      k.box(0.8, 3.2, 0.8, STONE, x, 0, 1.6);
      k.box(0.86, 0.1, 0.86, '#8f897f', x, 3.2, 1.6);
      k.cone(0.5, 1.6, 4, st.roof, x, 3.3, 1.6).rotation.y = Math.PI / 4;
      k.sphere(0.05, '#e2b23c', x, 4.95, 1.6);
    }
    k.cyl(0.42, 0.42, 0.05, 16, '#c8a040', 0, 2.0, 2.02).rotation.x = Math.PI / 2;
    k.glow(k.cyl(0.34, 0.34, 0.06, 16, '#7ab0ff', 0, 2.0, 2.02)).rotation.x = Math.PI / 2;
    // Flying buttresses down the sides.
    for (const z of [-1.8, -0.2]) for (const x of [-1.25, 1.25]) {
      k.box(0.2, 1.5, 0.3, STONE, x, 0, z);
      const fly = k.box(0.08, 0.08, 0.7, '#8f897f', x * 0.82, 1.6, z);
      fly.rotation.y = Math.PI / 2;
      fly.rotation.x = x > 0 ? 0.6 : -0.6;
    }
    for (let i = 0; i < 4; i++) for (const x of [-0.91, 0.91]) window(k, st, x, 0.8, -1.6 + i * 0.9, 0.18, 0.6, true, true);
    k.box(0.6, 1.0, 0.04, '#3a2b20', 0, 0, 2.01);
    k.team(k.box(0.5, 0.7, 0.02, TEAM, -0.75, 2.1, 2.01));
    k.team(k.box(0.5, 0.7, 0.02, TEAM, 0.75, 2.1, 2.01));
    banner(k, -2.1, 0, 2.1, 1.6, 1.2);
    banner(k, 2.1, 0, 2.1, 1.6, 1.2);
    return;
  }
  // A domed palace: colonnaded wings around a great drum and dome, a lantern of gold on top.
  k.box(4.4, 1.3, 2.2, st.wall2, 0, 0, -0.6);
  k.box(4.5, 0.1, 2.3, st.trim, 0, 1.3, -0.6);
  for (let i = 0; i < 10; i++) k.cyl(0.08, 0.08, 1.3, 8, st.wall2, -2.0 + i * 0.444, 0, 0.62);
  k.box(4.5, 0.14, 0.4, st.trim, 0, 1.3, 0.62);
  k.box(1.8, 0.12, 0.9, st.trim, 0, 0, 1.0);
  for (let i = 0; i < 6; i++) k.cyl(0.09, 0.09, 1.6, 8, '#f6f0dc', -0.75 + i * 0.3, 0.12, 1.3);
  k.prism(1.9, 0.55, 0.8, '#f6f0dc', 0, 1.72, 1.15);
  k.cyl(1.0, 1.05, 0.9, 16, st.wall2, 0, 1.4, -0.6);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    k.cyl(0.05, 0.05, 0.9, 6, '#f6f0dc', Math.cos(a) * 1.07, 1.4, -0.6 + Math.sin(a) * 1.07);
  }
  k.dome(1.0, '#6f9a96', 0, 2.3, -0.6);
  k.cyl(0.18, 0.2, 0.5, 8, '#f6f0dc', 0, 3.25, -0.6);
  k.glow(k.sphere(0.12, '#ffd36b', 0, 3.85, -0.6));
  for (const x of [-1.7, -1.1, 1.1, 1.7]) window(k, st, x, 0.5, 0.52, 0.18, 0.4);
  k.team(k.box(4.52, 0.08, 0.06, TEAM, 0, 1.2, 0.83));
  banner(k, -2.2, 0, 2.2, 1.8, 1.3);
  banner(k, 2.2, 0, 2.2, 1.8, 1.3);
  k.cyl(0.03, 0.03, 0.9, 5, '#e8e2d0', 0, 3.95, -0.6);
  k.team(k.box(0.02, 0.28, 0.42, TEAM, 0, 4.5, -0.39));
}

// ---- Walls and gates -------------------------------------------------------------------------------

/** Directions a wall piece reaches toward its neighbors: 1 east (+x), 2 south (+z), 4 west, 8 north. */
const ARMS: [number, number, number][] = [[1, 1, 0], [2, 0, 1], [4, -1, 0], [8, 0, -1]];

function wall(k: Kit, e: number, st: Style, mask: number): void {
  const straight = mask === 5 || mask === 10;
  if (e === 0) {
    // A palisade of sharpened logs.
    const logs = (x: number, z: number) => {
      const h = 1.0 + rnd(x * 7, z * 7, 3) * 0.2;
      k.cyl(0.085, 0.09, h, 6, '#7a5636', x, 0, z);
      k.cone(0.085, 0.18, 6, '#8a6440', x, h, z);
    };
    logs(0, 0);
    for (const [bit, dx, dz] of ARMS) {
      if (!(mask & bit)) continue;
      for (const t of [0.17, 0.34]) logs(dx * t, dz * t);
      k.box(Math.abs(dx) * 0.5 + 0.06, 0.06, Math.abs(dz) * 0.5 + 0.06, '#5b4330', dx * 0.25, 0.55, dz * 0.25);
    }
    if (!mask) for (const [dx, dz] of [[0.17, 0], [-0.17, 0]]) logs(dx, dz);
    k.team(k.box(0.2, 0.08, 0.2, TEAM, 0, 0.42, 0));
    return;
  }
  // Dressed stone (mudbrick in the Bronze Age) with a walkway and crenellations.
  const c = e === 1 ? st.wall : STONE;
  const top = e === 1 ? 1.0 : 1.2;
  const post = straight ? 0.5 : 0.62;
  const ph = straight ? top : top + 0.25;
  k.box(post, ph, post, c, 0, 0, 0);
  k.box(post + 0.06, 0.06, post + 0.06, e === 1 ? st.trim : '#8f897f', 0, ph, 0);
  if (!straight) {
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.14, 0.16, 0.14, c, x * (post / 2 - 0.07), ph + 0.06, z * (post / 2 - 0.07));
    k.team(k.box(post + 0.02, 0.1, post + 0.02, TEAM, 0, ph - 0.3, 0));
  }
  for (const [bit, dx, dz] of ARMS) {
    if (!(mask & bit)) continue;
    const w = Math.abs(dx) * 0.5 + Math.abs(dz) * 0.44;
    const d = Math.abs(dz) * 0.5 + Math.abs(dx) * 0.44;
    k.box(w, top, d, c, dx * 0.25, 0, dz * 0.25);
    // Merlons along both edges.
    for (const side of [-1, 1]) {
      const ox = dz !== 0 ? side * 0.18 : 0;
      const oz = dx !== 0 ? side * 0.18 : 0;
      k.box(dx ? 0.12 : 0.08, 0.16, dz ? 0.12 : 0.08, c, dx * 0.32 + ox, top, dz * 0.32 + oz);
    }
    if (e >= 3) k.box(dx ? 0.5 : 0.46, 0.05, dz ? 0.5 : 0.46, st.trim, dx * 0.25, top * 0.35, dz * 0.25);
  }
}

function gate(k: Kit, e: number, st: Style): void {
  // Two towers either side of a passage along z, with doors standing open for friends.
  const c = e === 0 ? '#7a5636' : e === 1 ? st.wall : STONE;
  const h = e === 0 ? 1.3 : 1.6;
  for (const x of [-0.72, 0.72]) {
    if (e === 0) {
      for (const dx of [-0.17, 0, 0.17]) for (const dz of [-0.17, 0.17]) {
        k.cyl(0.09, 0.09, h, 6, c, x + dx, 0, dz);
        k.cone(0.09, 0.18, 6, '#8a6440', x + dx, h, dz);
      }
    } else {
      k.box(0.56, h, 0.8, c, x, 0, 0);
      k.box(0.62, 0.06, 0.86, e === 1 ? st.trim : '#8f897f', x, h, 0);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.13, 0.16, 0.13, c, x + dx * 0.21, h + 0.06, dz * 0.33);
    }
    // Wall stubs meeting the neighbors.
    k.box(0.3, e === 0 ? 1.0 : h - 0.4, 0.44, c, x * 1.2, 0, 0);
  }
  // The lintel and the open doors.
  k.box(1.0, 0.3, 0.5, e === 0 ? '#6b4b2f' : c, 0, h - 0.3, 0);
  k.team(k.box(0.7, 0.2, 0.02, TEAM, 0, h - 0.25, 0.26));
  k.team(k.box(0.7, 0.2, 0.02, TEAM, 0, h - 0.25, -0.26));
  for (const x of [-0.42, 0.42]) {
    const door = k.box(0.04, h - 0.4, 0.44, '#5b4330', x, 0, 0.3);
    door.rotation.y = x > 0 ? 0.3 : -0.3;
  }
  if (e >= 2) banner(k, 0.72, h + 0.06, 0, 0.6, 0.8);
}

// ---- Dock ------------------------------------------------------------------------------------------

/** A dock on the shore: a building on land and a pier out over the water (+z; turned to face the water). */
function dock(k: Kit, e: number, st: Style): void {
  pad(k, 3, st.base);
  const deck = e >= 3 ? '#6e5a44' : WOOD;
  // The pier, on posts, reaching a little way out over the water (ships moor alongside).
  k.box(1.1, 0.08, 1.5, deck, 0.4, 0.12, 1.3);
  for (const x of [-0.1, 0.9]) for (let i = 0; i < 3; i++) k.cyl(0.05, 0.05, 0.6, 5, e >= 3 ? '#3a3a3e' : st.post, x, -0.45, 0.7 + i * 0.6);
  for (let i = 0; i < 3; i++) k.cyl(0.05, 0.06, 0.14, 6, e >= 4 ? '#2b2b2e' : st.post, 0.95, 0.2, 0.75 + i * 0.5);
  if (e === 0) {
    // Reed huts, nets drying on a frame, a canoe on the bank.
    hut(k, st, -0.6, -0.5, 0.55, 0.5);
    for (const x of [-1.2, -0.4]) k.cyl(0.025, 0.025, 0.55, 4, st.post, x, 0, 0.6);
    k.box(0.85, 0.3, 0.02, '#d8d0b8', -0.8, 0.22, 0.6);
    k.box(0.2, 0.06, 0.8, '#6e4f33', 0.9, 0.0, -0.8);
  } else {
    // A boathouse or warehouse by the water.
    const wall = e === 1 ? st.wall : e === 2 ? st.wall : st.wall;
    k.box(1.6, e >= 3 ? 1.1 : 0.85, 1.4, wall, -0.55, 0, -0.55);
    if (e === 2) for (const x of [-1.3, -0.8, -0.3, 0.2]) k.box(0.05, 0.85, 1.42, st.trim, x, 0, -0.55);
    k.box(1.66, 0.06, 1.46, st.trim, -0.55, e >= 3 ? 1.1 : 0.85, -0.55);
    if (e === 1) k.box(1.6, 0.08, 1.4, st.roof, -0.55, 0.91, -0.55);
    else k.prism(1.7, 0.55, 1.5, st.roof, -0.55, e >= 3 ? 1.16 : 0.91, -0.55);
    k.box(0.5, 0.6, 0.04, '#3a2b20', -0.55, 0, 0.16);
    window(k, st, -1.05, 0.45, 0.16);
    k.team(k.box(1.62, 0.08, 0.04, TEAM, -0.55, e >= 3 ? 0.98 : 0.72, 0.17));
    // A crane over the pier for later epochs.
    if (e >= 2) {
      const iron = e >= 4;
      k.cyl(0.05, 0.06, 1.4, 6, iron ? '#3a3e44' : WOOD, 0.9, 0.12, 0.6);
      const jib = k.box(0.05, 0.05, 1.0, iron ? '#3a3e44' : WOOD, 0.9, 1.35, 1.0);
      jib.rotation.x = 0.25;
      k.cyl(0.006, 0.006, 0.6, 3, '#d8d0b8', 0.9, 0.85, 1.42);
      k.box(0.18, 0.14, 0.18, '#8a6440', 0.9, 0.7, 1.42);
    }
  }
  // Barrels and a coil of rope; a team flag at the pier's end.
  for (const [x, z] of [[0.15, 0.2], [0.35, 0.3]]) k.cyl(0.1, 0.09, 0.22, 8, '#8a6440', x, 0.0, z);
  k.cyl(0.02, 0.02, 0.8, 4, '#5b4330', 0.0, 0.2, 1.95);
  k.team(k.box(0.012, 0.18, 0.28, TEAM, 0, 0.78, 2.09));
}

// ---- Airfield --------------------------------------------------------------------------------------

function airfield(k: Kit, _e: number, st: Style): void {
  // A grass strip with a painted runway, a hangar with a curved roof, a control tower and a windsock.
  k.box(3.9, 0.05, 3.9, '#7f9a5a', 0, -0.02, 0);
  k.box(3.7, 0.03, 0.9, '#8d8a80', 0, 0.02, 1.2);
  for (let i = 0; i < 6; i++) k.box(0.3, 0.012, 0.06, '#f2ece0', -1.5 + i * 0.6, 0.05, 1.2);
  // The hangar: a half-barrel roof over brick ends, doors open.
  const roof = k.cyl(0.85, 0.85, 1.8, 14, '#6a7078', -0.6, 0, -0.75);
  roof.rotation.z = Math.PI / 2;
  roof.position.set(-0.6, 0.1, -0.75);
  roof.scale.set(1, 1, 0.9);
  k.box(1.8, 0.12, 1.6, st.base, -0.6, -0.02, -0.75);
  k.box(0.05, 0.75, 1.5, st.wall, -1.5, 0, -0.75);
  k.box(0.05, 0.75, 1.5, st.wall, 0.3, 0, -0.75);
  k.box(1.0, 0.6, 0.02, '#1d1e24', -0.6, 0, 0.08);
  k.team(k.box(1.84, 0.12, 0.04, TEAM, -0.6, 0.78, 0.0));
  // Control tower.
  k.box(0.5, 1.3, 0.5, st.wall, 1.25, 0, -1.2);
  k.box(0.62, 0.3, 0.62, '#9ec2d8', 1.25, 1.3, -1.2);
  k.box(0.68, 0.06, 0.68, st.trim, 1.25, 1.6, -1.2);
  k.glow(k.sphere(0.05, '#ff5a4a', 1.25, 1.75, -1.2));
  // Windsock in team colors, fuel drums.
  k.cyl(0.02, 0.02, 1.1, 4, '#d8d8d8', 1.7, 0, 0.3);
  const sock = k.cloth(k.team(k.cone(0.08, 0.4, 8, TEAM, 1.7, 0.95, 0.5)), -0.4, 0.72);
  sock.rotation.x = -Math.PI / 2 - 0.2;
  sock.position.set(1.7, 1.0, 0.52);
  for (const [x, z] of [[1.0, -0.2], [1.2, -0.25], [1.1, -0.05]]) k.cyl(0.1, 0.1, 0.26, 8, '#5a6450', x, 0, z);
}

// ---- Industrial touches ----------------------------------------------------------------------------

/** A factory chimney (and its soot band) on a corner, for workshops of the Industrial Age. */
function smokestack(k: Kit, x: number, z: number, h: number): void {
  k.cyl(0.13, 0.18, h, 10, '#7a3a2c', x, 0, z);
  k.box(0.32, 0.08, 0.32, '#2b2b2e', x, h - 0.08, z);
}

const STACKS: Partial<Record<BuildingType, [number, number, number]>> = {
  forge: [1.1, -1.1, 2.6],
  workshop: [1.2, -1.15, 2.4],
  storehouse: [0.7, -0.7, 1.7],
  barracks: [-1.15, -1.15, 2.2],
  market: [1.2, -1.2, 2.2],
  towncenter: [1.6, -1.6, 2.8],
};

/** The Eiffel-like wonder of the Industrial Age: a lattice tower of iron on four legs. */
function ironTower(k: Kit, st: Style): void {
  pad(k, 5, st.base);
  const iron = '#6b5a48';
  // Four legs leaning in, braced by arches and platforms.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = k.box(0.28, 2.4, 0.28, iron, sx * 1.4, 0, sz * 1.4);
    leg.rotation.z = sx * 0.35;
    leg.rotation.x = -sz * 0.35;
    leg.position.set(sx * 1.0, 1.15, sz * 1.0);
    for (let i = 0; i < 4; i++) {
      const brace = k.box(0.04, 0.6, 0.04, '#5a4a3a', sx * (1.35 - i * 0.18), 0.1 + i * 0.5, sz * (1.35 - i * 0.18));
      brace.rotation.z = sx * 0.9;
    }
  }
  k.box(2.1, 0.14, 2.1, iron, 0, 2.2, 0);
  k.team(k.box(2.14, 0.06, 2.14, TEAM, 0, 2.34, 0));
  // The tapering middle and top.
  k.cyl(0.45, 0.85, 2.0, 4, iron, 0, 2.34, 0).rotation.y = Math.PI / 4;
  k.box(0.9, 0.1, 0.9, iron, 0, 4.34, 0);
  k.cyl(0.12, 0.38, 1.6, 4, iron, 0, 4.44, 0).rotation.y = Math.PI / 4;
  k.cyl(0.03, 0.05, 0.6, 6, iron, 0, 6.04, 0);
  k.glow(k.sphere(0.09, '#ffd36b', 0, 6.66, 0));
  k.team(k.box(0.012, 0.22, 0.34, TEAM, 0, 6.25, 0.18));
  // Arches between the legs.
  for (let i = 0; i < 4; i++) {
    const a = k.cyl(0.85, 0.85, 0.12, 12, '#7a6a58', 0, 0.9, 0);
    a.rotation.x = Math.PI / 2;
    a.rotation.z = (i * Math.PI) / 2;
    a.scale.set(1, 1, 0.3);
    a.position.set(i === 0 ? 0 : i === 2 ? 0 : (i === 1 ? 1.25 : -1.25), 0.9, i === 0 ? 1.25 : i === 2 ? -1.25 : 0);
    a.rotation.y = i % 2 ? Math.PI / 2 : 0;
  }
  for (const [x, z] of [[-2.1, 2.1], [2.1, 2.1]]) banner(k, x, 0, z, 1.6, 1.2);
}


// ---- Side ages (#55) -------------------------------------------------------------------------------
// Touches baked into a building's own vertices, so a side age reads at a glance and still costs no
// extra draw: awnings and bright cloth (merchants), rust and smithy glow (iron), banners, lamps and
// pale stone (pilgrims), stripes and bunting (fairs). Fronts face +z.

/** The original four dressed ages, kept as the baseline model regression set. */
export const LOOK_AGES: AgeId[] = ['merchant', 'iron', 'pilgrim', 'fair'];
/** All dressed ages; additions get their own model coverage beside the baseline set. */
export const DRESSED_AGES: AgeId[] = [...LOOK_AGES, 'reclaimer', 'sail', 'aeronaut'];

const SAIL = '#efe8d4';
const NET = '#b9ad8a';

/** A mast with a square sail and a pennant: the sea people's mark. */
function mast(k: Kit, x: number, z: number, h: number, w = 0.7): void {
  k.cyl(0.03, 0.04, h, 5, '#5a4630', x, 0, z);
  k.sail(k.box(w, h * 0.45, 0.025, SAIL, x, h * 0.45, z + 0.03), w / 2, h * 0.225, h * 0.45);
  k.box(w + 0.1, 0.03, 0.04, '#5a4630', x, h * 0.92, z + 0.03);
  k.box(0.22, 0.09, 0.02, '#3f8fc4', x + 0.12, h + 0.04, z);
}

/** Nets hung to dry on two posts, with cork floats along the top. */
function hungNets(k: Kit, x: number, y: number, z: number, w: number): void {
  for (const dx of [-w / 2, w / 2]) k.cyl(0.02, 0.02, 0.6, 4, '#5a4630', x + dx, y, z);
  k.box(w, 0.4, 0.015, NET, x, y + 0.14, z);
  for (let i = 0; i < 5; i++) k.sphere(0.03, '#c9a25a', x - w / 2 + (w * (i + 0.5)) / 5, y + 0.56, z);
}

const CLOTH = ['#d94a3c', '#e8b43a', '#3f8fc4', '#8a4fa8'];
const RUST = '#8a4a2c';
const PALE = '#e9e4d6';

/** A slanted awning over a front: alternate bright strips. */
function awning(k: Kit, x: number, y: number, z: number, w: number, strips: number, a = 0): void {
  const sw = w / strips;
  for (let i = 0; i < strips; i++) {
    const m = k.box(sw, 0.03, 0.5, CLOTH[(i + a) % CLOTH.length], x - w / 2 + sw * (i + 0.5), y, z);
    m.rotation.x = 0.3;
  }
  k.box(w, 0.1, 0.03, CLOTH[a % CLOTH.length], x, y - 0.1, z + 0.28);
}

/** Bunting: a sagging line of small flags between two points along x. */
function bunting(k: Kit, x0: number, x1: number, y: number, z: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const sag = 0.1 * Math.sin(t * Math.PI);
    const m = k.box(0.1, 0.14, 0.02, CLOTH[i % CLOTH.length], x0 + (x1 - x0) * t, y - sag - 0.07, z);
    m.rotation.z = i % 2 ? 0.2 : -0.2;
  }
  k.box(x1 - x0, 0.015, 0.015, '#4a3426', (x0 + x1) / 2, y - 0.02, z);
}

/** A striped stall: a red and white canopy on four poles, a counter beneath. */
function stripedStall(k: Kit, x: number, z: number): void {
  for (const dx of [-0.28, 0.28]) for (const dz of [-0.2, 0.2]) k.cyl(0.02, 0.02, 0.62, 4, WOOD, x + dx, 0, z + dz);
  for (let i = 0; i < 6; i++) k.box(0.1, 0.03, 0.5, i % 2 ? '#f4efe4' : '#cf3d34', x - 0.25 + i * 0.1, 0.64, z).rotation.x = 0.12;
  k.box(0.5, 0.22, 0.2, '#8a6440', x, 0, z);
  k.sphere(0.05, '#e2b23c', x, 0.26, z);
}

/** A lamp on a post, glowing. */
function lamp(k: Kit, x: number, y: number, z: number, h = 0.5): void {
  k.cyl(0.015, 0.02, h, 4, '#4a3426', x, y, z);
  k.glow(k.octa(0.05, LIGHT, x, y + h + 0.04, z));
}

function ageTouches(k: Kit, type: BuildingType, age: AgeId): void {
  const big = type === 'towncenter';
  switch (age) {
    case 'aeronaut': {
      // Sky blue navigation bands and a rooftop windsock mark the aviation towns.
      if (['airfield', 'towncenter', 'house', 'forge', 'wonder'].includes(type)) {
        const span = type === 'airfield' || type === 'wonder' ? 1.8 : big ? 1.4 : 0.7;
        k.box(span * 2, 0.12, 0.04, '#76c6d6', 0, 0.55, span);
        const h = type === 'wonder' ? 3.3 : big ? 2.5 : 1.6;
        k.cyl(0.025, 0.025, h, 5, '#d7e4e8', span, 0, 0);
        k.box(0.48, 0.12, 0.1, '#76c6d6', span + 0.24, h, 0);
        k.box(0.12, 0.12, 0.11, '#f4efe4', span + 0.18, h, 0);
      }
      break;
    }
    case 'reclaimer': {
      // Salvaged stone columns and timber braces: old fragments become a working town.
      if (['towncenter', 'storehouse', 'forge', 'house', 'wonder'].includes(type)) {
        const span = big ? 1.65 : type === 'wonder' ? 2.5 : type === 'house' ? 0.7 : 1.05;
        const height = big || type === 'wonder' ? 1.3 : 0.7;
        for (const x of [-span, span]) {
          k.cyl(0.09, 0.12, height, 6, PALE, x, 0, span);
          k.box(0.28, 0.1, 0.28, PALE, x, height, span);
          k.cyl(0.025, 0.025, height + 0.25, 4, WOOD, x + 0.18, 0, span);
        }
        k.box(span * 2 + 0.4, 0.07, 0.08, WOOD, 0, height * 0.65, span + 0.05);
        k.box(0.36, 0.18, 0.22, PALE, span - 0.25, 0, span - 0.35);
      }
      break;
    }
    case 'merchant':
      if (type === 'market') {
        awning(k, -0.9, 0.78, 1.25, 1.2, 4, 0);
        awning(k, 0.9, 0.78, 1.25, 1.2, 4, 2);
        k.box(0.5, 0.3, 0.04, '#e2b23c', 0, 1.55, 0.2);
      } else if (type === 'house') awning(k, 0, 0.62, 0.85, 0.7, 3, 1);
      else if (big) {
        awning(k, -0.8, 1.0, 2.1, 1.4, 4, 0);
        awning(k, 0.8, 1.0, 2.1, 1.4, 4, 2);
      } else if (type === 'storehouse') awning(k, 0, 0.7, 1.0, 1.0, 4, 3);
      else if (type === 'wonder') {
        awning(k, -1.4, 1.1, 2.7, 1.6, 4, 0);
        awning(k, 1.4, 1.1, 2.7, 1.6, 4, 2);
      }
      break;
    case 'iron':
      if (type === 'forge') {
        k.box(0.62, 0.52, 0.03, '#2b2b2e', 0, 0.16, 1.5);
        k.glow(k.box(0.5, 0.4, 0.05, '#ff7a2a', 0, 0.2, 1.52));
        k.box(2.6, 0.18, 0.04, RUST, 0, 0.1, 1.5);
        k.glow(k.octa(0.08, '#ff9a3c', 1.1, 2.7, -1.1));
      } else if (type === 'house') {
        k.box(1.45, 0.14, 1.2, RUST, -0.1, 0, -0.1);
        k.glow(k.box(0.12, 0.1, 0.03, '#ff7a2a', 0.35, 0.3, 0.52));
      } else if (big) {
        k.box(3.0, 0.2, 3.0, RUST, 0, 0, 0);
        torch(k, -1.4, 0, 2.05);
        torch(k, 1.4, 0, 2.05);
      } else if (type === 'barracks' || type === 'storehouse') k.box(1.9, 0.14, 1.9, RUST, 0, 0, 0);
      else if (type === 'wonder') {
        k.box(5.2, 0.2, 5.2, RUST, 0, 0, 0);
        torch(k, -2.3, 0, 2.7);
        torch(k, 2.3, 0, 2.7);
      }
      break;
    case 'pilgrim':
      if (type === 'temple') {
        banner(k, -0.6, 0, 1.6, 1.9, 1.3);
        banner(k, 0.6, 0, 1.6, 1.9, 1.3);
        lamp(k, -1.3, 0, 1.45);
        lamp(k, 1.3, 0, 1.45);
        k.box(2.6, 0.18, 2.4, PALE, 0, -0.01, -0.1);
      } else if (type === 'house') {
        k.box(1.5, 0.22, 1.25, PALE, -0.1, 0, -0.1);
        lamp(k, 0.8, 0, 0.8, 0.4);
      } else if (big) {
        k.box(3.2, 0.22, 3.2, PALE, 0, 0, 0);
        banner(k, -1.6, 0, 1.9, 2.0, 1.3);
        banner(k, 1.6, 0, 1.9, 2.0, 1.3);
        lamp(k, 0, 0, 2.1, 0.55);
      } else if (type === 'market') {
        lamp(k, -1.3, 0, 1.3);
        lamp(k, 1.3, 0, 1.3);
      } else if (type === 'wonder') {
        k.box(5.2, 0.22, 5.2, PALE, 0, 0, 0);
        banner(k, -2.0, 0, 2.8, 2.2, 1.4);
        banner(k, 2.0, 0, 2.8, 2.2, 1.4);
        lamp(k, 0, 0, 2.9, 0.6);
      }
      break;
    case 'sail':
      if (type === 'dock') {
        mast(k, 0.4, 1.7, 1.7, 0.75);
        hungNets(k, -1.25, 0, 0.1, 0.9);
      } else if (type === 'house') hungNets(k, 0, 0, 0.95, 0.8);
      else if (big) {
        mast(k, -1.7, 1.9, 2.4);
        mast(k, 1.7, 1.9, 2.4);
        hungNets(k, 0, 0, 2.1, 1.2);
      } else if (type === 'market') {
        hungNets(k, -1.3, 0, 1.3, 0.9);
        k.cyl(0.16, 0.16, 0.3, 8, '#7a5634', 1.2, 0, 1.2);
        k.cyl(0.16, 0.16, 0.3, 8, '#7a5634', 1.55, 0, 1.0);
      } else if (type === 'wonder') {
        mast(k, -2.2, 2.7, 3.0, 0.9);
        mast(k, 2.2, 2.7, 3.0, 0.9);
      }
      break;
    case 'fair':
      if (type === 'market') {
        stripedStall(k, -1.3, 0.45);
        stripedStall(k, 1.3, 0.45);
        stripedStall(k, 0, 1.45);
        bunting(k, -1.35, 1.35, 1.55, 1.3, 9);
        bunting(k, -1.35, 1.35, 1.1, -0.1, 9);
      } else if (type === 'house') bunting(k, -0.7, 0.7, 0.75, 0.8, 5);
      else if (big) {
        bunting(k, -1.7, 1.7, 1.6, 2.05, 11);
        stripedStall(k, -1.7, 1.5);
        stripedStall(k, 1.7, 1.5);
      } else if (type === 'temple') bunting(k, -1.2, 1.2, 1.1, 1.3, 7);
      else if (type === 'wonder') {
        bunting(k, -2.2, 2.2, 1.8, 2.8, 13);
        stripedStall(k, -2.1, 2.5);
        stripedStall(k, 2.1, 2.5);
      }
      break;
  }
}

const MAKERS: Record<Exclude<BuildingType, 'wall'>, (k: Kit, e: number, st: Style) => void> = {
  towncenter, house, storehouse, farm, barracks, range, stable, tower, forge, workshop, temple, market, wonder, gate, dock, airfield,
};

const cache = new Map<string, THREE.BufferGeometry>();

/** The baked model of a building in an epoch, in a player's color (`variant`: which way a wall piece joins its neighbors). */
export function buildingGeometry(type: BuildingType, epoch: number, color: string, variant = 0, age?: AgeId): THREE.BufferGeometry {
  const look = age && DRESSED_AGES.includes(age) && type !== 'wall' ? age : undefined;
  const key = `${type}:${epoch}:${color}:${variant}${look ? ':' + look : ''}`;
  let g = cache.get(key);
  if (!g) {
    const k = new Kit();
    if (type === 'wall') wall(k, epoch, STYLES[epoch], variant);
    else MAKERS[type](k, epoch, STYLES[epoch]);
    const stack = STACKS[type];
    if (epoch >= 4 && stack) smokestack(k, stack[0], stack[1], stack[2]);
    if (look) ageTouches(k, type, look);
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

