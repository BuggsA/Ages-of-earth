import { barrow, faultengine, heartstone, henge, sunken, ventforge } from './deepModels';
import * as THREE from 'three';
import { AGE_PALETTES, NEW_LOOK_AGES, ageLookTouches } from './ageLooks';
import type { AgeId, BuildingType } from '../sim/types';
import { BUILDINGS } from '../sim/data';
import { Kit, bake, rnd } from './kit';
import { causewaySite, cocklerHut, tidemill } from './tideModels';
import { tideGate } from './tideModels';
import { pontoon } from './floatModels';

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
  { wall: '#a8865e', wall2: '#8f6f4a', roof: '#d6b868', roof2: '#c9a857', trim: '#6e4f33', base: '#8d7a62', post: '#6b4b2f', window: '#3a2b20' },
  { wall: '#dbb07e', wall2: '#c99a66', roof: '#6a3220', roof2: '#55291a', trim: '#f0e4c8', base: '#b9a58a', post: '#8a6a44', window: '#3a2b20' },
  { wall: '#ece4d2', wall2: '#a9a397', roof: '#444e5b', roof2: '#38414c', trim: '#4a3426', base: '#9a948a', post: '#4a3426', window: '#2c3440' },
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
    hut(k, st, -0.3, -0.15, 0.5, 0.45);
    hut(k, st, 0.5, -0.05, 0.28, 0.3);
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
  if (e === 4) {
    // A brick terrace of the machine age: two storeys, a flat parapet roof and a row of chimney pots.
    k.box(1.5, 0.3, 1.2, st.base, 0, 0, -0.05);
    k.box(1.5, 1.15, 1.2, st.wall, 0, 0.3, -0.05);
    k.box(1.56, 0.06, 1.26, st.trim, 0, 0.9, -0.05);
    k.box(1.56, 0.12, 1.26, st.trim, 0, 1.45, -0.05);
    k.box(1.56, 0.1, 0.06, IRON_DARK, 0, 1.57, 0.55);
    for (const x of [-0.5, -0.15, 0.2, 0.55]) k.cyl(0.07, 0.08, 0.3, 6, '#5c3024', x, 1.57, -0.35);
    for (const x of [-0.45, 0.05, 0.5]) for (const y of [0.5, 1.05]) window(k, st, x, y, 0.56, 0.16, 0.24, y > 1);
    k.box(0.26, 0.48, 0.03, '#2b2b2e', -0.02, 0.3, 0.56);
    k.box(0.4, 0.05, 0.22, IRON_DARK, -0.02, 0.8, 0.64);
    k.team(k.box(0.34, 0.06, 0.12, TEAM, -0.02, 0.62, 0.7));
    return;
  }
  // A timber-framed town house: a jettied upper storey, a steep roof and a tall chimney, so it stands tall and narrow.
  k.box(1.3, 0.7, 1.05, st.wall, 0, 0, -0.05);
  k.box(1.44, 0.4, 1.2, st.wall2, 0, 0.7, -0.05);
  k.box(1.46, 0.06, 1.22, st.trim, 0, 0.7, -0.05);
  for (const x of [-0.6, -0.2, 0.2, 0.6]) k.box(0.04, 0.4, 1.22, st.trim, x, 0.7, -0.05);
  k.prism(1.5, 0.85, 1.3, st.roof, 0, 1.1, -0.05);
  k.box(0.2, 0.95, 0.2, STONE, -0.45, 1.05, -0.25);
  for (const x of [-0.4, 0.4]) for (const y of [0.22, 0.6]) window(k, st, x, y, 0.53, 0.16, 0.2);
  k.box(0.26, 0.45, 0.03, '#3a2b20', 0, 0, 0.53);
  k.team(k.box(0.32, 0.05, 0.12, TEAM, 0, 0.47, 0.6));
}

/**
 * The Iron Age's house (#816): a roundhouse of the kind raised across Iron Age Europe. A low drum of daub on wattle under a
 * tall, steep cone of thatch that comes down almost to the ground, so a town of them reads as a field of haystacks, not boxes.
 * Spears with iron heads lean by the door and a lump of bog iron, the age's wealth, glows on the step.
 */
function ironHouse(k: Kit, st: Style): void {
  pad(k, 2, st.base);
  const z = -0.18;
  k.cyl(0.6, 0.63, 0.34, 12, st.wall, 0, 0, z);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * 2 * Math.PI;
    k.cyl(0.025, 0.03, 0.34, 4, '#5c4630', Math.sin(a) * 0.63, 0, z + Math.cos(a) * 0.63);
  }
  // The thatch, weathered grey-brown in the bog-iron light, in two tones with a bound ring part way up and a capped peak.
  k.cone(0.84, 1.0, 12, '#7d6a4c', 0, 0.32, z);
  k.cone(0.5, 0.6, 12, '#8d7a58', 0, 0.73, z);
  k.ring(0.44, 0.03, '#5a4a34', 0.8).position.z = z;
  k.cone(0.12, 0.18, 8, '#4f4130', 0, 1.24, z);
  k.box(0.24, 0.3, 0.03, '#2a1f17', 0, 0, z + 0.62);
  // Spears racked at the left of the door, iron heads up, and the bloom of bog iron on the right.
  for (const [x, lean] of [[-0.62, 0.1], [-0.74, 0.02], [-0.86, -0.06]] as const) {
    const s = k.group(x, 0, 0.5);
    s.rotation.x = -0.2;
    s.rotation.z = lean;
    k.cyl(0.014, 0.016, 0.82, 4, '#6b4b2f', 0, 0, 0, s);
    k.cone(0.035, 0.16, 4, '#55575c', 0, 0.82, 0, s);
  }
  k.rock(0.09, '#3d3330', 0.62, 0.04, 0.55);
  k.glow(k.octa(0.025, '#ff7a2a', 0.62, 0.12, 0.63));
}

/**
 * The Iron Age's Town Center (#816): a hillfort. A ring of banked earth with a stake palisade on its crest and one timber
 * gate, the thing that stands for the age across Iron Age Europe. Inside, the great roundhouse sits beside a smaller one and
 * the bloomery fire, so a town of this age reads from afar as a walled mound, not a hall.
 */
function ironHillfort(k: Kit, st: Style): void {
  pad(k, 4, st.base);
  const R = 1.78;
  const N = 18;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 2 * Math.PI;
    const x = Math.sin(a) * R;
    const z = Math.cos(a) * R - 0.1;
    // The gate faces +z (the front); leave the bank open there.
    if (Math.cos(a) > 0.93) continue;
    const bank = k.box(0.7, 0.34, 0.5, i % 2 ? '#6b5a3c' : '#756346', x, 0, z);
    bank.rotation.y = a;
    // Stakes along the crest, sharpened and leaning a little outward.
    for (const d of [-0.22, 0.0, 0.22]) {
      const sx = x + Math.cos(a) * d;
      const sz = z - Math.sin(a) * d;
      const h = 0.62 + ((i + Math.round(d * 10) + 9) % 3) * 0.08;
      k.cyl(0.04, 0.05, h, 4, '#7a5a38', sx, 0.3, sz);
      k.cone(0.05, 0.12, 4, '#8a6a44', sx, 0.3 + h, sz);
    }
    if (i % 2 === 0) k.box(0.52, 0.04, 0.05, '#5a4630', x, 0.62, z).rotation.y = a;
  }
  // The gate: two stout posts and a lintel across the gap, with a torch each side.
  const gz = R - 0.1;
  for (const x of [-0.42, 0.42]) {
    k.cyl(0.09, 0.1, 1.15, 6, '#6b4b2f', x, 0, gz);
    k.cone(0.1, 0.16, 6, '#8a6a44', x, 1.15, gz);
    k.cyl(0.05, 0.06, 0.4, 5, '#6b4b2f', x * 1.35, 0.25, gz + 0.05);
  }
  k.box(1.0, 0.1, 0.12, '#5c4630', 0, 0.92, gz);
  k.team(k.box(0.42, 0.18, 0.04, TEAM, 0, 0.62, gz + 0.02));
  torch(k, -0.62, 0, gz + 0.25);
  torch(k, 0.62, 0, gz + 0.25);
  // The trodden way from the gate to the hearth.
  k.box(0.7, 0.04, 1.0, st.trim, 0, 0.02, 1.15);
  // The great roundhouse, a daub drum under a steep thatch cone, and a smaller one beside it.
  const house = (x: number, z: number, r: number, h: number): void => {
    k.cyl(r, r * 1.05, h, 12, st.wall, x, 0, z);
    k.cone(r * 1.4, h * 2.4, 12, '#7d6a4c', x, h * 0.9, z);
    k.cone(r * 0.8, h * 1.3, 12, '#8d7a58', x, h * 1.9, z);
    k.cone(r * 0.2, h * 0.5, 8, '#4f4130', x, h * 3.05, z);
    k.box(r * 0.45, h * 0.8, 0.03, '#2a1f17', x, 0, z + r * 1.02);
  };
  house(-0.15, -0.55, 0.78, 0.5);
  house(-1.0, 0.55, 0.42, 0.3);
  // The bloomery: a clay stack with a glowing mouth and a heap of ore, the age's wealth, and the town's banner.
  k.cyl(0.17, 0.24, 0.55, 8, '#6a5848', 0.95, 0, 0.35);
  k.glow(k.box(0.14, 0.12, 0.03, '#ff7a2a', 0.95, 0.1, 0.58));
  k.glow(k.octa(0.05, '#ff9a3c', 0.95, 0.6, 0.35));
  k.rock(0.12, '#3d3330', 0.55, 0.0, 0.7);
  k.rock(0.09, '#4a3d38', 1.35, 0.0, 0.55);
  banner(k, 0.45, 0, -0.1, 1.5, 1.2);
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
  if (e === 1) {
    // Beehive granaries of baked clay behind the shed: round domes that no other Bronze building has.
    for (const x of [-0.45, 0.45]) {
      k.cyl(0.38, 0.4, 0.55, 9, st.wall, x, 0, -0.35);
      k.dome(0.4, st.roof2, x, 0.55, -0.35);
    }
    k.box(0.14, 0.2, 0.03, '#3a2b20', -0.45, 0, -0.02);
  }
  if (e === 3) {
    // A warehouse loft: a gabled upper room with a hatch, so the shed rises above the houses' roofs.
    k.box(1.1, 0.5, 0.9, st.wall, 0, 1.15, -0.1);
    k.prism(1.25, 0.45, 1.0, st.roof2, 0, 1.65, -0.1);
    k.box(0.3, 0.3, 0.03, '#3a2b20', 0, 1.2, 0.36);
  }
  if (e >= 3) {
    // Powder-age yard: a hoist beam with a hanging crate, and stacked cases.
    k.cyl(0.04, 0.05, 1.2, 5, e >= 4 ? '#3a3e44' : st.post, -0.95, 0, 0.75);
    k.box(0.9, 0.05, 0.05, e >= 4 ? '#3a3e44' : st.post, -0.5, 1.15, 0.75);
    k.cyl(0.005, 0.005, 0.35, 3, '#d8d0b8', -0.2, 0.8, 0.75);
    k.box(0.2, 0.16, 0.2, '#a07a48', -0.2, 0.64, 0.75);
    for (const [x, y] of [[0.8, 0], [0.8, 0.2], [1.05, 0]]) k.box(0.22, 0.2, 0.22, '#a07a48', x, y, 0.75);
  }
  if (e >= 4) lamp(k, 0.9, 0, -0.62, 0.8);
  banner(k, 0.85, 0, 0.85, 0.9);
}

// ---- Hunting Camp ----------------------------------------------------------------------------------

/**
 * The Beast Den (the Age of the Wild, `docs/wild-road.md`): a ring of turf banks and woven hurdles round a straw hollow, an old
 * oak in the middle hung with a wolf's skull, and gnawed bones by the gap. A rival reads it from afar: these people keep beasts.
 */
function den(k: Kit, e: number, st: Style): void {
  pad(k, 3, st.base);
  const turf = '#5f7a3a';
  const earth = '#6e5638';
  // The ring of banks, broken by a gap at the front.
  for (let i = 0; i < 10; i++) {
    if (i === 2) continue;
    const a = (i / 10) * Math.PI * 2;
    const x = Math.sin(a) * 1.15;
    const z = Math.cos(a) * 1.15;
    k.blob(0.32, i % 2 ? earth : turf, x, 0.05, z).scale.set(1.2, 0.55, 1.2);
    // Hurdles of woven withies along the top of each bank.
    const h = k.box(0.55, 0.32, 0.05, '#8a6a3e', x * 0.92, 0.28, z * 0.92);
    h.rotation.y = a;
    k.box(0.56, 0.03, 0.06, '#6b4e2a', x * 0.92, 0.36, z * 0.92).rotation.y = a;
  }
  // The straw hollow, and a whelp-hut of hides on bent poles.
  k.cyl(0.75, 0.8, 0.06, 10, '#c9a85a', 0, 0, 0);
  k.blob(0.38, e >= 2 ? st.roof : '#9a7a52', -0.35, 0.05, -0.35).scale.set(1, 0.75, 1);
  k.box(0.18, 0.22, 0.04, '#2a2018', -0.25, 0.02, -0.04);
  // The old oak in the middle, with a wolf's skull on its trunk.
  k.cyl(0.08, 0.13, 1.2, 6, '#5a4228', 0.35, 0, 0.2);
  k.cyl(0.04, 0.06, 0.5, 5, '#5a4228', 0.5, 0.95, 0.2).rotation.z = -0.7;
  k.cyl(0.04, 0.06, 0.5, 5, '#5a4228', 0.2, 1.0, 0.2).rotation.z = 0.7;
  k.blob(0.42, '#3f6b2e', 0.35, 1.35, 0.2).scale.set(1.2, 0.8, 1.2);
  k.blob(0.28, '#4d7d36', 0.7, 1.15, 0.0);
  k.box(0.12, 0.09, 0.16, '#e7dfcc', 0.35, 0.75, 0.33);
  // Gnawed bones by the gap, and a water trough.
  for (const [x, z, r] of [[0.85, 0.75, 0.4], [0.6, 0.95, -0.6], [0.95, 0.5, 1.1]]) k.box(0.04, 0.04, 0.3, '#e7dfcc', x, 0.04, z).rotation.y = r;
  k.box(0.5, 0.14, 0.2, WOOD, -0.5, 0.02, 0.5);
  k.box(0.44, 0.02, 0.15, '#4a7ab0', -0.5, 0.14, 0.5);
  k.team(k.box(0.7, 0.05, 0.06, TEAM, 0, 0.42, -1.05));
  banner(k, 1.2, 0, -0.9, 0.9);
}

// ---- The Age of the Grove (`docs/wild-road.md` §2) ---------------------------------------------------

const THORN = ['#6f8f3e', '#4f7432', '#3d6129', '#2f5422'];
const BARK = '#5a4228';

/**
 * A Thornwall piece at its stage (`variant >> 4`: 0 seedling, 1 bramble, 2 thicket, 3 living oak), reaching toward the pieces it
 * joins (`variant & 15`, as a wall's mask). It reads by height and darkness: whips in a furrow, a low tangle, a thicket, an oak.
 */
function thornwall(k: Kit, variant: number): void {
  const stage = Math.min(3, variant >> 4);
  const mask = variant & 15;
  const leaf = THORN[stage];
  // A strip of turned earth under the hedge, reaching to the pieces it joins.
  k.box(0.42, 0.04, 0.42, '#5b4630', 0, -0.01, 0);
  for (const [bit, dx, dz] of ARMS) if (mask & bit) k.box(Math.abs(dx) * 0.3 + 0.42 * Math.abs(dz), 0.04, Math.abs(dz) * 0.3 + 0.42 * Math.abs(dx), '#5b4630', dx * 0.35, -0.01, dz * 0.35);
  const tuft = (x: number, z: number, h: number) => {
    const j = rnd(x * 9, z * 9, stage) * 0.15;
    if (stage === 0) {
      // Whips of thorn in a turned furrow.
      k.cyl(0.012, 0.018, h, 3, '#6b5232', x, 0, z);
      k.cone(0.07, 0.16, 4, leaf, x, h - 0.06, z);
    } else if (stage === 1) {
      // A low, knee-high tangle of bramble: arching canes, and a few dark berries.
      k.blob(0.14 + j * 0.5, leaf, x, 0.08, z).scale.set(1.3, 0.6, 1.3);
      for (const a of [0.6, 2.4, 4.3]) k.cyl(0.01, 0.014, 0.34, 3, '#6b3e3a', x + Math.cos(a) * 0.08, 0, z + Math.sin(a) * 0.08).rotation.z = Math.cos(a) * 0.6;
      for (const [bx, bz] of [[0.1, 0.06], [-0.08, 0.1], [0.02, -0.11]]) k.sphere(0.028, '#3a1e3a', x + bx, 0.17, z + bz);
    } else {
      // A thicket: interwoven stems under a dense head; an oak's are thicker and darker.
      const r = stage === 3 ? 0.06 : 0.035;
      k.cyl(r * 0.8, r, h * 0.6, 5, BARK, x, 0, z);
      k.blob((stage === 3 ? 0.3 : 0.24) + j, leaf, x, h * 0.62, z).scale.set(1.1, 0.9, 1.1);
    }
  };
  const h = [0.35, 0.4, 0.95, 1.3][stage];
  if (stage === 3) {
    // The living oak: a gnarled trunk on spread roots, its crown high above the hedge.
    k.cyl(0.11, 0.17, 1.15, 7, BARK, 0, 0, 0);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      k.cyl(0.03, 0.06, 0.32, 4, BARK, Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16).rotation.z = Math.cos(a) * 0.9;
    }
    k.blob(0.44, leaf, 0, 1.35, 0).scale.set(1.15, 0.85, 1.15);
    k.blob(0.28, '#3b6a2a', 0.18, 1.2, 0.15);
  } else tuft(0, 0, h);
  for (const [bit, dx, dz] of ARMS) {
    if (!(mask & bit)) continue;
    tuft(dx * 0.3, dz * 0.3, h * 0.9);
    // Stems woven across the gap, so a grown line reads as one hedge.
    if (stage >= 2) k.box(Math.abs(dx) * 0.5 + 0.05, 0.05, Math.abs(dz) * 0.5 + 0.05, BARK, dx * 0.25, h * 0.35, dz * 0.25);
  }
  if (!mask) for (const [dx, dz] of [[0.25, 0.1], [-0.22, -0.12]]) tuft(dx, dz, h * 0.8);
  // A strip of the people's cloth tied into the hedge.
  k.team(k.box(0.12, 0.08, 0.12, TEAM, 0, Math.min(0.5, h * 0.5), 0.2));
}

/**
 * A Kitchen Garden: the Three Sisters on one raised bed, maize standing over climbing beans with squash on the ground. What feeds
 * it shows (`variant`: 1 a dung heap at its corner, 2 a clay water jar and a channel), so a rival can tell which gardens the Den feeds.
 */
function garden(k: Kit, e: number, variant: number): void {
  const fed = variant;
  k.box(0.92, 0.05, 0.92, fed ? '#4a3524' : '#6b5238', 0, -0.01, 0);
  k.box(0.78, 0.07, 0.78, fed ? '#3d2c1e' : '#5e4630', 0, 0.02, 0);
  for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) {
    // A hill of maize, a bean vine wound up the stalk, a squash at its foot.
    k.cyl(0.015, 0.02, 0.62, 3, '#9aa846', x, 0.05, z);
    k.cone(0.06, 0.18, 4, '#7c9a3a', x, 0.55, z);
    k.box(0.04, 0.09, 0.03, '#e2c35a', x + 0.03, 0.42, z);
    k.sphere(0.035, '#4f8a36', x - 0.03, 0.28, z + 0.02);
    k.sphere(0.04, '#4f8a36', x + 0.02, 0.18, z - 0.03);
    k.sphere(0.075, e >= 3 ? '#d98a2b' : '#c7782a', x + 0.09, 0.09, z + 0.08).scale.set(1.2, 0.8, 1);
  }
  k.blob(0.07, '#5f8f3c', 0, 0.1, 0).scale.set(1.6, 0.6, 1.6);
  if (fed & 1) k.blob(0.12, '#4a3a22', 0.36, 0.06, 0.36).scale.set(1.2, 0.6, 1.2);
  if (fed & 2) {
    k.cyl(0.07, 0.09, 0.2, 7, '#b0643a', -0.36, 0.04, 0.36);
    k.box(0.04, 0.02, 0.7, '#4a7ab0', -0.42, 0.06, -0.02);
  }
  // Pollinated by a Hive in summer (`fed & 4`, the Age of the Hive): squash flowers open gold and the bean vines bloom white.
  if (fed & 4) for (const [x, z] of [[-0.12, 0.3], [0.3, -0.05], [-0.3, -0.08], [0.08, -0.3], [0.05, 0.05]]) {
    k.cone(0.045, 0.05, 5, '#f2c43a', x, 0.12, z).rotation.x = Math.PI;
    k.sphere(0.02, '#fff6dc', x + 0.05, 0.34, z - 0.04);
  }
  k.cyl(0.012, 0.012, 0.36, 3, WOOD, -0.4, 0, -0.4);
  k.team(k.box(0.08, 0.06, 0.02, TEAM, -0.4, 0.3, -0.4));
}

// ---- The Age of the Hive (`docs/wild-road.md` §3) ------------------------------------------------------

/**
 * A Hive: a coiled straw skep, banded where its coils were bound, on a plank stand under a little bark roof, its people's cloth
 * hung from the stand. Awake (`variant` 0) a few bees hang at the door; quiet (1: winter or smoke) the door is stopped with clay.
 */
function hive(k: Kit, e: number, variant: number): void {
  k.box(0.7, 0.04, 0.7, '#5f7a3a', 0, -0.02, 0);
  for (const [x, z] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) k.cyl(0.025, 0.03, 0.3, 4, BARK, x, 0, z);
  k.box(0.58, 0.04, 0.52, e >= 3 ? '#8a6a42' : WOOD, 0, 0.3, 0);
  const straw = '#d9b45a';
  k.lathe([[0, 0], [0.22, 0], [0.24, 0.08], [0.23, 0.18], [0.19, 0.28], [0.12, 0.36], [0.04, 0.4], [0, 0.41]], 10, straw, 0, 0.32, 0);
  for (const [y, r] of [[0.09, 0.245], [0.19, 0.23], [0.28, 0.195]] as [number, number][]) k.cyl(r, r, 0.022, 10, '#a8843a', 0, 0.32 + y, 0);
  // The door at the foot of the skep, facing out; open and busy when awake, stopped with clay when quiet.
  k.box(0.08, 0.05, 0.03, variant ? '#8a6a4a' : '#1e1810', 0, 0.35, 0.225);
  if (!variant) for (const [x, y, z] of [[0.08, 0.5, 0.32], [-0.1, 0.62, 0.28], [0.02, 0.74, 0.18], [0.16, 0.42, 0.26]]) k.sphere(0.018, '#2a2010', x, y, z);
  // A little roof of bark against the rain.
  for (const s of [-1, 1]) k.box(0.36, 0.025, 0.6, '#5a4228', s * 0.15, 0.8, 0).rotation.z = s * -0.55;
  k.team(k.box(0.5, 0.12, 0.015, TEAM, 0, 0.22, 0.265));
}

// ---- The Age of the Wildwood (`docs/wild-road.md` §4) --------------------------------------------------

/**
 * A Heart Tree: a vast old tree on a mound of moss, its roots flung out as buttresses over the whole plot, a hollow at its foot
 * lit amber from within, and a crown of leaves wider than a house, heaped in three tiers. Ribbons of its people's cloth hang from
 * the lowest bough. It stands taller than a Wonder: the town's soul, seen from anywhere.
 */
function heart(k: Kit): void {
  const bark = '#4a3826';
  const furrow = '#2f2419';
  const moss = '#56763a';
  const leaf = ['#2f5a26', '#3d6c2c', '#4c7d34', '#36612a'];
  k.lathe([[0, 0.06], [1.45, 0], [1.4, 0.05], [1.05, 0.14], [0.6, 0.2], [0, 0.22]], 10, moss, 0, -0.03, 0);
  // Buttress roots running out to the plot's edge.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const r = k.box(0.16, 0.22, 1.0, i % 2 ? bark : furrow, Math.cos(a) * 0.7, 0.08, Math.sin(a) * 0.7);
    r.rotation.y = -a + Math.PI / 2;
    r.rotation.x = 0.18;
  }
  // The trunk: flared at the foot, a slight twist of furrows up it.
  k.lathe([[0, 0], [0.62, 0], [0.5, 0.35], [0.42, 1.0], [0.38, 1.8], [0.33, 2.6], [0, 2.7]], 9, bark, 0, 0.1, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.box(0.06, 2.2, 0.08, furrow, Math.cos(a) * 0.43, 1.25, Math.sin(a) * 0.43).rotation.y = -a;
  }
  // The hollow at its foot, glowing.
  k.box(0.32, 0.5, 0.1, '#1a120b', 0, 0.45, 0.5);
  k.glow(k.box(0.2, 0.34, 0.06, '#ffb43e', 0, 0.42, 0.53));
  // Great boughs out from the trunk into the crown.
  for (const [a, y, len] of [[0.4, 2.0, 1.1], [2.3, 2.2, 1.0], [4.2, 1.9, 1.2], [5.5, 2.5, 0.8]] as [number, number, number][]) {
    const b = k.cyl(0.07, 0.13, len, 5, bark, Math.cos(a) * len * 0.45, y + 0.25, Math.sin(a) * len * 0.45);
    b.rotation.z = Math.cos(a) * -1.0;
    b.rotation.x = Math.sin(a) * 1.0;
  }
  // The crown in three tiers.
  for (const [x, y, z, r, c] of [
    [0, 2.9, 0, 1.15, 0], [-0.85, 2.55, 0.3, 0.75, 1], [0.8, 2.6, -0.35, 0.8, 2], [0.2, 2.5, 0.9, 0.7, 3], [-0.3, 2.6, -0.9, 0.7, 1],
    [0.4, 3.55, 0.2, 0.8, 2], [-0.45, 3.5, -0.25, 0.7, 3], [0, 4.15, 0, 0.6, 0],
  ] as [number, number, number, number, number][]) k.blob(r, leaf[c], x, y, z).scale.set(1, 0.72, 1);
  // Its people's ribbons from the lowest bough.
  for (const x of [-0.25, 0.05, 0.3]) k.team(k.box(0.09, 0.6, 0.02, TEAM, 0.6 + x * 0.3, 1.65, 0.55 + x));
  // A ring of its people's cloth tied round the trunk, the mark a rival reads from afar.
  k.team(k.cyl(0.47, 0.49, 0.14, 9, TEAM, 0, 1.2, 0));
}

// ---- The Age of the Bloom (`docs/wild-road.md` §5b) ---------------------------------------------------

/**
 * A Seed Spire: three young trunks grown round one another into a tall twisted tower, bound with living withies, rising from a
 * ring of moss. At the top they open like fingers round a great seed pod, pale green and lit gold from within: the Bloom Seed
 * ripening. Leaves sprout from the twists all the way up. Its people's cloth is a band round the base.
 */
function spire(k: Kit): void {
  const bark = '#5a4630';
  const dark = '#3a2c1d';
  const leaf = ['#3f7a2e', '#5a9238', '#4a8534'];
  k.lathe([[0, 0.05], [0.95, 0], [0.9, 0.05], [0.6, 0.12], [0, 0.14]], 9, '#5c7c3c', 0, -0.03, 0);
  // Three trunks wound round the axis, each a stack of short leaning segments.
  for (let t = 0; t < 3; t++) {
    for (let i = 0; i < 9; i++) {
      const a = (t / 3) * Math.PI * 2 + i * 0.55;
      const r = 0.34 - i * 0.022;
      const seg = k.cyl(0.07 - i * 0.004, 0.09 - i * 0.004, 0.46, 5, t % 2 ? bark : dark, Math.cos(a) * r, 0.25 + i * 0.4, Math.sin(a) * r);
      seg.rotation.z = Math.cos(a + 1.2) * 0.35;
      seg.rotation.x = Math.sin(a + 1.2) * 0.35;
      if (i % 3 === 1) k.blob(0.13, leaf[(t + i) % 3], Math.cos(a) * (r + 0.12), 0.35 + i * 0.4, Math.sin(a) * (r + 0.12)).scale.set(1, 0.6, 1);
    }
  }
  // The withies binding them, three bands up the tower.
  for (const y of [0.9, 1.9, 2.9]) k.cyl(0.3 - y * 0.03, 0.31 - y * 0.03, 0.05, 8, '#7a6440', 0, y, 0);
  // The fingers opening round the pod, and the pod itself, glowing.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const f = k.cyl(0.025, 0.05, 0.6, 4, bark, Math.cos(a) * 0.22, 3.85, Math.sin(a) * 0.22);
    f.rotation.z = Math.cos(a) * -0.5;
    f.rotation.x = Math.sin(a) * 0.5;
  }
  k.glow(k.blob(0.26, '#c8e27a', 0, 4.05, 0)).scale.set(0.8, 1.25, 0.8);
  k.glow(k.blob(0.12, '#ffd65a', 0, 4.0, 0.12));
  k.team(k.cyl(0.4, 0.42, 0.14, 9, TEAM, 0, 0.2, 0));
}

// ---- The Age of Leviathans (`docs/wild-road.md` §5a) ---------------------------------------------------

/**
 * A Great Den: a hill hollowed out and roofed with living turf, its mouth a great arch held up by a giant's ribs, and a nest of reeds
 * with a pale egg the size of a cart in it. Its people's colours are the plinth's and the pennant's.
 */
function greatden(k: Kit, _e: number, st: Style): void {
  pad(k, 3, st.base);
  const turf = '#5c7a38';
  const earth = '#6a5236';
  const bone = '#e6dcc4';
  k.lathe([[0, 0], [1.45, 0], [1.4, 0.3], [1.15, 0.85], [0.7, 1.2], [0, 1.3]], 10, turf, 0, 0, -0.1).scale.set(1, 1, 0.9);
  for (const [x, z, r] of [[-1.0, 0.5, 0.3], [1.05, 0.3, 0.26], [0.6, -0.9, 0.3], [-0.7, -0.8, 0.24]]) k.blob(r, earth, x, 0.1, z).scale.set(1, 0.6, 1);
  // The mouth: a dark hollow, framed by three pairs of a giant's ribs leaning in to meet over it.
  k.box(1.0, 0.75, 0.6, '#20170f', 0, 0, 0.95);
  for (const [z, s] of [[1.3, 1], [1.12, 0.92], [0.94, 0.84]]) {
    for (const side of [-1, 1]) {
      const rib = k.cyl(0.035 * s, 0.06 * s, 1.25 * s, 5, bone, side * 0.6 * s, 0, z);
      rib.rotation.z = side * 0.5;
      rib.position.x = side * 0.32 * s;
    }
  }
  // The nest and the egg, lit faintly from within, in the mouth.
  k.cyl(0.36, 0.42, 0.1, 9, '#b89a5a', 0, 0, 1.05);
  k.glow(k.blob(0.2, '#f0e8d0', 0, 0.28, 1.05)).scale.set(0.85, 1.2, 0.85);
}

/**
 * A Town Center knelt from a Behemoth (the Age of Leviathans): the titan's shell rim under the town's pad, its head resting before
 * the gate and its four great feet out at the corners, so a rival sees at a glance that this town gets up and walks.
 */
function kneltShell(k: Kit): void {
  const shell = '#4f5a34';
  const skin = '#6d6a4c';
  // The shell's rim, a raised ring of scutes round the pad.
  k.lathe([[1.95, 0], [2.4, 0], [2.42, 0.12], [2.3, 0.32], [2.0, 0.4], [1.95, 0.4]], 14, shell, 0, -0.05, 0);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    k.box(0.5, 0.08, 0.32, '#6e7a44', Math.cos(a) * 2.2, 0.3, Math.sin(a) * 2.2).rotation.y = -a;
  }
  for (const [x, z] of [[-1.9, 1.7], [1.9, 1.7], [-1.9, -1.7], [1.9, -1.7]]) k.blob(0.42, skin, x * 1.1, 0.1, z * 1.1).scale.set(1, 0.6, 1.1);
  k.blob(0.55, skin, 0, 0.25, 2.75).scale.set(1, 0.7, 1.3);
  for (const x of [-0.3, 0.3]) k.sphere(0.08, '#1c1a12', x, 0.45, 3.05);
}

/**
 * An Orchard: four fruit trees in a wattle fence with a picker's basket. Young (`variant` 0) it is whips; grown (1), round crowns;
 * in fruit (2, summer and autumn) the crowns hang red and gold.
 */
function orchard(k: Kit, e: number, variant: number): void {
  k.box(1.9, 0.05, 1.9, '#5f7a3a', 0, -0.02, 0);
  // The fence: posts and a woven rail on three sides, open at the front.
  const fence = e >= 3 ? '#8a7a66' : '#8a6a3e';
  for (let i = 0; i < 5; i++) {
    const t = -0.85 + i * 0.425;
    for (const [x, z] of [[t, -0.88], [-0.88, t], [0.88, t]]) k.cyl(0.02, 0.025, 0.32, 4, fence, x, 0, z);
  }
  k.box(1.76, 0.05, 0.03, fence, 0, 0.22, -0.88);
  for (const x of [-0.88, 0.88]) k.box(0.03, 0.05, 1.76, fence, x, 0.22, 0);
  for (const [x, z] of [[-0.45, -0.4], [0.45, -0.4], [-0.45, 0.42], [0.45, 0.42]]) {
    if (variant === 0) {
      k.cyl(0.018, 0.025, 0.55, 4, BARK, x, 0, z);
      k.cone(0.12, 0.22, 5, '#6f9a44', x, 0.48, z);
      continue;
    }
    k.cyl(0.05, 0.07, 0.6, 6, BARK, x, 0, z);
    k.blob(0.36, '#4d7d36', x, 0.82, z).scale.set(1.1, 0.85, 1.1);
    if (variant === 2) for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + x;
      k.sphere(0.045, i % 2 ? '#c8402e' : '#e2a83a', x + Math.cos(a) * 0.3, 0.72 + (i % 3) * 0.08, z + Math.sin(a) * 0.3);
    }
  }
  k.cyl(0.13, 0.1, 0.16, 8, '#a8844e', 0.1, 0, 0.82);
  if (variant === 2) for (const dx of [0.05, 0.14]) k.sphere(0.04, '#c8402e', dx, 0.17, 0.82);
  k.team(k.box(0.06, 0.1, 0.06, TEAM, 0.88, 0.32, 0.88));
}

function huntcamp(k: Kit, e: number, st: Style): void {
  pad(k, 2, st.base);
  // A lean-to of hide on poles, a drying rack of meat beside it, a pile of antlers and a fire ring.
  const hide = e >= 2 ? st.roof : '#a8845a';
  for (const x of [-0.6, 0.6]) k.cyl(0.05, 0.05, 1.1, 5, st.post, x, 0, -0.45);
  k.prism(1.5, 0.55, 0.9, hide, 0, 0.62, -0.35);
  k.box(1.4, 0.45, 0.07, st.wall2, 0, 0, -0.78);
  for (const x of [0.35, 0.75]) k.cyl(0.04, 0.04, 0.8, 5, st.post, x, 0, 0.4);
  k.box(0.52, 0.04, 0.04, st.post, 0.55, 0.78, 0.4);
  for (const x of [0.43, 0.55, 0.67]) k.box(0.07, 0.3, 0.05, '#a33b32', x, 0.48, 0.4);
  for (const [x, z, r] of [[-0.5, 0.45, 0.4], [-0.3, 0.55, -0.5], [-0.45, 0.65, 0.1]]) {
    const antler = k.box(0.05, 0.05, 0.38, '#e7dfcc', x, 0.06, z);
    antler.rotation.y = r;
  }
  k.cyl(0.2, 0.22, 0.07, 8, '#5c5651', -0.05, 0, 0.45);
  k.sphere(0.1, '#e5742a', -0.05, 0.1, 0.45).scale.set(1, 0.9, 1);
  k.team(k.box(1.3, 0.05, 0.06, TEAM, 0, 0.6, 0.12));
  if (e <= 1) {
    // Stone and bronze hunters: a pelt stretched on a frame and an aurochs skull on a post.
    for (const x of [-1.05, -0.75]) k.cyl(0.03, 0.03, 0.6, 4, st.post, x, 0, 0.1);
    k.box(0.38, 0.4, 0.02, '#b89468', -0.9, 0.12, 0.1);
    k.cyl(0.035, 0.04, 0.9, 5, st.post, 1.1, 0, -0.1);
    k.box(0.2, 0.1, 0.12, '#e7dfcc', 1.1, 0.9, -0.1);
    for (const sx of [-1, 1]) k.box(0.14, 0.04, 0.04, '#e7dfcc', 1.1 + sx * 0.16, 0.98, -0.1);
  } else if (e === 2) {
    // Iron-age hunters: a stone-footed smokehouse with a chimney and a tanner's stretching frame.
    k.box(0.5, 0.5, 0.45, STONE, -1.0, 0, -0.1);
    k.prism(0.6, 0.25, 0.55, st.roof, -1.0, 0.5, -0.1);
    k.box(0.12, 0.35, 0.12, STONE, -1.15, 0.6, -0.2);
    k.box(0.14, 0.2, 0.03, '#2a2420', -1.0, 0, 0.14);
    k.cyl(0.03, 0.03, 0.7, 4, st.post, 1.1, 0, 0.0);
    k.box(0.4, 0.04, 0.04, st.post, 1.1, 0.7, 0.0);
    k.box(0.3, 0.4, 0.02, '#b89468', 1.1, 0.3, 0.0);
  } else {
    // Gunpowder and industrial game-dealers: a butcher's hook beam hung with carcasses, and a game cart.
    k.cyl(0.04, 0.05, 1.1, 5, e >= 4 ? '#3a3e44' : st.post, -1.1, 0, 0.0);
    k.box(0.8, 0.05, 0.05, e >= 4 ? '#3a3e44' : st.post, -0.75, 1.05, 0.0);
    for (const x of [-0.95, -0.7, -0.45]) k.box(0.1, 0.3, 0.08, '#a33b32', x, 0.7, 0.0);
    k.box(0.5, 0.18, 0.3, WOOD, 1.1, 0.12, 0.0);
    for (const z of [-0.17, 0.17]) k.cyl(0.14, 0.14, 0.04, 8, '#3a2b20', 1.1, 0.14, z).rotation.x = Math.PI / 2;
    k.box(0.3, 0.12, 0.2, '#a33b32', 1.1, 0.3, 0.0);
    if (e >= 4) lamp(k, 0.9, 0, 0.9, 0.75);
  }
  banner(k, 0.85, 0, 0.8, 0.8);
}

// ---- Mine Shaft (#681) ---------------------------------------------------------------------------------

/** The spoil heap's colours by seam (`SEAMS` order: stone, gold, salt, saltpetre, blood-iron): the rock, and the flecks of what is dug. */
const SPOIL: [string, string][] = [['#8d8579', '#b3aca0'], ['#7d7466', '#e8c040'], ['#9a948a', '#eeeae0'], ['#8f8a7c', '#d9d2b0'], ['#5e5650', '#6a1f24']];

/**
 * A shaft collar of squared timbers round a dark hole, the headframe over it, and a spoil heap beside it that shows the seam:
 * grey rock for stone, gold-flecked ore for gold, a rare ore's colour over its old workings. Bronze and Iron: an A-frame with
 * a windlass and a hanging bucket; Gunpowder: a taller timber frame with a sheave wheel; Industrial: an iron lattice headframe,
 * a winding-engine house and its stack. A rail of ore tubs runs from the collar.
 */
function shaft(k: Kit, e: number, st: Style, seam: number): void {
  pad(k, 2, st.base);
  const [rock, fleck] = SPOIL[Math.min(Math.max(seam, 0), SPOIL.length - 1)];
  // The collar and the hole.
  k.box(0.62, 0.03, 0.62, '#1c1712', -0.25, 0.02, -0.2);
  for (const [w, d, x, z] of [[0.82, 0.1, -0.25, -0.56], [0.82, 0.1, -0.25, 0.16], [0.1, 0.62, -0.61, -0.2], [0.1, 0.62, 0.11, -0.2]] as [number, number, number, number][]) {
    k.box(w, 0.12, d, e >= 3 ? STONE : WOOD, x, 0, z);
  }
  const frame = e >= 4 ? '#3a3e44' : st.post;
  const top = e >= 3 ? 1.75 : 1.25;
  // Two A-frames over the hole, joined at the top by the axle beam.
  for (const z of [-0.5, 0.1]) {
    for (const sx of [-1, 1]) {
      const leg = k.cyl(0.035, 0.045, Math.sqrt(0.36 * 0.36 + top * top), 5, frame, -0.25 + sx * 0.18, 0, z);
      leg.rotation.z = sx * 0.36 / top;
    }
  }
  k.box(0.08, 0.08, 0.72, frame, -0.25, top - 0.06, -0.2);
  if (e >= 3) {
    // The sheave wheel, its rope down the shaft.
    const wheel = k.cyl(0.26, 0.26, 0.05, 12, e >= 4 ? '#6a6e74' : WOOD, -0.25, top - 0.3, -0.2);
    wheel.rotation.z = Math.PI / 2;
    k.box(0.015, top - 0.35, 0.015, '#c9b98f', -0.25, 0.15, -0.2);
  } else {
    // A windlass with its crank, the rope and a bucket of ore halfway up.
    const drum = k.cyl(0.07, 0.07, 0.62, 6, WOOD, -0.25, 0.62, -0.2);
    drum.rotation.x = Math.PI / 2;
    for (const z of [-0.55, 0.15]) k.box(0.06, 0.66, 0.06, st.post, -0.25, 0, z);
    k.box(0.04, 0.18, 0.04, st.post, -0.25, 0.62, 0.22);
    k.box(0.015, 0.3, 0.015, '#c9b98f', -0.25, 0.32, -0.2);
    k.cyl(0.08, 0.06, 0.12, 6, WOOD, -0.25, 0.2, -0.2);
  }
  if (e >= 4) {
    // The winding-engine house and its stack, a cable running to the wheel.
    k.box(0.6, 0.55, 0.5, st.wall, 0.6, 0, -0.55);
    k.prism(0.64, 0.22, 0.54, st.roof, 0.6, 0.55, -0.55);
    k.cyl(0.07, 0.09, 1.2, 6, '#7a3a2c', 0.82, 0, -0.72);
    const cable = k.box(0.012, 0.012, 1.1, '#2b2b2e', 0.2, 1.05, -0.38);
    cable.rotation.y = 1.1;
    cable.rotation.z = 0.5;
  }
  // The spoil heap: the seam shows in it.
  k.sphere(0.42, rock, 0.55, 0.0, 0.42).scale.set(1, 0.55, 1);
  k.sphere(0.24, rock, 0.25, 0.0, 0.7).scale.set(1, 0.5, 1);
  for (const [x, y, z] of [[0.45, 0.17, 0.3], [0.62, 0.15, 0.55], [0.72, 0.1, 0.25], [0.35, 0.12, 0.55], [0.22, 0.06, 0.75]] as [number, number, number][]) {
    k.octa(0.055, fleck, x, y, z);
  }
  // Ore tubs on a short rail from the collar.
  for (const x of [-0.85, -0.45]) k.box(0.025, 0.02, 0.62, '#4a4a4e', x, 0, 0.6);
  for (const z of [0.45, 0.78]) {
    k.box(0.36, 0.2, 0.22, e >= 3 ? '#4a4a4e' : WOOD, -0.65, 0.04, z);
    k.sphere(0.1, fleck, -0.65, 0.24, z).scale.set(1.3, 0.5, 0.8);
  }
  // A pick and a shovel against the collar.
  const haft = k.cyl(0.018, 0.018, 0.55, 4, WOOD, 0.25, 0.0, -0.75);
  haft.rotation.x = 0.35;
  k.box(0.24, 0.035, 0.035, '#8a8f96', 0.25, 0.5, -0.66);
  k.team(k.box(0.012, 0.16, 0.24, TEAM, -0.25, top - 0.3, 0.16));
}

// ---- Prospector's Lodge (#562) -------------------------------------------------------------------------

/**
 * A low log lodge with a lean-to roof, and before it what prospectors bring home: a sluice trough with a pan, a heap
 * of sample stones in the key resources' colours (rust bog iron, white salt, pale saltpetre, dark blood-iron), a pick
 * leaning on the wall and a surveyor's pole. Later epochs add a stone assay furnace, then a brass theodolite.
 */
function prospector(k: Kit, e: number, st: Style): void {
  pad(k, 2, st.base);
  // The lodge: log walls, a single-pitch roof falling to the back, a dark door.
  k.box(1.3, 0.62, 0.9, st.wall, -0.15, 0, -0.35);
  for (const y of [0.15, 0.32, 0.49]) k.box(1.34, 0.04, 0.04, st.wall2, -0.15, y, 0.11);
  const roof = k.box(1.5, 0.08, 1.12, e >= 2 ? st.roof : '#7d8a4a', -0.15, 0.78, -0.35);
  roof.rotation.x = -0.28;
  k.box(0.28, 0.42, 0.03, st.window, -0.35, 0, 0.11);
  // A pick leaning by the door.
  const haft = k.cyl(0.02, 0.02, 0.62, 4, WOOD, 0.08, 0.28, 0.16);
  haft.rotation.z = 0.25;
  k.box(0.28, 0.04, 0.04, e >= 1 ? '#8a8f96' : '#6f6a62', 0.0, 0.58, 0.16).rotation.z = 0.25;
  // The sluice: a sloped trough on trestles, a pan of grit at its foot.
  const trough = k.box(0.22, 0.08, 0.95, WOOD, 0.75, 0.32, -0.15);
  trough.rotation.x = 0.2;
  for (const z of [-0.5, 0.2]) k.box(0.2, z < 0 ? 0.42 : 0.22, 0.04, st.post, 0.75, 0, z);
  k.cyl(0.17, 0.12, 0.06, 8, e >= 2 ? '#7a6a58' : '#8a6a44', 0.75, 0.0, 0.5);
  k.cyl(0.13, 0.13, 0.02, 8, '#5d7f96', 0.75, 0.05, 0.5);
  // The samples: a small heap of each key resource's colour.
  for (const [x, z, c] of [[-0.6, 0.45, '#a0482a'], [-0.42, 0.62, '#eeeae0'], [-0.22, 0.48, '#d9d2b0'], [-0.48, 0.32, '#6a1f24'], [-0.3, 0.32, '#8d8579']] as [number, number, string][]) {
    k.sphere(0.075, c, x, 0.04, z).scale.set(1, 0.7, 1);
  }
  // The surveyor's pole, banded so it reads from afar, and the people's cloth on it.
  k.cyl(0.02, 0.025, 1.35, 5, '#d8d0b8', -0.9, 0, 0.55);
  for (const y of [0.3, 0.7, 1.1]) k.cyl(0.026, 0.026, 0.14, 5, '#b8433a', -0.9, y, 0.55);
  k.team(k.box(0.012, 0.18, 0.26, TEAM, -0.9, 1.15, 0.68));
  if (e >= 2) {
    // An assay furnace of stone at the lodge's side, its chimney smoking.
    k.box(0.4, 0.45, 0.4, STONE, 0.72, 0, -0.75);
    k.cyl(0.08, 0.1, 0.5, 6, STONE, 0.72, 0.45, -0.75);
    k.box(0.14, 0.14, 0.03, '#e5742a', 0.72, 0.08, -0.54);
  }
  if (e >= 3) {
    // A brass theodolite on its tripod, aimed at the hills.
    for (const r of [0, 2.1, 4.2]) {
      const leg = k.cyl(0.012, 0.012, 0.55, 3, WOOD, 0.35 + Math.cos(r) * 0.08, 0, 0.62 + Math.sin(r) * 0.08);
      leg.rotation.z = Math.cos(r) * 0.2;
      leg.rotation.x = -Math.sin(r) * 0.2;
    }
    k.cyl(0.04, 0.04, 0.16, 6, '#c9a245', 0.35, 0.56, 0.62).rotation.z = Math.PI / 2;
  }
  if (e >= 4) lamp(k, 0.2, 0, 0.62, 0.7);
}

// ---- Snare (#485) ---------------------------------------------------------------------------------

/** A noose on a bent sapling among the trees, a forked trigger peg and bait; with `full`, a hare lies caught in it. */
function snare(k: Kit, e: number, full: boolean): void {
  k.box(0.85, 0.03, 0.85, '#5b4a32', 0, -0.01, 0);
  const bark = '#6b5232';
  // The sapling, bent over and held down by the trigger.
  k.cyl(0.02, 0.028, 0.75, 4, bark, -0.3, 0, 0);
  k.cyl(0.016, 0.02, 0.4, 4, bark, -0.132, 0.658, 0).rotation.z = -1.0;
  k.cyl(0.012, 0.016, 0.51, 4, bark, 0.143, 0.477, 0).rotation.z = -2.71;
  for (const [x, y, z] of [[-0.36, 0.62, 0.06], [-0.05, 0.86, -0.05]]) k.cone(0.07, 0.12, 4, '#4e7a3a', x, y, z);
  // The cord, the noose and the forked peg it hangs from.
  k.cyl(0.006, 0.006, 0.38, 3, '#d8c9a0', 0.25, 0.12, 0);
  for (const x of [0.19, 0.31]) k.box(0.012, 0.12, 0.012, '#d8c9a0', x, 0.03, 0);
  for (const y of [0.03, 0.15]) k.box(0.13, 0.012, 0.012, '#d8c9a0', 0.25, y, 0);
  for (const z of [-0.1, -0.16]) k.cyl(0.015, 0.018, 0.2, 4, bark, 0.25, 0, z);
  k.sphere(0.035, '#8e2f3a', 0.25, 0.04, 0.12);
  // A strip of the people's cloth tied round the sapling, so its owner can find the line.
  k.team(k.box(0.06, 0.08, 0.06, TEAM, -0.3, 0.45, 0));
  // Later hunters set iron jaws beside the noose.
  if (e >= 3) {
    k.box(0.22, 0.03, 0.18, '#3a3e44', -0.05, 0, 0.27);
    for (const z of [0.2, 0.34]) k.box(0.22, 0.05, 0.015, '#55595f', -0.05, 0.03, z);
  }
  if (full) {
    // A hare taken in the noose.
    k.blob(0.1, '#9a8a74', 0.18, 0.07, 0.17).scale.set(1.5, 0.75, 0.9);
    k.sphere(0.055, '#8c7c66', 0.04, 0.08, 0.17);
    for (const z of [0.15, 0.19]) k.box(0.1, 0.018, 0.025, '#8c7c66', -0.04, 0.1, z);
    k.sphere(0.03, '#e8e2d6', 0.33, 0.08, 0.17);
  }
}

// ---- Sapling (#501, the managed wood) --------------------------------------------------------------

/** A young tree just set in the ground: a ring of turned earth, a whip of a trunk tied to its stake, a wicker guard against the deer. */
function sapling(k: Kit, e: number): void {
  k.box(0.6, 0.04, 0.6, '#5b4630', 0, -0.01, 0);
  k.box(0.36, 0.06, 0.36, '#6e5638', 0, 0, 0);
  const bark = '#6b5232';
  k.cyl(0.018, 0.026, 0.62, 4, bark, 0, 0, 0);
  k.cyl(0.012, 0.016, 0.7, 4, '#8a7350', 0.07, 0, 0.02);
  for (const [x, y, z, r] of [[0, 0.62, 0, 0.13], [-0.07, 0.5, 0.05, 0.1], [0.06, 0.46, -0.06, 0.09]]) k.cone(r, 0.22, 5, '#5f8f42', x, y, z);
  k.box(0.03, 0.03, 0.03, '#d8c9a0', 0.035, 0.32, 0.01);
  // The guard: woven withies round the whip, later a ring of iron.
  const guard = e >= 3 ? '#4a4e54' : '#8c6e44';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.cyl(0.008, 0.008, 0.3, 3, guard, Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12);
  }
  // The people's cloth tied on the stake, so its planter knows it.
  k.team(k.box(0.05, 0.06, 0.05, TEAM, 0.07, 0.55, 0.02));
}

// ---- War Camp (#303) -------------------------------------------------------------------------------

function warcamp(k: Kit, e: number, st: Style): void {
  // Trampled ground, a ring of sharpened stakes, two ridge tents, a rack of spears, a cook fire, and the war standard.
  k.box(1.9, 0.05, 1.9, '#6f5a43', 0, -0.02, 0);
  const canvas = e >= 3 ? '#cfc6ae' : '#b9a27a';
  for (let i = 0; i < 14; i++) {
    // Around the edge, leaving a gap on the near side for the gate.
    const side = i % 4;
    const a = -0.8 + (Math.floor(i / 4) + 0.5) * 0.4;
    if (side === 2 && Math.abs(a) < 0.3) continue;
    const x = side === 0 ? -0.88 : side === 1 ? 0.88 : a;
    const z = side === 2 ? 0.88 : side === 3 ? -0.88 : a;
    k.cyl(0.0, 0.045, 0.42, 4, st.post, x, 0, z);
  }
  for (const [x, z] of [[-0.42, -0.35], [0.38, -0.3]]) {
    k.prism(0.75, 0.55, 0.62, canvas, x, 0, z);
    k.box(0.04, 0.6, 0.04, st.post, x, 0, z + 0.32);
  }
  // Spears stacked on a rack, iron-tipped.
  k.box(0.6, 0.04, 0.04, st.post, 0.35, 0.36, 0.42);
  for (const x of [0.15, 0.27, 0.39, 0.51]) {
    const spear = k.cyl(0.012, 0.012, 0.75, 4, '#7a5a3a', x, 0, 0.38);
    spear.rotation.x = -0.18;
    k.cone(0.025, 0.09, 4, '#7c8088', x, 0.75, 0.31);
  }
  k.cyl(0.18, 0.2, 0.06, 8, '#55504a', -0.35, 0, 0.35);
  k.sphere(0.09, '#e5742a', -0.35, 0.1, 0.35).scale.set(1, 1.3, 1);
  // The war standard: a tall pole with a crimson streamer over the people's colour.
  k.cyl(0.025, 0.03, 1.6, 5, '#3f2e22', 0, 0, -0.05);
  k.box(0.012, 0.18, 0.5, '#9b1c2c', 0, 1.3, 0.2);
  k.team(k.box(0.014, 0.16, 0.36, TEAM, 0, 1.1, 0.13));
  k.cone(0.05, 0.12, 4, '#c9a23a', 0, 1.6, -0.05);
}

// ---- Drain Rig (#355) ------------------------------------------------------------------------------

function drainrig(k: Kit, _e: number, st: Style): void {
  // Trampled ground stained dark, a copper-lined trough on trestles with a windlass over it, a rack of pale jars,
  // and a dark standard over the people's colour.
  k.box(1.9, 0.05, 1.9, '#5b4a3c', 0, -0.02, 0);
  k.box(0.9, 0.012, 0.7, '#4a1218', 0.1, 0.03, 0.15);
  // The trough: a long basin on two trestles, copper inside, with a spout.
  for (const x of [-0.35, 0.55]) k.box(0.08, 0.34, 0.5, st.post, x, 0, 0.1);
  k.box(1.1, 0.12, 0.55, '#8a5a3a', 0.1, 0.34, 0.1);
  k.box(0.98, 0.02, 0.43, '#b4592f', 0.1, 0.45, 0.1);
  k.box(0.98, 0.012, 0.43, '#5a1019', 0.1, 0.465, 0.1);
  k.cyl(0.03, 0.03, 0.3, 5, '#b4592f', 0.7, 0.28, 0.1).rotation.z = Math.PI / 2;
  // The windlass: two posts, a crossbar and a crank, with a chain hanging over the trough.
  for (const x of [-0.45, 0.65]) k.cyl(0.035, 0.045, 1.0, 5, st.post, x, 0, -0.35);
  const bar = k.cyl(0.04, 0.04, 1.2, 6, '#3f2e22', 0.1, 0.95, -0.35);
  bar.rotation.z = Math.PI / 2;
  k.box(0.03, 0.03, 0.2, '#7c8088', 0.72, 0.95, -0.45);
  k.cyl(0.0, 0.012, 0.55, 4, '#7c8088', 0.1, 0.42, -0.2);
  // A rack of pale jars along the back.
  k.box(1.0, 0.04, 0.2, st.post, -0.1, 0.3, -0.78);
  for (let i = 0; i < 5; i++) {
    k.cyl(0.07, 0.085, 0.2, 7, i % 2 ? '#d8cdb8' : '#c9bda4', -0.5 + i * 0.2, 0.34, -0.78);
    k.cone(0.045, 0.06, 6, '#7a1822', -0.5 + i * 0.2, 0.54, -0.78);
  }
  // The standard: a dark pole with a black-red streamer over the people's colour.
  k.cyl(0.025, 0.03, 1.5, 5, '#2b2120', -0.75, 0, 0.6);
  k.box(0.012, 0.2, 0.5, '#4a0e16', -0.75, 1.2, 0.85);
  k.team(k.box(0.014, 0.16, 0.34, TEAM, -0.75, 1.0, 0.78));
  k.cone(0.05, 0.12, 4, '#9b1c2c', -0.75, 1.5, 0.6);
}

// ---- Transfusion Station and Blood Tower (#355 s3) ---------------------------------------------------

function transfusion(k: Kit, _e: number, st: Style): void {
  // A riveted iron shed on a brick plinth, three glass tanks of dark blood along its side fed by copper pipes, a pump with a
  // flywheel, a chimney, and two cots under an awning at the door.
  k.box(1.9, 0.08, 1.9, '#5b544c', 0, -0.02, 0);
  k.box(1.2, 0.2, 1.0, '#7a3a30', -0.2, 0.06, -0.25);
  k.box(1.1, 0.75, 0.9, '#4b4e54', -0.2, 0.26, -0.25);
  k.prism(1.2, 0.3, 1.0, '#33363b', -0.2, 1.01, -0.25);
  for (const x of [-0.7, -0.2, 0.3]) k.box(0.04, 0.75, 0.04, '#2c2e33', x, 0.26, 0.21);
  k.box(0.32, 0.5, 0.02, '#1d1a1a', -0.2, 0.26, 0.21);
  k.team(k.box(1.12, 0.1, 0.92, TEAM, -0.2, 0.88, -0.25));
  // The tanks: glass over a dark red fill that glows faintly, iron hoops, copper pipes into the shed.
  for (let i = 0; i < 3; i++) {
    const z = -0.7 + i * 0.42;
    k.cyl(0.16, 0.16, 0.06, 8, IRON_DARK, 0.65, 0.06, z);
    const fill = 0.3 + i * 0.1;
    k.glow(k.cyl(0.15, 0.15, fill, 8, '#7a0f1c', 0.65, 0.12, z));
    k.cyl(0.15, 0.15, 0.62 - fill, 8, '#c9d4d6', 0.65, 0.12 + fill, z);
    k.cyl(0.165, 0.165, 0.04, 8, IRON_DARK, 0.65, 0.74, z);
    k.box(0.3, 0.04, 0.04, COPPER, 0.42, 0.62, z);
  }
  // The pump and its flywheel, and a stack.
  k.box(0.3, 0.3, 0.3, IRON_DARK, 0.6, 0.0, 0.65);
  const wheel = k.cyl(0.2, 0.2, 0.05, 10, '#2c2e33', 0.6, 0.45, 0.82);
  wheel.rotation.x = Math.PI / 2;
  k.cyl(0.07, 0.09, 1.0, 6, '#3a3c40', -0.6, 1.0, -0.55);
  k.cyl(0.1, 0.07, 0.08, 6, RUST, -0.6, 2.0, -0.55);
  // The cots under an awning, a dark stain on each.
  k.box(1.0, 0.04, 0.45, st.post, -0.25, 0.75, 0.48);
  for (const x of [-0.55, 0.05]) {
    k.box(0.22, 0.16, 0.5, '#6d6a62', x, 0.0, 0.48);
    k.box(0.2, 0.02, 0.46, PALE, x, 0.16, 0.48);
    k.box(0.1, 0.012, 0.14, '#5a1019', x, 0.18, 0.52);
  }
}

function bloodtower(k: Kit, _e: number, st: Style): void {
  // A squat tower of black brick banded in iron, a copper cistern on its crown with a sightglass of blood, and barbed bolt-throwers
  // at the four corners.
  pad(k, 2, st.base);
  k.cyl(0.7, 0.82, 1.9, 8, '#2a2426', 0, 0, 0);
  for (const y of [0.5, 1.2, 1.85]) k.cyl(0.8 - y * 0.06, 0.8 - y * 0.06, 0.07, 8, IRON_DARK, 0, y, 0);
  k.team(k.cyl(0.79, 0.79, 0.12, 8, TEAM, 0, 0.95, 0));
  k.cyl(0.86, 0.72, 0.18, 8, '#3a3134', 0, 1.9, 0);
  // The cistern, its sightglass and the drip down the side.
  k.cyl(0.5, 0.5, 0.55, 10, COPPER, 0, 2.08, 0);
  k.cone(0.52, 0.28, 10, '#9a5a2c', 0, 2.63, 0);
  k.box(0.08, 0.4, 0.02, '#c9d4d6', 0, 2.12, 0.5);
  k.glow(k.box(0.05, 0.28, 0.02, BLOOD, 0, 2.14, 0.51));
  k.box(0.06, 1.6, 0.02, '#4a0e16', 0.3, 0.3, 0.74);
  // Bolt-throwers at the corners of the crown.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * 0.68;
    const z = Math.sin(a) * 0.68;
    k.box(0.14, 0.14, 0.14, IRON_DARK, x, 2.08, z);
    const bolt = k.cyl(0.02, 0.02, 0.4, 4, '#7c8088', x * 1.15, 2.2, z * 1.15);
    bolt.rotation.z = Math.PI / 2;
    bolt.rotation.y = -a;
  }
  window(k, st, 0, 1.4, 0.75, 0.08, 0.18);
}

/**
 * The Mission (#555 s12): a whitewashed chapel with a red-tiled roof and a little bell gable, a cross over the door and a
 * pennant on a pole by the water, on a pad of trodden sand: a foothold, not a fortress.
 */
function mission(k: Kit, _e: number, _st: Style): void {
  const WASH = '#f1ece0';
  const TILE = '#b4573a';
  k.box(1.95, 0.05, 1.95, '#cdb98f', 0, -0.02, 0);
  k.box(1.1, 0.7, 1.4, WASH, 0, 0, -0.1);
  k.prism(1.3, 0.4, 1.6, TILE, 0, 0.7, -0.1).rotation.y = Math.PI / 2;
  k.box(0.5, 0.95, 0.12, WASH, 0, 0, 0.62);
  k.box(0.16, 0.2, 0.1, '#2f2a25', 0, 0.62, 0.69);
  k.box(0.04, 0.3, 0.04, '#e2b23c', 0, 0.95, 0.62);
  k.box(0.16, 0.04, 0.04, '#e2b23c', 0, 1.12, 0.62);
  k.box(0.2, 0.34, 0.04, '#3b2c20', 0, 0, 0.7);
  k.team(k.box(0.5, 0.05, 0.05, TEAM, 0, 0.78, 0.7));
  k.box(0.04, 1.1, 0.04, '#6b4b2f', 0.8, 0, 0.7);
  k.team(k.box(0.34, 0.2, 0.03, TEAM, 0.97, 0.85, 0.7));
}

/**
 * The Caravanserai (#334): a square mudbrick courtyard with round corner buttresses and a tall arched portal
 * banded in turquoise tile. Inside, a well, bales of dyed cloth, and a camel kneeling to be unloaded.
 */
function caravanserai(k: Kit, _e: number, _st: Style): void {
  const BRICK = '#d4b07e';
  const BRICK2 = '#c39d6a';
  const TILE = '#3f8f9a';
  const DARK = '#2a2018';
  k.box(1.95, 0.05, 1.95, '#b89a6c', 0, -0.02, 0);
  k.box(1.5, 0.03, 1.5, '#cdb48c', 0, 0.02, 0);
  // The outer walls, the front split by the portal.
  k.box(1.8, 0.58, 0.18, BRICK, 0, 0, -0.81);
  for (const x of [-0.81, 0.81]) k.box(0.18, 0.58, 1.8, BRICK, x, 0, 0);
  for (const x of [-0.6, 0.6]) k.box(0.6, 0.58, 0.18, BRICK, x, 0, 0.81);
  // A crenellated parapet along the top.
  for (let i = 0; i < 7; i++) {
    const t = -0.72 + i * 0.24;
    k.box(0.1, 0.08, 0.2, BRICK2, -0.81, 0.58, t);
    k.box(0.1, 0.08, 0.2, BRICK2, 0.81, 0.58, t);
    k.box(0.2, 0.08, 0.1, BRICK2, t, 0.58, -0.81);
  }
  // Round buttresses at the corners.
  for (const [x, z] of [[-0.84, -0.84], [0.84, -0.84], [-0.84, 0.84], [0.84, 0.84]]) {
    k.cyl(0.15, 0.17, 0.72, 8, BRICK2, x, 0, z);
    k.cyl(0.17, 0.17, 0.05, 8, BRICK, x, 0.72, z);
  }
  // Arched sleeping bays along the inside of the back wall.
  for (const x of [-0.45, 0, 0.45]) {
    k.box(0.22, 0.3, 0.02, DARK, x, 0.04, -0.71);
    k.dome(0.11, DARK, x, 0.34, -0.71).scale.set(1, 1, 0.15);
  }
  // The portal (pishtaq): taller than the walls, its arch dark, a band of turquoise tile over it.
  k.box(0.64, 1.0, 0.26, BRICK2, 0, 0, 0.84);
  k.box(0.32, 0.5, 0.03, DARK, 0, 0, 0.97);
  k.dome(0.16, DARK, 0, 0.5, 0.97).scale.set(1, 1.1, 0.12);
  k.box(0.66, 0.08, 0.28, TILE, 0, 0.8, 0.84);
  k.box(0.68, 0.05, 0.3, BRICK, 0, 1.0, 0.84);
  for (const x of [-0.24, 0.24]) k.box(0.05, 0.6, 0.02, TILE, x, 0.08, 0.98);
  banner(k, 0, 1.03, 0.78, 0.55);
  for (const x of [-0.42, 0.42]) torch(k, x, 0.55, 1.0);
  // The courtyard: a well, bales of dyed cloth, and a camel kneeling by them.
  k.cyl(0.15, 0.16, 0.16, 8, STONE, 0, 0, -0.2);
  k.cyl(0.11, 0.11, 0.01, 8, '#2d4a5a', 0, 0.16, -0.2);
  const dyes = ['#a83a3a', '#3a4e9a', '#e0a83a'];
  for (let i = 0; i < 3; i++) k.box(0.2, 0.15, 0.16, dyes[i], 0.42, i === 2 ? 0.15 : 0, -0.42 + (i === 2 ? 0.08 : i * 0.17));
  const CAMEL = '#c49a62';
  k.box(0.34, 0.15, 0.15, CAMEL, -0.38, 0.02, -0.42);
  k.sphere(0.09, CAMEL, -0.4, 0.2, -0.42).scale.set(1.2, 0.9, 0.9);
  k.box(0.06, 0.2, 0.06, CAMEL, -0.17, 0.12, -0.42).rotation.z = -0.35;
  k.box(0.12, 0.06, 0.06, CAMEL, -0.1, 0.3, -0.42);
  k.box(0.1, 0.03, 0.17, dyes[1], -0.4, 0.17, -0.42);
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
  if (e >= 3) {
    // A haystack and a water trough at the corner.
    k.cone(0.3, 0.42, 7, HAY, -1.1, 0, -1.1).scale.set(1, 1, 1);
    k.box(0.5, 0.1, 0.16, WOOD, 1.05, 0, -1.1);
  }
  if (e >= 4) {
    // A lattice windpump: legs, a vane and a many-bladed wheel.
    for (const [x, z] of [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]]) k.cyl(0.012, 0.02, 1.2, 4, '#3a3e44', 1.2 + x * 1.5, 0, -1.2 + z * 1.5);
    k.cyl(0.012, 0.012, 0.1, 4, '#3a3e44', 1.2, 1.2, -1.2);
    for (let i = 0; i < 6; i++) {
      const blade = k.box(0.03, 0.26, 0.01, '#9aa0a6', 1.2, 1.3, -1.12);
      blade.rotation.z = (i * Math.PI) / 3;
    }
    k.box(0.01, 0.12, 0.3, '#b33a32', 1.2, 1.3, -1.35);
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
    // A fortress barracks: a tall stepped gate tower between two crenellated wings, so it stands up out of the rows of low roofs.
    k.box(2.6, 0.8, 1.4, st.wall, 0, 0, -0.6);
    k.box(2.7, 0.07, 1.5, st.trim, 0, 0.8, -0.6);
    for (const x of [-1.2, -0.9, -0.6, 0.6, 0.9, 1.2]) k.box(0.2, 0.16, 0.16, st.wall, x, 0.87, -1.2);
    k.box(1.0, 1.6, 0.9, st.wall, 0, 0, -0.55);
    k.box(1.1, 0.08, 1.0, st.trim, 0, 1.6, -0.55);
    k.box(0.7, 0.5, 0.7, st.wall2, 0, 1.68, -0.55);
    k.box(0.8, 0.06, 0.8, st.trim, 0, 2.18, -0.55);
    for (const [x, z] of [[-0.35, -0.9], [0.35, -0.9], [-0.35, -0.2], [0.35, -0.2]]) k.box(0.16, 0.16, 0.16, st.wall, x, 2.24, z);
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
  if (e === 4) {
    // A brick drill hall: long flat-roofed wings with a parapet, a central gatehouse, a flagpole and a gun on the parade.
    k.box(2.7, 1.1, 1.6, st.wall, 0, 0, -0.5);
    k.box(2.8, 0.1, 1.7, st.trim, 0, 1.1, -0.5);
    k.box(2.8, 0.14, 0.06, IRON_DARK, 0, 1.2, 0.33);
    k.box(0.9, 1.6, 0.9, st.wall, 0, 0, -0.1);
    k.box(1.0, 0.1, 1.0, st.trim, 0, 1.6, -0.1);
    k.prism(1.0, 0.45, 0.95, st.roof, 0, 1.7, -0.1);
    k.box(0.5, 0.8, 0.04, '#2b2b2e', 0, 0, 0.37);
    k.box(0.6, 0.06, 0.1, IRON_DARK, 0, 0.82, 0.4);
    for (const x of [-1.15, -0.75, 0.75, 1.15]) window(k, st, x, 0.45, 0.31, 0.16, 0.3);
    for (const x of [-1.0, 1.0]) k.box(0.2, 0.4, 0.2, st.base, x, 1.2, 0.2);
    k.team(k.box(0.5, 0.1, 0.04, TEAM, 0, 1.0, 0.4));
    k.cyl(0.04, 0.04, 2.6, 5, '#e8e2d0', 1.2, 0, 1.2);
    k.team(k.box(0.02, 0.4, 0.6, TEAM, 1.2, 2.1, 1.5));
    k.cyl(0.1, 0.12, 0.45, 8, IRON_DARK, -0.9, 0.05, 1.1).rotation.x = Math.PI / 2 - 0.15;
    for (const sx of [-1, 1]) k.cyl(0.14, 0.14, 0.05, 8, IRON_DARK, -0.9 + sx * 0.16, 0, 1.0).rotation.z = Math.PI / 2;
    return;
  }
  // A bastioned barracks: a low flat-topped block with merlons, a pike rack in the yard and a sentry corner turret.
  k.box(2.7, 1.3, 1.6, st.wall, 0, 0, -0.5);
  k.box(2.76, 0.07, 1.66, st.trim, 0, 1.3, -0.5);
  k.prism(2.0, 0.5, 1.0, st.roof, 0, 1.36, -0.5);
  for (let i = 0; i < 8; i++) k.box(0.22, 0.2, 0.12, st.trim, -1.2 + i * 0.34, 1.37, 0.24);
  k.cyl(0.3, 0.32, 1.9, 8, st.wall, -1.2, 0, -1.0);
  k.cone(0.38, 0.5, 8, st.roof, -1.2, 1.9, -1.0);
  for (let i = 0; i < 5; i++) k.cyl(0.015, 0.015, 1.3, 4, WOOD, 0.2 + i * 0.14, 0, 0.95).rotation.z = 0.12;
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
    // An open hunters' shed: spear rack and throwing-stick bundle under the roof, a pile of throwing stones, a skull on a post.
    for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, -0.3], [1.2, -0.3]]) k.cyl(0.05, 0.05, 0.75, 5, st.post, x, 0, z);
    k.prism(2.7, 0.55, 1.2, st.roof, 0, 0.75, -0.75);
    k.box(2.3, 0.04, 0.04, st.post, 0, 0.55, -1.15);
    for (let i = 0; i < 6; i++) k.cyl(0.015, 0.015, 0.9, 4, WOOD, -0.9 + i * 0.16, 0, -1.1).rotation.z = 0.12;
    for (let i = 0; i < 6; i++) k.cone(0.025, 0.1, 4, '#8b8d88', -0.9 + i * 0.16 + 0.1, 0.84, -1.1);
    for (let i = 0; i < 5; i++) k.cyl(0.07, 0.07, 0.07, 5, '#8b8d88', 0.4 + (i % 3) * 0.12, 0, -0.4 + Math.floor(i / 3) * 0.1);
    k.cyl(0.03, 0.03, 0.5, 5, st.post, 1.55, 0, 0.5);
    k.cyl(0.07, 0.06, 0.1, 6, '#e8e2d0', 1.55, 0.5, 0.5);
  } else if (e === 1) {
    // A mudbrick archers' court: a flat-roofed hall with crenellated parapet, a bow rack and an earth butt.
    k.box(2.6, 0.8, 1.0, st.wall, 0, 0, -0.85);
    k.box(2.7, 0.07, 1.1, st.trim, 0, 0.8, -0.85);
    for (let i = 0; i < 7; i++) k.box(0.22, 0.14, 0.1, st.wall, -1.2 + i * 0.4, 0.87, -1.3);
    for (let i = 0; i < 4; i++) k.cyl(0.05, 0.06, 0.8, 6, st.trim, -1.0 + i * 0.66, 0, -0.25);
    k.box(2.6, 0.06, 0.7, st.roof, 0, 0.78, -0.3);
    for (const x of [-0.7, 0.7]) k.box(0.1, 0.4, 0.04, '#2b2b2e', x, 0.2, -0.33);
    for (let i = 0; i < 3; i++) k.cyl(0.015, 0.015, 0.55, 4, WOOD, -1.2 + i * 0.1, 0, 0.35).rotation.z = 0.2;
    k.prism(1.4, 0.35, 0.4, st.wall2, 0, 0, 1.45);
    // A tall archers' mast with a gong ring and a pennon: the one vertical on a long, low court.
    k.cyl(0.04, 0.05, 2.0, 5, st.post, 1.25, 0, -0.25);
    k.cyl(0.2, 0.2, 0.05, 10, '#c89a3a', 1.25, 1.55, -0.18).rotation.x = Math.PI / 2;
    k.cone(0.07, 0.2, 5, st.roof2, 1.25, 2.0, -0.25);
    k.box(0.8, 0.05, 0.3, st.roof2, 0, 0.82, -1.0).rotation.x = -0.2;
  } else if (e === 2) {
    // A timber-framed archery hall: arrow slits, an overhanging hoarding, a quiver barrel and straw butts.
    k.box(2.6, 0.85, 1.0, st.wall, 0, 0, -0.85);
    for (const x of [-1.0, -0.5, 0, 0.5, 1.0]) k.box(0.05, 0.85, 1.02, st.trim, x, 0, -0.85);
    k.box(2.8, 0.14, 1.2, st.trim, 0, 0.85, -0.85);
    k.prism(2.7, 0.65, 1.2, st.roof, 0, 0.99, -0.85);
    window(k, st, -0.6, 0.4, -0.34);
    window(k, st, 0.6, 0.4, -0.34);
    for (const x of [-0.25, 0, 0.25]) k.box(0.04, 0.22, 0.03, '#2b2b2e', x, 0.4, -0.34);
    k.cyl(0.14, 0.12, 0.34, 8, WOOD, -1.3, 0, 0.3);
    for (let i = 0; i < 4; i++) k.cyl(0.012, 0.012, 0.3, 4, '#e8e2d0', -1.36 + i * 0.04, 0.34, 0.3);
    for (const x of [-0.45, 0.45]) k.box(0.3, 0.2, 0.2, HAY, x, 0, 1.2);
  } else if (e === 4) {
    // A rifle range of the machine age: a brick hall with a flat roof and skylight, firing stands in front.
    k.box(2.6, 1.0, 1.0, st.wall, 0, 0, -0.85);
    k.box(2.7, 0.08, 1.1, st.trim, 0, 1.0, -0.85);
    k.box(1.2, 0.2, 0.5, IRON_DARK, 0, 1.08, -0.85);
    k.box(1.1, 0.04, 0.4, '#8fb4c8', 0, 1.28, -0.85);
    for (let i = 0; i < 4; i++) window(k, st, -0.9 + i * 0.6, 0.45, -0.34, 0.16, 0.26);
    k.box(2.2, 0.06, 0.3, IRON_DARK, 0, 0.45, -0.1);
    for (const x of [-1.0, 0, 1.0]) k.cyl(0.03, 0.03, 0.45, 4, IRON_DARK, x, 0, -0.1);
    k.team(k.box(2.2, 0.04, 0.06, TEAM, 0, 0.52, -0.1));
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
  if (e === 4) {
    // A cavalry depot: a brick hall under a pitched slate roof with a loft hoist and iron stall rails.
    k.box(2.7, 0.9, 1.3, st.wall, 0, 0, -0.65);
    k.box(2.76, 0.08, 1.36, st.trim, 0, 0.9, -0.65);
    k.prism(2.85, 0.6, 1.6, st.roof, 0, 0.98, -0.55);
    k.box(0.5, 0.5, 0.3, st.wall, 0.9, 1.0, -0.2);
    k.cyl(0.03, 0.03, 0.5, 4, IRON_DARK, 0.9, 1.3, 0.1).rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const x = -1.0 + i * 0.66;
      k.box(0.5, 0.55, 0.03, '#2b2b2e', x, 0, 0.01);
      k.box(0.5, 0.05, 0.05, IRON_DARK, x, 0.55, 0.03);
    }
    for (let i = 0; i < 3; i++) k.box(0.32, 0.22, 0.24, HAY, -1.1 + i * 0.36, 0, 0.7);
    k.box(0.7, 0.16, 0.22, IRON_DARK, 0.7, 0, 0.75);
    k.box(0.62, 0.02, 0.16, '#5aa0c8', 0.7, 0.15, 0.75);
    k.team(k.box(2.88, 0.06, 0.06, TEAM, 0, 0.92, 0.27));
    banner(k, 1.3, 0, 1.25, 1.2);
    return;
  }
  if (e === 0) {
    // A horse corral: a rail fence round a trampled yard, a hide lean-to at the back, a horsetail totem at the gate.
    for (let i = 0; i < 9; i++) {
      const t = -1.3 + i * 0.325;
      k.cyl(0.05, 0.06, 0.55, 5, st.post, t, 0, 1.3);
      if (i % 4 === 0) {
        k.cyl(0.05, 0.06, 0.55, 5, st.post, -1.3, 0, t);
        k.cyl(0.05, 0.06, 0.55, 5, st.post, 1.3, 0, t);
      }
    }
    for (const y of [0.22, 0.42]) {
      k.box(2.6, 0.04, 0.04, st.post, 0, y, 1.3);
      k.box(0.04, 0.04, 2.6, st.post, -1.3, y, 0);
      k.box(0.04, 0.04, 2.6, st.post, 1.3, y, 0);
    }
    for (const x of [-1.1, 1.1]) k.cyl(0.05, 0.06, 0.8, 5, st.post, x, 0, -1.1);
    k.prism(2.5, 0.5, 1.0, st.roof, 0, 0.8, -0.95);
    k.box(2.3, 0.04, 0.6, st.wall2, 0, 0.0, -1.0);
    for (let i = 0; i < 3; i++) k.box(0.34, 0.2, 0.26, HAY, -0.9 + i * 0.4, 0, -0.5);
    k.box(0.6, 0.14, 0.2, WOOD, 0.8, 0, 0.1);
    k.box(0.52, 0.02, 0.14, '#5aa0c8', 0.8, 0.13, 0.1);
    k.cyl(0.03, 0.03, 1.1, 5, st.post, -1.3, 0, 1.3);
    k.team(k.cone(0.12, 0.34, 6, TEAM, -1.3, 1.05, 1.3));
    banner(k, 1.2, 0, 1.2, 1.1);
    return;
  }
  if (e === 1) {
    // Mudbrick stalls: a flat-roofed row with arched openings, a roof-beam fringe and a clay trough.
    k.box(2.7, 0.75, 1.3, st.wall, 0, 0, -0.65);
    k.box(2.8, 0.08, 1.4, st.trim, 0, 0.75, -0.65);
    // A gabled terracotta roof with a hay-loft door, so the stalls read as a long barn against the flat-topped halls.
    k.prism(2.8, 0.55, 1.4, st.roof, 0, 0.83, -0.65);
    k.box(0.34, 0.3, 0.03, '#3a2b20', 0, 1.02, 0.07);
    for (let i = 0; i < 6; i++) k.cyl(0.035, 0.035, 0.2, 5, st.post, -1.25 + i * 0.5, 0.68, 0.08).rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const x = -1.0 + i * 0.66;
      k.box(0.46, 0.4, 0.03, '#3a2b20', x, 0, 0.01);
      const arch = k.cyl(0.23, 0.23, 0.03, 10, '#3a2b20', x, 0.4, 0.01);
      arch.rotation.x = Math.PI / 2;
      arch.scale.set(1, 1, 0.5);
    }
    for (const x of [-1.3, 1.3]) k.box(0.2, 0.15, 0.2, st.wall2, x, 0.75, -1.1);
    for (let i = 0; i < 3; i++) k.box(0.32, 0.22, 0.24, HAY, -1.1 + i * 0.36, 0, 0.7);
    for (let i = 0; i < 3; i++) k.cyl(0.04, 0.04, 0.4, 5, st.post, 0.3 + i * 0.3, 0, 1.0);
    k.box(0.9, 0.04, 0.05, st.post, 0.6, 0.38, 1.0);
    k.box(0.7, 0.16, 0.22, st.wall2, 0.7, 0, 0.75);
    k.box(0.62, 0.02, 0.16, '#5aa0c8', 0.7, 0.15, 0.75);
    k.team(k.box(2.8, 0.06, 0.06, TEAM, 0, 0.77, 0.07));
    banner(k, 1.3, 0, 1.25, 1.2);
    return;
  }
  const wall = e >= 2 ? st.wall : st.wall2;
  k.box(2.7, 0.7, 1.3, wall, 0, 0, -0.65);
  if (e === 2) for (const x of [-1.3, -0.65, 0, 0.65, 1.3]) k.box(0.05, 0.7, 1.32, st.trim, x, 0, -0.65);
  if (e >= 3) k.box(2.76, 0.06, 1.36, st.trim, 0, 0.7, -0.65);
  if (e === 2) {
    k.box(0.45, 0.4, 0.35, st.wall, 0.9, 0.85, 0.0);
    k.prism(0.55, 0.25, 0.45, st.roof2, 0.9, 1.25, 0.0);
    k.box(0.28, 0.24, 0.04, '#3a2b20', 0.9, 0.93, 0.19);
    k.cyl(0.015, 0.015, 0.35, 4, IRON_DARK, 0, 1.28, -0.55);
    k.box(0.3, 0.1, 0.02, IRON_DARK, 0.1, 1.55, -0.55);
  }
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
  if (e === 4) {
    // An iron-framed lookout: a brick pier with a riveted lattice rising to a lamp gallery.
    k.box(1.3, 0.8, 1.3, STONE, 0, 0, 0);
    k.box(0.9, 1.0, 0.9, st.wall, 0, 0.8, 0);
    k.box(1.1, 0.08, 1.1, IRON_DARK, 0, 1.8, 0);
    for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) k.cyl(0.04, 0.05, 1.2, 5, IRON_DARK, x, 1.88, z);
    for (const y of [2.25, 2.7]) {
      k.box(0.88, 0.04, 0.04, IRON_DARK, 0, y, 0.42);
      k.box(0.88, 0.04, 0.04, IRON_DARK, 0, y, -0.42);
      k.box(0.04, 0.04, 0.88, IRON_DARK, 0.42, y, 0);
      k.box(0.04, 0.04, 0.88, IRON_DARK, -0.42, y, 0);
    }
    k.box(1.2, 0.08, 1.2, IRON_DARK, 0, 3.08, 0);
    k.cone(0.7, 0.4, 4, st.roof, 0, 3.16, 0).rotation.y = Math.PI / 4;
    k.glow(k.sphere(0.12, LIGHT, 0, 2.4, 0));
    for (const y of [1.0, 1.4]) window(k, st, 0, y, 0.46, 0.12, 0.2);
    k.team(k.box(0.92, 0.12, 0.92, TEAM, 0, 0.8, 0));
    banner(k, 0, 3.5, 0, 0.8, 0.8);
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

/**
 * The tower line (`TOWER_LEVELS`): what each step adds round any epoch's tower, so a raised tower reads at a glance.
 * Guard Tower: a timber gallery (hoarding) braced out from the shaft. Keep: a stone skirt and four corner buttresses.
 * Bastion: a low, wide, eight-sided gun platform with a cannon at each face.
 */
function towerLevel(k: Kit, level: number): void {
  if (level >= 1) {
    k.box(1.5, 0.26, 1.5, WOOD, 0, 1.22, 0);
    k.box(1.56, 0.05, 1.56, '#5e4128', 0, 1.48, 0);
    for (const [x, z] of [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]]) {
      const strut = k.box(0.06, 0.5, 0.06, '#5e4128', x * 0.85, 0.82, z * 0.85);
      strut.rotation.z = x > 0 ? -0.5 : 0.5;
    }
    k.team(k.box(1.52, 0.06, 1.52, TEAM, 0, 1.3, 0));
  }
  if (level >= 2) {
    k.box(1.6, 0.5, 1.6, STONE, 0, 0, 0);
    k.box(1.68, 0.06, 1.68, '#8f897f', 0, 0.5, 0);
    // Merlons along the skirt's edge, and a buttress at each corner.
    for (const t of [-0.5, -0.17, 0.17, 0.5]) for (const [x, z] of [[t, 0.76], [t, -0.76], [0.76, t], [-0.76, t]]) k.box(0.14, 0.16, 0.14, STONE, x, 0.56, z);
    for (const [x, z] of [[-0.74, -0.74], [0.74, -0.74], [-0.74, 0.74], [0.74, 0.74]]) k.box(0.3, 1.15, 0.3, STONE, x, 0, z);
  }
  if (level >= 3) {
    // Star-fort points: an angled bastion at each corner, a cannon in each looking out along the diagonal.
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      k.box(0.62, 0.42, 0.62, '#7d776d', x * 0.62, 0, z * 0.62).rotation.y = Math.PI / 4;
      k.box(0.66, 0.05, 0.66, '#a59f94', x * 0.62, 0.42, z * 0.62).rotation.y = Math.PI / 4;
      const gun = k.cyl(0.05, 0.07, 0.42, 6, IRON_DARK, x * 0.78, 0.55, z * 0.78);
      gun.rotation.order = 'YXZ';
      gun.rotation.set(Math.PI / 2, Math.atan2(x, z), 0);
    }
  }
}

// ---- Forge -----------------------------------------------------------------------------------------

function anvil(k: Kit, x: number, z: number): void {
  k.box(0.12, 0.18, 0.12, '#4a3a2c', x, 0, z);
  k.box(0.26, 0.08, 0.12, IRON_DARK, x, 0.18, z);
  k.cone(0.05, 0.1, 4, IRON_DARK, x + 0.16, 0.2, z).rotation.z = -Math.PI / 2;
}

function forge(k: Kit, e: number, st: Style): void {
  pad(k, 3, st.base);
  if (e === 4) {
    // A foundry: a brick hall under a sawtooth roof, a banded cupola furnace, a steam hammer and cooling ingots.
    k.box(2.4, 1.0, 1.3, st.wall, -0.2, 0, -0.6);
    for (const x of [-1.2, -0.6, 0, 0.6, 1.0]) k.box(0.06, 1.0, 1.34, st.trim, x, 0, -0.6);
    k.box(2.46, 0.07, 1.36, st.trim, -0.2, 1.0, -0.6);
    for (let i = 0; i < 3; i++) {
      k.prism(0.8, 0.45, 1.3, st.roof, -0.9 + i * 0.8, 1.07, -0.6);
      k.glow(k.box(0.5, 0.2, 0.03, '#ffb25a', -0.9 + i * 0.8, 1.12, -0.05));
    }
    // The cupola furnace: a riveted iron drum on a brick base with a tall stack.
    k.box(0.7, 0.5, 0.7, st.wall, 1.15, 0, 0.05);
    k.cyl(0.26, 0.3, 1.5, 10, IRON_DARK, 1.15, 0.5, 0.05);
    for (const y of [0.8, 1.2, 1.7]) k.cyl(0.31, 0.31, 0.05, 10, '#2b2b2e', 1.15, y, 0.05);
    k.cyl(0.14, 0.2, 0.7, 8, IRON_DARK, 1.15, 2.0, 0.05);
    k.glow(k.box(0.3, 0.14, 0.04, '#ff7a2a', 1.15, 0.18, 0.42));
    k.glow(k.sphere(0.1, '#ff9a3c', 1.15, 2.72, 0.05));
    // A steam hammer: two iron uprights, a crosshead and a falling head over an anvil block.
    for (const x of [-0.12, 0.28]) k.box(0.07, 1.0, 0.07, IRON_DARK, x, 0, 0.85);
    k.box(0.5, 0.1, 0.12, IRON_DARK, 0.08, 1.0, 0.85);
    k.cyl(0.05, 0.05, 0.4, 6, '#c8ccd0', 0.08, 0.45, 0.85);
    k.box(0.2, 0.14, 0.16, IRON_DARK, 0.08, 0.31, 0.85);
    k.box(0.4, 0.2, 0.3, '#3a3a3e', 0.08, 0, 0.85);
    // Ingots cooling on a rack, and a coal heap.
    for (let i = 0; i < 4; i++) k.box(0.34, 0.06, 0.1, i < 2 ? '#d8d0c0' : '#c8ccd0', -1.05, 0.06 + (i % 2) * 0.07, 0.62 + (i >> 1) * 0.14);
    k.cone(0.3, 0.25, 6, '#2a2a2e', -0.55, 0, 0.9);
    k.box(0.36, 0.55, 0.04, '#3a2b20', -0.2, 0, 0.06);
    window(k, st, -0.8, 0.5, 0.06);
    k.team(k.box(2.46, 0.08, 0.04, TEAM, -0.2, 0.88, 0.08));
    banner(k, -1.3, 0, 1.3, 1.2);
    return;
  }
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
  if (e === 4) {
    // An engineering shed: iron columns and a glazed roof, a gantry crane and a gun on the stocks.
    for (const x of [-1.25, -0.4, 0.45, 1.25]) for (const z of [-1.2, 0.1]) k.cyl(0.06, 0.08, 1.3, 6, IRON_DARK, x, 0, z);
    k.box(2.6, 1.0, 0.08, st.wall, 0, 0, -1.25);
    k.prism(2.8, 0.5, 1.7, st.roof, 0, 1.3, -0.55);
    k.glow(k.box(2.2, 0.06, 0.5, '#bfe3ea', 0, 1.62, -0.55));
    // The gun on its carriage: a barrel on cheeks and iron-shod wheels.
    for (const z of [-0.95, -0.15]) k.cyl(0.2, 0.2, 0.06, 10, IRON_DARK, -0.3, 0.2, z).rotation.x = Math.PI / 2;
    k.box(0.9, 0.12, 0.6, WOOD, -0.3, 0.25, -0.55);
    k.cyl(0.1, 0.13, 1.1, 8, IRON_DARK, -0.3, 0.45, -0.55).rotation.z = Math.PI / 2 - 0.15;
    // A gantry crane over the yard, running on rails, with a hook and a shell.
    for (const x of [-1.4, 1.4]) k.box(0.08, 1.5, 0.08, IRON_DARK, x, 0, 0.85);
    k.box(2.9, 0.1, 0.12, IRON_DARK, 0, 1.5, 0.85);
    k.cyl(0.006, 0.006, 0.7, 3, '#d8d0b8', 0.5, 0.8, 0.85);
    k.sphere(0.12, '#2b2b2e', 0.5, 0.68, 0.85);
    // Stacked shot, a boiler with its stack, and a steam-pipe run.
    for (const [x, y] of [[-0.9, 0], [-0.75, 0], [-0.83, 0.12]]) k.sphere(0.07, '#2b2b2e', x, y + 0.07, 1.0);
    k.cyl(0.2, 0.2, 0.6, 10, '#6b6258', 0.9, 0.12, 0.55).rotation.z = Math.PI / 2;
    k.team(k.box(2.82, 0.06, 0.06, TEAM, 0, 1.08, 0.2));
    banner(k, 1.3, 0, 1.3, 1.3);
    return;
  }
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
  if (e === 4) {
    // A cathedral of the machine age: a long brick nave with buttresses and a rose window, a clock tower under an iron-ribbed spire.
    k.box(1.5, 1.3, 2.5, st.wall, 0.35, 0, -0.1);
    k.box(1.56, 0.08, 2.56, st.trim, 0.35, 1.3, -0.1);
    k.prism(2.6, 0.85, 1.65, st.roof, 0.35, 1.38, -0.1).rotation.y = Math.PI / 2;
    for (const z of [-1.0, -0.3, 0.4]) for (const x of [-0.5, 1.2]) {
      k.box(0.14, 1.1, 0.2, st.trim, x, 0, z);
      k.box(0.1, 0.2, 0.14, st.trim, x, 1.1, z);
    }
    for (const z of [-1.0, -0.3, 0.4]) window(k, st, 1.11, 0.6, z, 0.12, 0.5, true, true);
    k.cyl(0.3, 0.3, 0.05, 14, '#e8e0cc', 0.35, 0.95, 1.16).rotation.x = Math.PI / 2;
    k.glow(k.cyl(0.22, 0.22, 0.06, 14, '#d86a5a', 0.35, 0.95, 1.17)).rotation.x = Math.PI / 2;
    k.box(0.4, 0.7, 0.04, '#3a2b20', 0.35, 0, 1.17);
    k.prism(0.5, 0.3, 0.1, st.trim, 0.35, 0.7, 1.19);
    // The clock tower and its iron spire.
    k.box(0.85, 2.3, 0.85, st.wall, -0.95, 0, 0.55);
    k.box(0.92, 0.08, 0.92, st.trim, -0.95, 2.3, 0.55);
    k.cyl(0.24, 0.24, 0.04, 14, '#f2ead8', -0.95, 1.8, 1.0).rotation.x = Math.PI / 2;
    k.glow(k.cyl(0.04, 0.04, 0.05, 6, '#ffd890', -0.95, 1.8, 1.03)).rotation.x = Math.PI / 2;
    k.cone(0.5, 1.5, 4, IRON_DARK, -0.95, 2.38, 0.55).rotation.y = Math.PI / 4;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.05, 0.4, 0.05, IRON_DARK, -0.95 + dx * 0.4, 2.38, 0.55 + dz * 0.4);
    k.box(0.04, 0.45, 0.04, '#e2b23c', -0.95, 3.85, 0.55);
    k.box(0.22, 0.04, 0.04, '#e2b23c', -0.95, 4.1, 0.55);
    k.team(k.box(0.9, 0.12, 0.9, TEAM, -0.95, 0.9, 0.55));
    banner(k, 1.35, 0, 1.35, 1.3);
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
  if (e === 4) {
    // An iron-and-glass arcade: slender cast columns carry a barrel-vaulted glass roof, with a clock at the gable and gas lamps by the stalls.
    for (const x of [-1.25, -0.4, 0.45, 1.25]) for (const z of [-1.3, -0.2]) k.cyl(0.05, 0.07, 1.2, 6, IRON_DARK, x, 0, z);
    k.box(2.7, 0.08, 1.3, st.trim, 0, 1.2, -0.75);
    k.box(2.6, 0.9, 0.08, st.wall, 0, 0, -1.3);
    k.prism(2.8, 0.55, 1.5, '#9fc4cc', 0, 1.28, -0.75);
    k.glow(k.prism(2.4, 0.3, 1.1, '#cfe8ee', 0, 1.34, -0.75));
    for (let i = 0; i < 5; i++) k.box(0.04, 0.5, 1.52, IRON_DARK, -1.2 + i * 0.6, 1.3, -0.75);
    k.box(0.5, 0.5, 0.4, '#8a6440', -0.7, 0, -1.0);
    k.box(0.4, 0.34, 0.3, '#a07a50', 0.6, 0, -1.0);
    k.cyl(0.2, 0.2, 0.05, 12, '#f2ead8', 0, 1.62, -0.0).rotation.x = Math.PI / 2;
    k.glow(k.cyl(0.03, 0.03, 0.06, 6, '#ffd890', 0, 1.62, 0.03)).rotation.x = Math.PI / 2;
    for (const x of [-1.5, 1.5]) {
      k.cyl(0.02, 0.03, 0.9, 5, IRON_DARK, x, 0, 0.3);
      k.glow(k.sphere(0.07, '#ffd890', x, 0.95, 0.3));
    }
    k.team(k.box(2.7, 0.08, 0.06, TEAM, 0, 1.12, -0.12));
  } else   if (e >= 2) {
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
  if (e === 3 && !straight) {
    // Gunpowder: a squat round bastion with a cannon port, in place of a square post.
    k.cyl(0.36, 0.42, ph, 10, c, 0, 0, 0);
    k.cyl(0.4, 0.4, 0.07, 10, '#8f897f', 0, ph, 0);
    k.box(0.14, 0.12, 0.2, '#2b2b2e', 0, ph - 0.4, 0.34);
    k.team(k.cyl(0.37, 0.37, 0.1, 10, TEAM, 0, ph - 0.7, 0));
  } else if (e === 4 && !straight) {
    // Industrial: a brick pier with a cast-iron lamp.
    k.box(post, ph, post, st.wall, 0, 0, 0);
    k.box(post + 0.08, 0.08, post + 0.08, st.wall2, 0, ph, 0);
    lamp(k, 0, ph + 0.08, 0, 0.45);
    k.team(k.box(post + 0.02, 0.1, post + 0.02, TEAM, 0, ph - 0.3, 0));
  } else k.box(post, ph, post, c, 0, 0, 0);
  if (e < 3 || straight) k.box(post + 0.06, 0.06, post + 0.06, e === 1 ? st.trim : '#8f897f', 0, ph, 0);
  if (!straight && e < 3) {
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.14, 0.16, 0.14, c, x * (post / 2 - 0.07), ph + 0.06, z * (post / 2 - 0.07));
    k.team(k.box(post + 0.02, 0.1, post + 0.02, TEAM, 0, ph - 0.3, 0));
  }
  for (const [bit, dx, dz] of ARMS) {
    if (!(mask & bit)) continue;
    const w = Math.abs(dx) * 0.5 + Math.abs(dz) * 0.44;
    const d = Math.abs(dz) * 0.5 + Math.abs(dx) * 0.44;
    if (e === 3) {
      // A sloped rampart: broad battered foot, a low parapet with gun embrasures instead of merlons.
      k.box(w, top * 0.5, d + 0.18, c, dx * 0.25, 0, dz * 0.25);
      k.box(w, top * 0.5, d, c, dx * 0.25, top * 0.5, dz * 0.25);
      k.box(dx ? 0.5 : 0.08, 0.12, dz ? 0.5 : 0.08, '#8f897f', dx * 0.25 + (dz ? 0.17 : 0), top, dz * 0.25 + (dx ? 0.17 : 0));
      k.box(dx ? 0.5 : 0.08, 0.12, dz ? 0.5 : 0.08, '#8f897f', dx * 0.25 - (dz ? 0.17 : 0), top, dz * 0.25 - (dx ? 0.17 : 0));
      continue;
    }
    if (e === 4) {
      // A low brick wall topped with iron railings.
      k.box(w, top * 0.55, d, st.wall, dx * 0.25, 0, dz * 0.25);
      k.box(w, 0.06, d + 0.06, st.wall2, dx * 0.25, top * 0.55, dz * 0.25);
      for (let i = 1; i <= 3; i++) k.cyl(0.015, 0.015, 0.5, 4, '#2b2b2e', dx * (i * 0.125), top * 0.6, dz * (i * 0.125));
      k.box(dx ? 0.5 : 0.02, 0.025, dz ? 0.5 : 0.02, '#2b2b2e', dx * 0.25, top * 0.6 + 0.4, dz * 0.25);
      continue;
    }
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

/**
 * A dyke (#701): a bank of earth rising out of the water, faced with stone at the water line, turfed, with a path along its crown that
 * runs on to the neighbouring dykes (`mask`, as a wall's). Drawn from well below the water so it stands up out of any depth.
 */
function dyke(k: Kit, mask: number): void {
  const EARTH = '#6e5a3e';
  const TURF = '#6f8a45';
  // The bank, battered: broad below, narrower toward the crown.
  k.box(1.02, 0.95, 1.02, EARTH, 0, -0.95, 0);
  k.box(1.0, 0.16, 1.0, '#8d877b', 0, -0.13, 0);
  for (let i = 0; i < 6; i++) k.rock(0.07 + rnd(i, mask, 5) * 0.04, '#9d978d', -0.42 + i * 0.17, 0.0, (i % 2 ? 1 : -1) * 0.46);
  k.box(0.9, 0.16, 0.9, EARTH, 0, 0.03, 0);
  k.box(0.72, 0.12, 0.72, TURF, 0, 0.19, 0);
  // The crown path, out along each arm that meets another dyke (or a stub where it meets none).
  k.box(0.26, 0.03, 0.26, '#c8b88e', 0, 0.31, 0);
  for (const [bit, dx, dz] of ARMS) {
    if (!(mask & bit)) continue;
    k.box(Math.abs(dx) * 0.5 + Math.abs(dz) * 0.72, 0.12, Math.abs(dz) * 0.5 + Math.abs(dx) * 0.72, TURF, dx * 0.25, 0.19, dz * 0.25);
    k.box(Math.abs(dx) * 0.5 + 0.02 + Math.abs(dz) * 0.24, 0.03, Math.abs(dz) * 0.5 + 0.02 + Math.abs(dx) * 0.24, '#c8b88e', dx * 0.25, 0.31, dz * 0.25);
  }
  // A stone crown post and the owner's colour on it.
  k.box(0.12, 0.18, 0.12, STONE, 0.28, 0.31, 0.28);
  k.team(k.box(0.13, 0.05, 0.13, TEAM, 0.28, 0.44, 0.28));
}

/** A Bloom Hearth (#727, the Iron Age): a squat clay furnace with a glowing mouth, bellows, a slag heap and a rack of grey bars. */
function stockade(k: Kit, _e: number, st: Style): void {
  pad(k, 2, st.base);
  // Its own silhouette, whatever the age it is kept in: a ring of sharpened stakes, a gate arch of crossed spears with a skull
  // lintel, trophy poles hung with pelts, and a heap of loot under a blood-red hide. The colours are the war-host's, not the town's.
  const POST = '#5a3d28';
  const BONE = '#e6dcc4';
  const BLOOD = '#8a2420';
  for (let i = 0; i < 10; i++) {
    const a = -1.0 + i * 0.222;
    if (i === 4 || i === 5) continue;
    k.cone(0.07, 0.95 + (i % 3) * 0.14, 5, POST, a, 0, 0.9);
    k.cone(0.07, 0.95 + (i % 3) * 0.14, 5, POST, a, 0, -0.9);
  }
  for (let i = 0; i < 7; i++) {
    const z = -0.7 + i * 0.24;
    k.cone(0.07, 0.9 + (i % 3) * 0.14, 5, POST, -1.0, 0, z);
    k.cone(0.07, 0.9 + (i % 3) * 0.14, 5, POST, 1.0, 0, z);
  }
  // The gate: two tall posts, crossed spears above and a skull on the lintel.
  for (const x of [-0.22, 0.22]) k.cyl(0.06, 0.07, 1.5, 6, POST, x, 0, 0.9);
  k.box(0.6, 0.07, 0.07, POST, 0, 1.3, 0.9);
  for (const r of [-0.5, 0.5]) k.cone(0.05, 0.9, 4, '#c8ccd0', 0, 1.3, 0.9).rotation.z = r;
  k.sphere(0.1, BONE, 0, 1.45, 0.95);
  // Trophy poles at the front corners, a pelt hung from each.
  for (const x of [-0.95, 0.95]) {
    k.cyl(0.04, 0.04, 1.6, 5, POST, x, 0, 0.95);
    k.box(0.3, 0.4, 0.04, BLOOD, x + (x < 0 ? 0.17 : -0.17), 1.05, 0.95);
    k.sphere(0.08, BONE, x, 1.65, 0.95);
  }
  // A lookout platform behind and the loot under a hide.
  k.box(0.7, 0.07, 0.7, '#7a5a3a', 0.35, 1.25, -0.4);
  for (const [x, z] of [[0, -0.7], [0.7, -0.7], [0, -0.1], [0.7, -0.1]]) k.cyl(0.04, 0.04, 1.25, 5, POST, x, 0, z);
  k.box(0.44, 0.3, 0.36, '#7a5c3a', -0.45, 0.02, 0.0);
  k.box(0.5, 0.16, 0.42, BLOOD, -0.45, 0.32, 0.0).rotation.z = 0.12;
  k.sphere(0.12, '#e0b030', -0.6, 0.36, 0.25);
  k.team(k.box(0.5, 0.18, 0.04, TEAM, 0.35, 1.5, -0.4));
}

/** A Mine Gallery (#727, the Age of Sappers): a timbered shaft mouth in a spoil heap, a windlass over it, a cart of spoil and a powder keg. */
function gallery(k: Kit, _e: number, st: Style): void {
  pad(k, 2, st.base);
  const SPOIL = '#7d6a52';
  const TIMBER = '#5a3d28';
  const KEG = '#6a4a2c';
  // The spoil heap: stacked earth mounds round a dark pit, a ring of low humps.
  for (let i = 0; i < 8; i++) {
    const a = i * 0.785;
    k.cone(0.34, 0.5 + (i % 3) * 0.1, 6, SPOIL, Math.cos(a) * 0.78, 0, Math.sin(a) * 0.78);
  }
  k.cyl(0.42, 0.42, 0.05, 10, '#17120e', 0, 0.02, 0);
  // The shoring: a timber frame round the shaft mouth with a cross-beam, and a sloped ramp of planks down into it.
  for (const x of [-0.42, 0.42]) k.box(0.1, 0.9, 0.1, TIMBER, x, 0, 0.05);
  k.box(1.0, 0.1, 0.12, TIMBER, 0, 0.9, 0.05);
  k.box(0.7, 0.05, 0.5, '#7a5a3a', 0, 0.05, 0.62).rotation.x = -0.25;
  // A windlass: two uprights, a spindle, a rope and a bucket down the shaft.
  for (const z of [-0.2, 0.3]) k.box(0.07, 1.3, 0.07, TIMBER, 0.95, 0, z);
  k.cyl(0.07, 0.07, 0.6, 6, '#3a2a1c', 0.95, 1.15, 0.05).rotation.x = Math.PI / 2;
  k.cyl(0.015, 0.015, 0.9, 4, '#c9b48a', 0.7, 0.7, 0.05).rotation.z = 0.9;
  // A cart of spoil, and a keg waiting by the mouth with a fuse stub.
  k.box(0.5, 0.25, 0.36, TIMBER, -0.95, 0.18, 0.55);
  k.box(0.46, 0.12, 0.32, SPOIL, -0.95, 0.43, 0.55);
  for (const z of [0.36, 0.74]) k.cyl(0.14, 0.14, 0.05, 8, '#2a2018', -0.95, 0.14, z).rotation.x = Math.PI / 2;
  k.cyl(0.16, 0.16, 0.34, 8, KEG, -0.15, 0, 0.9);
  k.box(0.34, 0.03, 0.03, '#c0b8a0', -0.15, 0.2, 0.9);
  k.cyl(0.015, 0.015, 0.16, 4, '#e8c860', -0.15, 0.34, 0.9);
  k.team(k.box(0.5, 0.18, 0.04, TEAM, 0.95, 1.55, 0.05));
}

/** A Horsetail Standard (#727, the Age of the Horde): a tall pole on a cairn, a crossbar hung with a fringe of horse-tails and a team pennant under a gilt crescent. */
function standard(k: Kit, _e: number, _st: Style): void {
  const POLE = '#5a3d28';
  const TAIL = ['#e8e2d2', '#3a2a22', '#c9a35c', '#7a4a2a'];
  // The cairn: a ring of fieldstones banked round the foot of the pole, and a felt mat laid before it.
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    k.sphere(0.12 + (i % 2) * 0.03, i % 2 ? '#8d887c' : '#76726a', Math.cos(a) * 0.3, 0.06, Math.sin(a) * 0.3);
  }
  k.cyl(0.06, 0.08, 2.0, 6, POLE, 0, 0, 0);
  // The crossbar and its fringe of tails, hanging in a row and shorter toward the ends.
  k.box(0.7, 0.05, 0.05, POLE, 0, 1.75, 0);
  for (let i = 0; i < 5; i++) {
    const x = -0.3 + i * 0.15;
    k.cone(0.06, 0.45 - Math.abs(i - 2) * 0.07, 5, TAIL[i % 4], x, 1.3 + Math.abs(i - 2) * 0.07, 0.04).rotation.x = Math.PI;
  }
  // The finial: a gilt disc and a crescent over it, and a pennant of the team's colour streaming from the pole.
  k.cyl(0.1, 0.1, 0.03, 10, '#e2b23c', 0, 2.02, 0).rotation.x = Math.PI / 2;
  k.ring(0.13, 0.02, '#e2b23c', 2.2).rotation.x = 0;
  k.cloth(k.team(k.box(0.012, 0.26, 0.5, TEAM, 0, 1.45, 0.3)), 0.5, 0.05);
  // Tethered horses' tack: a hitching rope and two stakes at the foot.
  for (const x of [-0.42, 0.42]) k.cyl(0.02, 0.025, 0.28, 4, POLE, x, 0, 0.35);
  k.box(0.84, 0.015, 0.015, '#c9b48a', 0, 0.2, 0.35);
}

/** A Raiders' Strand (#727, the Age of Sea-Raiders): a longship hauled up on rollers, its dragon prow high, a striped sail slung over it as a tent and a row of round shields along the gunwale. */
function strand(k: Kit, _e: number, _st: Style): void {
  const PLANK = '#7a5a3a';
  const DARK = '#4a3322';
  const SAIL = ['#d8cfb4', '#9a2a24'];
  // Sand and trampled turf where the keel rests, and the rollers it was hauled up on.
  k.cyl(1.05, 1.15, 0.05, 12, '#c8b58a', 0, 0, 0);
  for (const x of [-0.5, 0, 0.5]) k.cyl(0.07, 0.07, 1.1, 6, DARK, x, 0.05, 0).rotation.x = Math.PI / 2;
  // The hull, a keel of planks that rise toward bow and stern: nine ribs along the length, the middle lowest.
  for (let i = 0; i < 9; i++) {
    const x = -0.96 + i * 0.24;
    const rise = ((i - 4) * (i - 4)) / 16 * 0.55;
    k.box(0.26, 0.2 + rise, 0.62 - Math.abs(i - 4) * 0.045, i % 2 ? PLANK : '#8a6a46', x, 0.12, 0);
  }
  // Stem and stern posts curl up; the bow carries a carved head with a gilt eye.
  k.cyl(0.05, 0.07, 0.8, 5, DARK, -1.1, 0.6, 0).rotation.z = -0.35;
  k.cyl(0.05, 0.07, 0.7, 5, DARK, 1.1, 0.6, 0).rotation.z = 0.35;
  k.sphere(0.12, PLANK, -1.25, 1.05, 0);
  k.cone(0.06, 0.2, 4, PLANK, -1.38, 1.02, 0).rotation.z = Math.PI / 2;
  k.sphere(0.03, '#e2b23c', -1.3, 1.1, 0.07);
  k.sphere(0.03, '#e2b23c', -1.3, 1.1, -0.07);
  // A row of round shields hung along the gunwale, alternating red and cream.
  for (let i = 0; i < 6; i++) {
    const x = -0.6 + i * 0.24;
    k.cyl(0.11, 0.11, 0.03, 8, i % 2 ? '#9a2a24' : '#e6dcc4', x, 0.5, 0.33).rotation.x = Math.PI / 2;
  }
  // The sail is slung over a ridge pole as a tent, striped, with the team's colour on its gable.
  k.cyl(0.04, 0.04, 1.6, 5, DARK, 0, 0.9, 0).rotation.z = Math.PI / 2;
  for (const x of [-0.8, 0.8]) k.cyl(0.04, 0.05, 0.8, 5, DARK, x, 0.4, 0);
  for (let i = 0; i < 4; i++) k.prism(0.4, 0.5, 0.86, SAIL[i % 2], -0.6 + i * 0.4, 0.7, 0);
  k.team(k.box(0.04, 0.22, 0.4, TEAM, 0.85, 0.7, 0));
  // A cookfire and a pile of loot on the sand before it.
  k.cyl(0.14, 0.16, 0.06, 6, '#5a5650', 0.5, 0, 0.75);
  k.cone(0.09, 0.22, 5, '#e08a30', 0.5, 0.05, 0.75);
  k.box(0.3, 0.2, 0.22, '#8a6a46', -0.45, 0, 0.8);
  k.sphere(0.09, '#e0b030', -0.4, 0.22, 0.8);
}

/** A Wheelwright's Yard (#727, the Age of Chariots): a trampled yard with a wheel-rack, a chariot on trestles with a wheel off, spare spokes leaning on a post, a harness pole and an iron-tyre pile. */
function wheelyard(k: Kit, _e: number, st: Style): void {
  const WOOD = '#8a6a46';
  const DARK = '#4a3322';
  const IRON = '#4a4e56';
  pad(k, 2, st.base);
  // A wheel stands upright by its rim: spokes, a hub and an iron tyre.
  const wheel = (x: number, y: number, z: number, r: number): void => {
    k.cyl(r, r, 0.07, 14, IRON, x, y, z).rotation.x = Math.PI / 2;
    k.cyl(r * 0.82, r * 0.82, 0.09, 14, WOOD, x, y, z).rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const b = k.box(r * 1.9, 0.05, 0.1, DARK, x, y, z);
      b.rotation.z = (i * Math.PI) / 3;
    }
    k.cyl(0.08, 0.08, 0.14, 6, DARK, x, y, z).rotation.x = Math.PI / 2;
  };
  // The chariot on trestles: a floor, a curved front rail, a pole, one wheel on and one off.
  for (const x of [-0.45, 0.2]) k.box(0.06, 0.34, 0.5, DARK, x, 0.05, -0.1);
  k.box(0.7, 0.07, 0.46, WOOD, -0.12, 0.39, -0.1);
  k.box(0.7, 0.18, 0.04, WOOD, -0.12, 0.46, -0.32);
  k.box(0.05, 0.18, 0.46, WOOD, 0.22, 0.46, -0.1);
  k.box(0.9, 0.05, 0.05, DARK, 0.78, 0.4, -0.1);
  k.team(k.box(0.05, 0.2, 0.24, TEAM, -0.46, 0.46, -0.1));
  wheel(-0.12, 0.34, -0.4, 0.3);
  // The off wheel leans on the rack; a rack of three spare wheels stands on edge behind.
  for (let i = 0; i < 3; i++) wheel(-0.6 + i * 0.32, 0.3, 0.62, 0.26);
  k.box(1.1, 0.06, 0.06, DARK, -0.3, 0.6, 0.78);
  // Spare spokes and axles stacked beside it, a post with harness straps, and a stack of iron tyres.
  for (let i = 0; i < 4; i++) k.box(0.6, 0.05, 0.05, WOOD, 0.62, 0.05 + i * 0.06, 0.55 + (i % 2) * 0.04);
  k.cyl(0.04, 0.05, 0.9, 5, DARK, 0.9, 0.05, -0.55);
  k.box(0.04, 0.3, 0.03, '#c9a23c', 0.9, 0.5, -0.5);
  k.cyl(0.2, 0.2, 0.06, 10, IRON, 0.7, 0.05, -0.3);
  k.cyl(0.2, 0.2, 0.06, 10, IRON, 0.7, 0.11, -0.3);
}

/** A Pharos (#727, the Age of Sail): a tall banded tower on a rocky headland, a railed gallery under a fire basket, a keeper's hut, a coil of rope and an anchor. */
function pharos(k: Kit, _e: number, st: Style): void {
  const STONE = '#c9c2b0';
  const BAND = '#a8403a';
  const DARK = '#4a3322';
  pad(k, 2, st.base);
  // Rocks about the foot.
  for (const [x, z, r] of [[-0.7, 0.5, 0.26], [0.65, 0.6, 0.2], [0.75, -0.4, 0.24], [-0.6, -0.65, 0.2]]) k.sphere(r, '#7d7a72', x, 0.05, z);
  // The tower tapers in three drums, the middle one banded red.
  k.cyl(0.52, 0.64, 1.0, 10, STONE, 0, 0, 0);
  k.cyl(0.42, 0.52, 0.9, 10, BAND, 0, 1.0, 0);
  k.cyl(0.34, 0.42, 0.8, 10, STONE, 0, 1.9, 0);
  // The gallery: a wide deck with a rail, and the lantern room above it.
  k.cyl(0.5, 0.42, 0.08, 10, DARK, 0, 2.7, 0);
  k.ring(0.5, 0.025, DARK, 2.9);
  k.cyl(0.26, 0.28, 0.4, 8, '#8fb8c8', 0, 2.78, 0);
  k.cone(0.34, 0.3, 8, BAND, 0, 3.18, 0);
  // The fire basket blazes on top, with the team's pennant above it.
  k.cone(0.12, 0.3, 5, '#e8902c', 0, 3.4, 0);
  k.cone(0.07, 0.2, 5, '#f4d060', 0, 3.42, 0);
  k.cyl(0.015, 0.015, 0.5, 4, DARK, 0.1, 3.4, 0);
  k.team(k.box(0.28, 0.14, 0.02, TEAM, 0.24, 3.78, 0));
  // The keeper's hut, a coil of rope, and an anchor leaning on the wall.
  k.box(0.5, 0.35, 0.4, '#8a6a46', 0.7, 0, 0.1);
  k.prism(0.6, 0.22, 0.5, '#5a3a2a', 0.7, 0.35, 0.1);
  k.cyl(0.14, 0.14, 0.08, 8, '#b09060', -0.7, 0.05, 0.1);
  k.cyl(0.03, 0.03, 0.6, 5, '#4a4e56', -0.4, 0.05, 0.62);
  k.box(0.3, 0.04, 0.04, '#4a4e56', -0.4, 0.55, 0.62);
  k.box(0.04, 0.04, 0.2, '#4a4e56', -0.4, 0.05, 0.62);
}

/** A Wayside Chantry (#727, the Age of Pilgrims): a tall carved stone cross on stepped plinths, a bell frame, a travellers' shelter and votive lamps. */
function chantry(k: Kit, _e: number, st: Style): void {
  const STONE = '#c9c2b0';
  const DARK = '#4a3322';
  const GOLD = '#d4a93c';
  pad(k, 2, st.base);
  // Three steps of plinth, a tapering shaft, and a cross with a ring at the crossing: the silhouette from afar.
  k.box(1.1, 0.12, 1.1, '#9d9585', -0.2, 0, -0.1);
  k.box(0.8, 0.12, 0.8, '#b3ab9a', -0.2, 0.12, -0.1);
  k.box(0.5, 0.12, 0.5, STONE, -0.2, 0.24, -0.1);
  k.cyl(0.1, 0.16, 1.7, 6, STONE, -0.2, 0.36, -0.1);
  k.box(0.7, 0.14, 0.14, STONE, -0.2, 1.62, -0.1);
  k.box(0.14, 0.4, 0.14, STONE, -0.2, 2.06, -0.1);
  const halo = k.ring(0.24, 0.035, GOLD, 1.69);
  halo.rotation.x = 0;
  halo.position.set(-0.2, 1.69, -0.1);
  k.team(k.box(0.3, 0.14, 0.03, TEAM, 0.1, 2.1, -0.1));
  // A bell frame with its bell, to the right.
  k.box(0.07, 0.9, 0.07, DARK, 0.5, 0, -0.5);
  k.box(0.07, 0.9, 0.07, DARK, 0.9, 0, -0.5);
  k.box(0.52, 0.07, 0.09, DARK, 0.7, 0.9, -0.5);
  k.cone(0.13, 0.22, 8, GOLD, 0.7, 0.58, -0.5);
  // The travellers' shelter: open-fronted, thatched, with a bench.
  k.box(0.9, 0.5, 0.45, '#8a6a46', 0.1, 0, 0.7);
  k.prism(1.0, 0.3, 0.6, '#b0925a', 0.1, 0.5, 0.7);
  k.box(0.7, 0.07, 0.16, DARK, 0.1, 0.18, 0.48);
  // Votive lamps on the plinth: two small flames.
  for (const x of [-0.55, 0.15]) {
    k.cyl(0.05, 0.05, 0.12, 6, '#7d7a72', x, 0.24, 0.3);
    k.cone(0.04, 0.12, 5, '#f4d060', x, 0.36, 0.3);
  }
}

/** A Falconer's Mews (#727, the Age of the Wild Hunt): a low round mud kennel with a hide roof, a tall perch pole with a hawk on it, and a wattle yard with antlers on the post. */
function mews(k: Kit, _e: number, st: Style): void {
  const MUD = '#9a7b55';
  const HIDE = '#6b4a30';
  const DARK = '#3d2a1a';
  pad(k, 2, st.base);
  // The kennel: a squat round hut under a hide cone, with a dark doorway and a team flap.
  k.cyl(0.62, 0.7, 0.62, 10, MUD, -0.45, 0, -0.3);
  k.cone(0.84, 0.7, 10, HIDE, -0.45, 0.62, -0.3);
  k.box(0.28, 0.4, 0.06, DARK, -0.45, 0, 0.36);
  k.team(k.box(0.34, 0.12, 0.04, TEAM, -0.45, 0.46, 0.4));
  // The perch: a tall pole with a crossbar and a hawk with its wings half-spread on top: the silhouette from afar.
  k.cyl(0.05, 0.07, 2.3, 6, DARK, 0.65, 0, -0.45);
  k.box(0.7, 0.06, 0.06, DARK, 0.65, 1.85, -0.45);
  k.box(0.2, 0.2, 0.34, '#5a4630', 0.65, 2.3, -0.45);
  k.box(0.8, 0.05, 0.22, '#7a6040', 0.65, 2.42, -0.45);
  k.cone(0.07, 0.14, 5, '#d4a93c', 0.65, 2.5, -0.65);
  // The yard: a wattle fence of stakes along the front, one post hung with antlers.
  for (const x of [-0.2, 0.1, 0.4, 0.7, 1.0]) k.cyl(0.04, 0.04, 0.45, 5, HIDE, x, 0, 0.8);
  k.box(1.3, 0.05, 0.05, DARK, 0.4, 0.36, 0.8);
  k.cone(0.05, 0.35, 4, '#e0d6bd', 1.0, 0.45, 0.8);
  k.cone(0.05, 0.3, 4, '#e0d6bd', 0.85, 0.45, 0.8);
}

function bloomery(k: Kit, _e: number, st: Style): void {
  pad(k, 2, st.base);
  // The furnace stack: a clay drum that tapers to a smoking top, with a fire door and a team band.
  k.cyl(0.6, 0.72, 0.9, 8, '#8a5a3c', -0.15, 0, -0.1);
  k.cyl(0.36, 0.55, 0.9, 8, '#7a4c34', -0.15, 0.9, -0.1);
  k.ring(0.64, 0.025, '#4a3a30', 0.45);
  k.team(k.box(1.1, 0.07, 0.04, TEAM, -0.15, 0.62, 0.45));
  k.box(0.34, 0.3, 0.06, '#1c1410', -0.15, 0.12, 0.6);
  k.glow(k.box(0.24, 0.16, 0.04, '#ff8a2a', -0.15, 0.17, 0.64));
  k.glow(k.sphere(0.09, '#ff9a3c', -0.15, 1.88, -0.1));
  // Bellows: a hide bag on a frame, its nozzle at the furnace foot.
  k.box(0.5, 0.22, 0.3, '#5b4330', 0.7, 0.18, 0.2);
  k.box(0.46, 0.06, 0.26, '#7a5636', 0.7, 0.4, 0.2).rotation.z = -0.15;
  k.cyl(0.04, 0.04, 0.5, 5, IRON_DARK, 0.42, 0.22, 0.32).rotation.z = Math.PI / 2;
  // Slag heap and a rack of finished bars.
  k.cone(0.34, 0.3, 6, '#3a3a3e', -0.85, 0, 0.5);
  for (let i = 0; i < 4; i++) k.box(0.36, 0.06, 0.1, i < 2 ? '#c8ccd0' : '#d8d0c0', 0.65, 0.06 + (i % 2) * 0.07, -0.45 + (i >> 1) * 0.14);
  banner(k, 0.95, 0, -0.85, 1.2);
}

/** A Hire Hall (#727, the Merchants): a counting-house under an ochre roof with a muster yard: a ledger desk, a strongbox, a pay window, a rack of spears and a drilling post. */
function hirehall(k: Kit, _e: number, st: Style): void {
  pad(k, 2, st.base);
  // The hall: plastered walls, a tiled roof, a lit pay window and a door with a team lintel.
  k.box(1.5, 0.95, 1.0, st.wall, -0.3, 0, -0.55);
  k.box(1.6, 0.08, 1.1, st.trim, -0.3, 0.95, -0.55);
  k.prism(1.7, 0.55, 1.2, st.roof, -0.3, 1.03, -0.55);
  window(k, st, -0.75, 0.55, -0.04);
  k.glow(k.box(0.3, 0.22, 0.04, '#ffd890', -0.75, 0.42, -0.03));
  k.box(0.34, 0.6, 0.06, '#3a2b20', 0.05, 0, -0.04);
  k.team(k.box(0.46, 0.07, 0.07, TEAM, 0.05, 0.62, -0.02));
  // A strongbox bound in brass, with a stack of coin on the ledger desk.
  k.box(0.4, 0.28, 0.28, '#5b4330', 0.75, 0, -0.5);
  k.box(0.42, 0.05, 0.3, '#c9a24a', 0.75, 0.28, -0.5);
  k.cyl(0.07, 0.07, 0.16, 8, '#e2c060', 0.62, 0.3, -0.5);
  // The muster yard: a spear rack and a drilling post with a straw dummy.
  k.box(0.7, 0.05, 0.12, '#6b4b2f', 0.35, 0.55, 0.7);
  for (const x of [0.05, 0.2, 0.35, 0.5, 0.65]) k.cyl(0.015, 0.015, 0.9, 4, '#8a6a44', x, 0, 0.7).rotation.z = 0.06;
  k.cyl(0.05, 0.06, 0.8, 5, '#6b4b2f', -0.7, 0, 0.7);
  k.sphere(0.13, '#d8c9a0', -0.7, 0.9, 0.7);
  banner(k, 0.95, 0, 0.9, 1.2);
}

/**
 * A channel being dug (#701, the Age of Rivers): a raw trench of dark earth with the spoil heaped on its banks, running on toward the
 * neighbouring ditches and the water (`mask`, as a wall's), a spade left in the heap and a peg in the owner's colour. Once the water
 * runs in, the ditch is gone and the ground itself shows the channel.
 */
function channel(k: Kit, mask: number): void {
  const MUD = '#4a3826';
  const SPOIL = '#7a5f3e';
  // Which way it runs: along z when it meets something only north or south, else along x.
  const ns = !(mask & 5) && !!(mask & 10);
  k.box(ns ? 0.5 : 1.0, 0.04, ns ? 1.0 : 0.5, MUD, 0, -0.02, 0);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const t = -0.32 + i * 0.32;
      const r = 0.12 + rnd(i, mask + side * 7, 9) * 0.05;
      k.blob(r, SPOIL, ns ? side * 0.38 : t, 0.02, ns ? t : side * 0.38).scale.set(1.3, 0.55, 1.3);
    }
  }
  for (const [bit, dx, dz] of ARMS) if (mask & bit) k.box(Math.abs(dx) * 0.3 + Math.abs(dz) * 0.5, 0.04, Math.abs(dz) * 0.3 + Math.abs(dx) * 0.5, MUD, dx * 0.36, -0.02, dz * 0.36);
  // A spade in the spoil, and the owner's peg.
  k.cyl(0.018, 0.018, 0.5, 4, '#6b5232', 0.3, 0.05, 0.3).rotation.z = 0.25;
  k.box(0.12, 0.14, 0.02, '#8a8f96', 0.24, 0.04, 0.3);
  k.cyl(0.02, 0.02, 0.3, 4, '#5b4330', -0.34, 0, -0.34);
  k.team(k.box(0.08, 0.06, 0.04, TEAM, -0.34, 0.26, -0.34));
}

/**
 * A sluice (#701 s4): a dyke's bank cut through by a timber gate between stone piers, its leaf hung from a beam on a winch. Shut
 * (`variant` under 16) the leaf stands down in the water; open, it is wound up under the beam and the water pours white through the
 * gap. The bank runs on to the neighbouring dykes (`variant` & 15, as a wall's).
 */
function sluice(k: Kit, variant: number): void {
  const open = variant >= 16;
  const mask = variant & 15;
  const EARTH = '#6e5a3e';
  const TURF = '#6f8a45';
  const TIMBER = '#5b4330';
  // The bank and its arms, as a dyke's.
  k.box(1.02, 0.95, 1.02, EARTH, 0, -0.95, 0);
  for (const [bit, dx, dz] of ARMS) {
    if (!(mask & bit)) continue;
    k.box(Math.abs(dx) * 0.3 + Math.abs(dz) * 0.72, 0.12, Math.abs(dz) * 0.3 + Math.abs(dx) * 0.72, TURF, dx * 0.35, 0.19, dz * 0.35);
  }
  // Across the line the bank runs: the gate faces along x unless the dykes meet it from north or south.
  const ns = !(mask & 5) && !!(mask & 10);
  const g = k.group();
  if (ns) g.rotation.y = Math.PI / 2;
  // Two stone piers, a walkway beam between them, and the winch on top.
  for (const side of [-1, 1]) {
    k.box(0.3, 1.25, 0.6, STONE, side * 0.36, -0.35, 0, g);
    k.box(0.34, 0.06, 0.64, '#8d877b', side * 0.36, 0.3, 0, g);
    k.cyl(0.03, 0.03, 0.9, 4, TIMBER, side * 0.36, 0.33, 0.18, g);
  }
  k.box(1.0, 0.07, 0.14, TIMBER, 0, 0.78, 0.18, g);
  k.box(0.9, 0.05, 0.3, '#7a5636', 0, 0.3, -0.12, g);
  k.cyl(0.06, 0.06, 0.5, 6, TIMBER, 0, 0.88, 0.18, g).rotation.z = Math.PI / 2;
  for (const side of [-1, 1]) k.box(0.03, 0.22, 0.03, TIMBER, side * 0.27, 0.92, 0.26, g);
  // The leaf: planks on iron straps, down in the water or wound up under the beam.
  const up = open ? 0.62 : 0;
  k.box(0.44, 0.62, 0.06, '#6b4b2f', 0, -0.18 + up, 0.18, g);
  for (const y of [-0.38, -0.14, 0.1]) k.box(0.46, 0.04, 0.07, '#4a4d52', 0, y + up, 0.18, g);
  // Open: white water pouring through the gap and spreading below it.
  if (open) {
    k.box(0.42, 0.04, 0.7, '#e6f1f2', 0, -0.06, 0.05, g);
    k.box(0.6, 0.03, 0.3, '#cfe3e6', 0, -0.09, -0.42, g);
  }
  k.team(k.box(0.13, 0.08, 0.13, TEAM, 0.36, 0.38, -0.26, g));
}

/**
 * A swing bridge (#701 s5, the Age of Locks): a timber deck on iron girders over a canal, resting on a stone pier at each bank and
 * turning on a drum in the middle, with railings and a lamp post in the owner's colour. It spans toward the land (`variant`: which of the
 * four neighbours are land, as a wall's mask): along x unless the banks lie only north and south.
 */
function bridge(k: Kit, variant: number): void {
  const TIMBER = '#7a5636';
  const IRON = '#4a4d52';
  const g = k.group();
  if (!(variant & 5) && variant & 10) g.rotation.y = Math.PI / 2;
  // The piers at the banks, down into the water.
  for (const side of [-1, 1]) {
    k.box(0.2, 0.9, 0.7, STONE, side * 0.42, -0.75, 0, g);
    k.box(0.24, 0.05, 0.74, '#8d877b', side * 0.42, 0.15, 0, g);
  }
  // The pivot drum, girders and the deck.
  k.cyl(0.14, 0.16, 0.8, 8, '#6f6a62', 0, -0.62, 0, g);
  for (const z of [-0.24, 0.24]) k.box(1.04, 0.08, 0.06, IRON, 0, 0.12, z, g);
  k.box(1.02, 0.05, 0.56, TIMBER, 0, 0.2, 0, g);
  for (let i = 0; i < 6; i++) k.box(0.02, 0.051, 0.56, '#5b4330', -0.42 + i * 0.17, 0.2, 0, g);
  // Railings, and the lamp on its post.
  for (const z of [-0.27, 0.27]) {
    k.box(1.0, 0.03, 0.03, IRON, 0, 0.42, z, g);
    for (const x of [-0.45, -0.15, 0.15, 0.45]) k.box(0.025, 0.2, 0.025, IRON, x, 0.25, z, g);
  }
  k.cyl(0.02, 0.02, 0.5, 4, IRON, 0.45, 0.25, 0.27, g);
  k.team(k.box(0.08, 0.08, 0.08, TEAM, 0.45, 0.75, 0.27, g));
}

/**
 * A dam (#701 s5, the Age of Locks): a battered stone wall across the water between its banks (`variant` & 15, the land round it as a
 * bridge's), a brick turbine house on its crown with a slate roof, and a spillway. Turning (`variant` 16 and up), white water pours
 * from the spillway and a little steam rises from the house.
 */
function dam(k: Kit, variant: number): void {
  const turning = variant >= 16;
  const mask = variant & 15;
  const BRICK = '#8f4a36';
  const g = k.group();
  if (!(mask & 5) && mask & 10) g.rotation.y = Math.PI / 2;
  // The wall: broad below, a cut-stone crown.
  k.box(1.04, 1.0, 0.86, '#86807a', 0, -1.0, 0, g);
  k.box(1.04, 0.24, 0.62, STONE, 0, 0.0, 0, g);
  for (let i = 0; i < 5; i++) k.box(0.18, 0.04, 0.64, '#b0aaa0', -0.4 + i * 0.2, 0.22, 0, g);
  // The turbine house.
  k.box(0.48, 0.36, 0.4, BRICK, -0.16, 0.24, -0.04, g);
  k.prism(0.52, 0.18, 0.44, '#4c5560', -0.16, 0.6, -0.04, g);
  k.box(0.08, 0.26, 0.08, BRICK, -0.3, 0.62, 0.08, g);
  for (const x of [-0.28, -0.04]) k.box(0.08, 0.12, 0.01, '#e8d9a0', x, 0.36, 0.165, g);
  // The spillway on the low side, and the race below it.
  k.box(0.26, 0.06, 0.3, '#6f6a62', 0.3, 0.18, 0.4, g);
  if (turning) {
    k.box(0.22, 0.32, 0.06, '#e6f1f2', 0.3, -0.12, 0.56, g);
    k.box(0.5, 0.03, 0.34, '#cfe3e6', 0.3, -0.14, 0.72, g);
    k.blob(0.07, '#dfe4e6', -0.3, 0.98, 0.08, g);
  }
  k.team(k.box(0.12, 0.08, 0.12, TEAM, 0.36, 0.24, -0.2, g));
}

/** A windmill (#701): a thatched smock mill on a brick base with a reefing stage, its cap turned to the wind. The sails turn on their own (`windmillSails`). */
function windmill(k: Kit, _e: number, st: Style): void {
  pad(k, 2, st.base);
  k.cyl(0.78, 0.82, 0.42, 8, '#9a5a42', 0, 0, 0);
  k.cyl(0.5, 0.72, 1.7, 8, '#6b5a3c', 0, 0.42, 0);
  // The thatch in courses.
  for (const y of [0.85, 1.35, 1.8]) k.cyl(0.72 - (y - 0.42) * 0.13, 0.72 - (y - 0.42) * 0.13 + 0.01, 0.04, 8, '#5a4a30', 0, y, 0);
  // The reefing stage, on brackets.
  k.cyl(1.0, 1.0, 0.05, 12, '#7a5636', 0, 0.82, 0);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    k.cyl(0.012, 0.012, 0.24, 3, '#5b4330', Math.cos(a) * 0.97, 0.87, Math.sin(a) * 0.97);
  }
  k.ring(0.97, 0.012, '#5b4330', 1.1);
  k.box(0.28, 0.42, 0.04, '#3a2b20', 0, 0.0, 0.8);
  window(k, st, 0, 1.35, 0.62, 0.1, 0.13, true);
  // The cap, boat-shaped, with its tail pole to turn it to the wind.
  const cap = k.prism(0.8, 0.42, 1.0, '#3d3a36', 0, 2.12, -0.05);
  cap.rotation.y = Math.PI / 2;
  k.box(0.06, 0.06, 2.24, '#5b4330', 0, 1.07, -0.95).rotation.x = -1.107;
  k.cyl(0.1, 0.1, 0.25, 8, '#5b4330', 0, 2.32, 0.42).rotation.x = Math.PI / 2;
}

/** A windmill's sails (#701): four lattice blades with white cloth, centred on the hub and turning about z. */
export function windmillSails(): THREE.BufferGeometry {
  const key = 'windmillSails';
  let g = cache.get(key);
  if (!g) {
    const k = new Kit();
    k.cyl(0.11, 0.11, 0.16, 8, '#4a3426', 0, -0.08, 0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const arm = k.group();
      arm.rotation.z = (i * Math.PI) / 2;
      k.box(0.07, 1.55, 0.05, '#5b4330', 0, 0.05, 0.06, arm);
      k.box(0.3, 1.15, 0.015, '#efe8d8', 0.17, 0.42, 0.08, arm);
      for (let j = 0; j < 6; j++) k.box(0.34, 0.025, 0.03, '#6b4b2f', 0.17, 0.44 + j * 0.2, 0.09, arm);
      k.box(0.02, 1.15, 0.03, '#6b4b2f', 0.33, 0.42, 0.09, arm);
    }
    g = bake(k.root);
    cache.set(key, g);
  }
  return g;
}

/** Where a windmill's sails hang, in its model's space. */
export const SAIL_HUB = { y: 2.32, z: 0.6 };

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
  if (e === 2) {
    // A portcullis raised in its slot above the arch.
    for (let i = 0; i < 4; i++) k.box(0.03, 0.4, 0.03, '#2b2b2e', -0.15 + i * 0.1, h - 0.7, 0);
  }
  if (e === 3) {
    // Gunpowder: gun ports in the gate towers and a drawbridge chain on the lintel.
    for (const x of [-0.72, 0.72]) {
      k.box(0.14, 0.12, 0.1, '#2b2b2e', x, h * 0.45, 0.4);
      k.box(0.14, 0.12, 0.1, '#2b2b2e', x, h * 0.45, -0.4);
    }
    for (const x of [-0.3, 0.3]) k.cyl(0.015, 0.015, 0.5, 4, '#2b2b2e', x, h - 0.75, 0.28);
  }
  if (e === 4) {
    // Industrial: iron-barred gate leaves between brick piers, a lamp on each.
    for (const x of [-0.72, 0.72]) lamp(k, x, h + 0.06, 0, 0.45);
    for (let i = 0; i < 5; i++) for (const x of [-1, 1]) k.cyl(0.015, 0.015, h - 0.5, 4, '#2b2b2e', x * (0.1 + i * 0.07), 0, 0.3);
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

function silo(k: Kit, _e: number, st: Style, variant = 0): void {
  // The Missile Silo (#605): a concrete collar round a hatch, the two doors thrown back on a pale warhead nose, hazard stripes and a red beacon.
  // Held in Reserve (#759 s3, `variant` 1 arming, 2 ready): the doors stand up on guard, a teal band (the colour of missile defence) rings
  // the collar, and the beacon burns amber while it arms, teal once it stands ready, so every player can read it from afar.
  const kept = variant > 0;
  k.box(2.9, 0.12, 2.9, '#6e6d66', 0, -0.02, 0);
  k.cyl(1.25, 1.35, 0.35, 16, '#9b9a92', 0, 0, 0);
  k.cyl(0.95, 0.95, 0.04, 16, '#17181c', 0, 0.35, 0);
  k.cone(0.34, 1.3, 10, '#d9d9d2', 0, 0.2, 0);
  k.cyl(0.35, 0.35, 0.08, 10, kept ? '#2fa8a2' : '#c0382c', 0, 1.0, 0);
  const l = k.box(0.9, 0.06, 1.6, '#4a4d54', kept ? -1.0 : -0.75, kept ? 0.78 : 0.58, 0);
  l.rotation.z = kept ? 1.35 : 0.9;
  const r = k.box(0.9, 0.06, 1.6, '#4a4d54', kept ? 1.0 : 0.75, kept ? 0.78 : 0.58, 0);
  r.rotation.z = kept ? -1.35 : -0.9;
  for (let i = 0; i < 8; i++) k.box(0.18, 0.02, 0.1, i % 2 ? '#e6c22a' : '#1d1e24', -1.1 + i * 0.3, 0.37, 1.25);
  if (kept) k.cyl(1.37, 1.37, 0.08, 16, '#3fc6c0', 0, 0.2, 0);
  k.team(k.box(0.7, 0.14, 0.04, TEAM, 0, 0.1, 1.38));
  k.box(0.35, 0.9, 0.35, st.wall, 1.2, 0, -1.2);
  k.glow(k.sphere(kept ? 0.09 : 0.07, variant === 2 ? '#5affe8' : kept ? '#ffb02a' : '#ff3a2a', 1.2, 1.0, -1.2));
}

function battery(k: Kit, _e: number, st: Style): void {
  // The Interceptor Battery (#759 s2): a concrete pad, a slim pale interceptor on a rail raised steeply skyward, a radar dish on a mast
  // turned to the sky, a low bunker with a team band, and a green lamp (it watches; it does not threaten).
  k.box(1.9, 0.1, 1.9, '#6e6d66', 0, -0.02, 0);
  k.box(1.5, 0.05, 1.5, '#8b8a82', 0, 0.08, 0);
  // The launcher: a turntable, a trunnion, and the rail leaning back toward the sky with its rocket on it.
  k.cyl(0.38, 0.42, 0.14, 10, '#4a4d54', -0.2, 0.1, 0.15);
  k.box(0.32, 0.3, 0.3, '#3e4148', -0.2, 0.22, 0.15);
  const rail = k.group(-0.2, 0.48, 0.15);
  rail.rotation.x = -0.45;
  k.box(0.12, 1.25, 0.12, '#55585f', 0, 0, 0, rail);
  k.cyl(0.07, 0.07, 1.0, 8, '#e8e4dc', 0, 0.14, 0.13, rail);
  k.cone(0.07, 0.24, 8, '#b8322a', 0, 1.14, 0.13, rail);
  k.team(k.cyl(0.075, 0.075, 0.08, 8, TEAM, 0, 0.82, 0.13, rail));
  for (const x of [-1, 1]) k.box(0.02, 0.2, 0.14, '#4a4640', x * 0.08, 0.14, 0.13, rail);
  // The radar: a mast and a dish turned up and out.
  k.cyl(0.05, 0.06, 0.95, 6, '#55585f', 0.55, 0.1, -0.5);
  const dish = k.dome(0.32, '#d8d8d2', 0.55, 1.0, -0.5);
  dish.rotation.x = 2.3;
  dish.scale.set(1, 0.45, 1);
  k.cyl(0.02, 0.02, 0.28, 4, '#3a3632', 0.55, 1.0, -0.38);
  // The bunker and its team band.
  k.box(0.75, 0.42, 0.55, st.wall, 0.45, 0.1, 0.5);
  k.box(0.82, 0.06, 0.62, '#5a5c60', 0.45, 0.52, 0.5);
  k.team(k.box(0.77, 0.1, 0.04, TEAM, 0.45, 0.3, 0.79));
  k.glow(k.sphere(0.05, '#5aff7a', 0.75, 0.62, 0.3));
}

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
export const DRESSED_AGES: AgeId[] = [...LOOK_AGES, 'reclaimer', 'sail', 'aeronaut', 'lightning', 'warband', 'ironblood', 'totalwar', 'steppe', 'horde', 'silk', 'hemocraft', 'bloodrite', 'golden', ...NEW_LOOK_AGES];

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
const COPPER = '#c27a3e';
const PALE = '#e9e4d6';
const GILT = '#e2b440';
const GILT_DARK = '#a8781e';
const GLINT = '#fff1b8';

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

const BLOOD = '#9b1c2c';
const SANDBAG = '#a89a72';

/** A war banner (#313): a tall pole, a long crimson streamer in the wind over a band of the people's colour, a spear point on top. */
function warBanner(k: Kit, x: number, z: number, h: number): void {
  k.cyl(0.022, 0.028, h, 5, '#3f2e22', x, 0, z);
  k.cloth(k.box(0.012, 0.2, 0.46, BLOOD, x, h - 0.2, z + 0.23), 0.46, z);
  k.cloth(k.team(k.box(0.014, 0.08, 0.3, TEAM, x, h - 0.36, z + 0.15)), 0.3, z);
  k.cone(0.035, 0.12, 4, '#7c8088', x, h, z);
}

/** A row of sharpened stakes leaning out along x: the camp's palisade carried home (Iron and Blood). */
function stakes(k: Kit, x0: number, x1: number, z: number, n: number): void {
  for (let i = 0; i < n; i++) k.cyl(0.0, 0.04, 0.4, 4, '#5a4630', x0 + ((x1 - x0) * (i + 0.5)) / n, 0, z).rotation.x = 0.35;
}

/** A low wall of stacked sandbags along x (Total War). */
function sandbags(k: Kit, x0: number, x1: number, z: number, rows = 2): void {
  const n = Math.max(2, Math.round((x1 - x0) / 0.24));
  const w = (x1 - x0) / n;
  for (let r = 0; r < rows; r++) for (let i = 0; i < n - (r % 2); i++) k.box(w * 0.92, 0.1, 0.16, SANDBAG, x0 + w * (i + 0.5 + (r % 2) * 0.5), r * 0.1, z);
}

/**
 * The Path of Blood (#313): its towns arm as it goes deeper. The Warband flies war banners; Iron and Blood
 * adds the camp's sharpened stakes before the doors; Total War rings the fronts with sandbags as well.
 */
function bloodTouches(k: Kit, type: BuildingType, age: AgeId): void {
  const depth = age === 'warband' ? 1 : age === 'ironblood' ? 2 : 3;
  // Farms, gates and towers stay bare, and the War Camp already flies its standard.
  const span = type === 'wonder' ? 2.5 : type === 'towncenter' ? 1.75 : type === 'house' ? 0.72 : ['farm', 'gate', 'tower', 'warcamp', 'drainrig', 'transfusion', 'bloodtower'].includes(type) ? 0 : 1.05;
  if (!span) return;
  const tall = type === 'wonder' ? 3.0 : type === 'towncenter' ? 2.5 : type === 'house' ? 1.3 : 1.9;
  const war = ['towncenter', 'barracks', 'range', 'stable', 'wonder'].includes(type);
  if (war) {
    warBanner(k, -span, span, tall);
    warBanner(k, span, span, tall);
  } else warBanner(k, span * 0.9, span * 0.9, tall * 0.8);
  if (depth >= 2 && (war || type === 'house')) stakes(k, -span * 0.8, span * 0.8, span + 0.22, type === 'house' ? 4 : 7);
  if (depth >= 3 && (war || type === 'house' || type === 'storehouse')) sandbags(k, -span * 0.75, span * 0.75, span + (depth >= 2 && type !== 'storehouse' ? 0.45 : 0.2));
}

/** A riveted steel serum tank with a band of red glass and a red gauge lamp (Hemocraft, #355 s2). */
function serumTank(k: Kit, x: number, z: number, r: number, h: number): void {
  k.cyl(r, r, h, 8, IRON_DARK, x, 0, z);
  k.cyl(r * 1.04, r * 1.04, h * 0.32, 8, '#8a1222', x, h * 0.38, z);
  for (const y of [h * 0.2, h * 0.86]) k.cyl(r * 1.06, r * 1.06, 0.04, 8, '#6b7076', x, y, z);
  k.dome(r, '#6b7076', x, h, z);
  k.glow(k.sphere(0.05, '#ff3a4a', x, h + r * 0.75, z));
}

/**
 * Hemocraft's towns (#355 s2), blood run through machines: serum tanks beside the doors, piped into the walls; the war buildings and
 * the Town Center get two, other buildings one; the Drain Rig, Station and towers are already the age's own.
 */
function hemoTouches(k: Kit, type: BuildingType): void {
  if (['farm', 'gate', 'wall', 'tower', 'warcamp', 'drainrig', 'transfusion', 'bloodtower'].includes(type)) return;
  const span = type === 'wonder' ? 2.5 : type === 'towncenter' ? 1.75 : type === 'house' ? 0.72 : 1.05;
  const r = type === 'house' ? 0.16 : 0.24;
  const h = type === 'wonder' ? 1.6 : type === 'towncenter' ? 1.3 : type === 'house' ? 0.7 : 1.0;
  const sides = ['towncenter', 'barracks', 'range', 'stable', 'wonder'].includes(type) ? [-1, 1] : [1];
  for (const d of sides) {
    const x = d * (span + r * 0.6);
    serumTank(k, x, span * 0.45, r, h);
    // The pipe from the tank into the wall, at waist height.
    k.box(r * 1.4, 0.06, 0.06, '#6b7076', x - d * r * 0.9, h * 0.55, span * 0.45);
  }
}

/** A bronze brazier on a tripod with live coals (the Blood-rite, #355 s2). */
function brazier(k: Kit, x: number, z: number, h: number): void {
  for (const [dx, dz] of [[-0.07, -0.05], [0.07, -0.05], [0, 0.08]]) k.cyl(0.015, 0.015, h, 4, '#3a2c22', x + dx, 0, z + dz);
  k.cyl(0.16, 0.08, 0.12, 7, '#8a5a2a', x, h, z);
  k.glow(k.sphere(0.09, '#ff6a2a', x, h + 0.12, z));
}

/**
 * The Blood-rite's towns (#355 s2): a long red-dyed cloth hung down each front, a brazier burning at the door, and before the Temple
 * a plain altar of pale stone between two braziers. The Temple's own model keeps each epoch's faith (a church in the late ages), so the
 * rite's dressing stays restrained: cloth and fire, nothing that mocks the building it stands before.
 */
function riteTouches(k: Kit, type: BuildingType): void {
  if (['farm', 'gate', 'wall', 'tower', 'warcamp', 'drainrig', 'transfusion', 'bloodtower'].includes(type)) return;
  const span = type === 'wonder' ? 2.5 : type === 'towncenter' ? 1.75 : type === 'house' ? 0.72 : type === 'temple' ? 1.4 : 1.05;
  const tall = type === 'wonder' ? 2.6 : type === 'towncenter' ? 2.0 : type === 'house' ? 1.0 : 1.5;
  k.box(span * 0.5, tall * 0.8, 0.03, '#7a1424', 0, tall * 0.15, span + 0.02);
  k.box(span * 0.5, 0.06, 0.05, '#c8a24a', 0, tall * 0.95, span + 0.02);
  if (type === 'temple') {
    k.box(0.9, 0.42, 0.5, PALE, 0, 0, span + 0.6);
    for (const x of [-0.75, 0.75]) brazier(k, x, span + 0.6, 0.55);
  } else if (type !== 'house') brazier(k, span * 0.75, span + 0.35, 0.5);
}

/**
 * A horsetail standard (the Age of the Horde, #318): a spear-headed pole with a gilded ring, under it a
 * skirt of long horsehair strands, black for war or white for the camp's own spirit banner.
 */
function horsetail(k: Kit, x: number, z: number, h: number, white = false): void {
  k.cyl(0.026, 0.032, h, 5, '#4a3626', x, 0, z);
  k.cyl(0.13, 0.13, 0.05, 8, '#c8a24a', x, h - 0.12, z);
  const hair = white ? '#ece6d6' : '#231a15';
  k.cyl(0.11, 0.06, 0.5, 7, hair, x, h - 0.62, z);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.cyl(0.045, 0.008, 0.78, 4, hair, x + Math.cos(a) * 0.09, h - 0.9, z + Math.sin(a) * 0.09);
  }
  k.cone(0.045, 0.26, 4, '#d8b25a', x, h - 0.07, z);
}

/** The Horde's towns (#318) fly horsetail standards before their doors: two at a Town Center (one white) and the war buildings, one elsewhere. */
function hordeTouches(k: Kit, type: BuildingType): void {
  if (['farm', 'gate', 'tower', 'warcamp', 'drainrig', 'transfusion', 'bloodtower'].includes(type)) return;
  const span = type === 'wonder' ? 2.5 : type === 'towncenter' ? 1.75 : type === 'house' ? 0.72 : 1.05;
  const tall = type === 'wonder' ? 3.2 : type === 'towncenter' ? 2.7 : type === 'house' ? 1.4 : 2.0;
  if (['towncenter', 'barracks', 'range', 'stable', 'wonder'].includes(type)) {
    horsetail(k, -span, span + 0.1, tall, type === 'towncenter');
    horsetail(k, span, span + 0.1, tall);
  } else horsetail(k, span * 0.9, span * 0.9, tall * 0.85);
}

/**
 * The Steppe's camps (#297 s6): felt and hide. A white felt apron with a red and blue woven band runs along
 * each front, painted door posts frame it, a hide stretched on a rack dries beside the bigger buildings, and
 * the Town Center keeps an antlered pole, the herders' trophy of the hunt.
 */
function steppeTouches(k: Kit, type: BuildingType): void {
  if (['farm', 'gate', 'tower', 'warcamp', 'drainrig', 'transfusion', 'bloodtower', 'caravanserai', 'mission'].includes(type)) return;
  const span = type === 'wonder' ? 2.4 : type === 'towncenter' ? 1.6 : type === 'house' ? 0.6 : 0.95;
  const front = span + 0.08;
  const h = type === 'house' ? 0.5 : type === 'towncenter' || type === 'wonder' ? 0.9 : 0.7;
  k.box(span * 1.7, 0.3, 0.05, '#ece4cf', 0, h, front);
  const n = type === 'house' ? 5 : 9;
  const w = (span * 1.7) / n;
  for (let i = 0; i < n; i++) k.box(w * 0.7, 0.07, 0.06, i % 2 ? '#a83a2e' : '#2f5a8a', -span * 0.85 + w * (i + 0.5), h + 0.1, front + 0.01);
  for (const x of [-0.2, 0.2]) k.box(0.05, h + 0.4, 0.06, '#a83a2e', x * span * 1.4, 0, front + 0.03);
  if (type !== 'house') {
    const x = span + 0.4;
    for (const z of [-span * 0.5, span * 0.5]) k.cyl(0.02, 0.024, 0.95, 4, '#4a3626', x, 0, z);
    k.box(0.02, 0.02, span, '#4a3626', x, 0.92, 0);
    k.box(0.03, 0.62, span * 0.85, '#b89a6a', x, 0.3, 0);
  }
  if (type === 'towncenter') {
    const x = -span - 0.3;
    k.cyl(0.03, 0.036, 2.1, 5, '#4a3626', x, 0, span * 0.6);
    for (const d of [-1, 1]) {
      k.box(0.05, 0.05, 0.42, '#d9cdb0', x, 2.08, span * 0.6 + d * 0.2).rotation.x = -d * 0.5;
      k.box(0.04, 0.04, 0.22, '#d9cdb0', x, 2.28, span * 0.6 + d * 0.38);
    }
    k.sphere(0.1, '#e8e0cc', x, 2.04, span * 0.6);
  }
}

/**
 * The Silk Road's towns (#326), a caravan camp: a striped awning out over each door on two poles, bolts of
 * dyed silk drying on a line beside the bigger tents, and the white horsetail kept before the Town Center.
 */
function silkTouches(k: Kit, type: BuildingType): void {
  // The Caravanserai (#334) is already the road's own building.
  if (['farm', 'gate', 'tower', 'warcamp', 'drainrig', 'transfusion', 'bloodtower', 'caravanserai', 'mission'].includes(type)) return;
  const span = type === 'wonder' ? 2.4 : type === 'towncenter' ? 1.6 : type === 'house' ? 0.6 : type === 'market' ? 1.3 : 0.95;
  const h = type === 'house' ? 0.8 : type === 'towncenter' || type === 'wonder' ? 1.5 : 1.15;
  const front = span + 0.1;
  const n = type === 'house' ? 4 : 6;
  const w = (span * 1.3) / n;
  for (let i = 0; i < n; i++) k.box(w, 0.03, 0.55, i % 2 ? '#efe2c4' : '#b8462e', -span * 0.65 + w * (i + 0.5), h, front + 0.22).rotation.x = 0.28;
  for (const x of [-span * 0.62, span * 0.62]) k.cyl(0.02, 0.022, h - 0.12, 4, '#4a3626', x, 0, front + 0.46);
  if (type !== 'house') {
    // The drying line along the right side, its bolts in madder, indigo, saffron and plum.
    const x = span + 0.35;
    for (const z of [-span * 0.7, span * 0.7]) k.cyl(0.018, 0.02, 1.0, 4, '#4a3626', x, 0, z);
    k.box(0.015, 0.015, span * 1.4, '#3a2c22', x, 0.98, 0);
    const dyes = ['#a83a3a', '#3a4e9a', '#e0a83a', '#7a3a8a', '#3a8a6a'];
    const bolts = type === 'market' || type === 'towncenter' || type === 'wonder' ? 5 : 3;
    for (let i = 0; i < bolts; i++) k.box(0.02, 0.5, (span * 1.1) / bolts, dyes[i % dyes.length], x, 0.48, -span * 0.55 + ((span * 1.1) / bolts) * (i + 0.5));
  }
  if (type === 'towncenter') horsetail(k, -span - 0.2, span + 0.15, 2.7, true);
}

function ageTouches(k: Kit, type: BuildingType, age: AgeId): void {
  // The 21 ages dressed for #803 keep their touches in `ageLooks.ts`.
  if (ageLookTouches(k, type, age)) return;
  const big = type === 'towncenter';
  switch (age) {
    case 'warband':
    case 'ironblood':
    case 'totalwar':
      bloodTouches(k, type, age);
      break;
    case 'hemocraft':
      hemoTouches(k, type);
      break;
    case 'bloodrite':
      riteTouches(k, type);
      break;
    case 'steppe':
      steppeTouches(k, type);
      break;
    case 'horde':
      hordeTouches(k, type);
      break;
    case 'silk':
      silkTouches(k, type);
      break;
    case 'aeronaut': {
      // Sky blue navigation bands and a rooftop windsock mark the aviation towns.
      if (['towncenter', 'house', 'forge', 'wonder'].includes(type)) {
        const span = type === 'wonder' ? 1.8 : big ? 1.4 : 0.7;
        k.box(span * 2, 0.12, 0.04, '#76c6d6', 0, 0.55, span);
        const h = type === 'wonder' ? 3.3 : big ? 2.5 : 1.6;
        k.cyl(0.025, 0.025, h, 5, '#d7e4e8', span, 0, 0);
        k.box(0.48, 0.12, 0.1, '#76c6d6', span + 0.24, h, 0);
        k.box(0.12, 0.12, 0.11, '#f4efe4', span + 0.18, h, 0);
      }
      break;
    }
    case 'lightning': {
      // The Age of Lightning (#231): the Watch Tower turns Coil Tower, a copper winding round its shaft,
      // a lattice mast and Wardenclyffe's mushroom crown, glowing; other buildings carry a small receiving mast.
      if (type === 'tower') {
        for (const y of [1.15, 1.35, 1.55, 1.75, 1.95, 2.15]) k.ring(0.74, 0.035, COPPER, y);
        for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) k.cyl(0.025, 0.04, 1.05, 4, IRON_DARK, x, 2.72, z);
        for (const y of [3.05, 3.4]) k.box(0.5, 0.03, 0.5, IRON_DARK, 0, y, 0);
        k.cyl(0.62, 0.2, 0.12, 12, COPPER, 0, 3.72, 0);
        k.dome(0.62, COPPER, 0, 3.84, 0);
        k.glow(k.sphere(0.12, '#bfe6ff', 0, 4.5, 0));
      } else if (['towncenter', 'barracks', 'range', 'stable', 'workshop', 'forge', 'market', 'temple', 'dock', 'wonder'].includes(type)) {
        const span = type === 'wonder' ? 2.2 : big ? 1.7 : 1.2;
        const h = type === 'wonder' ? 3.4 : big ? 2.9 : 2.1;
        k.cyl(0.025, 0.035, h, 4, IRON_DARK, span, 0, -span * 0.6);
        k.ring(0.12, 0.02, COPPER, 0).position.set(span, h * 0.8, -span * 0.6);
        k.glow(k.octa(0.06, '#bfe6ff', span, h + 0.04, -span * 0.6));
      }
      break;
    }
    case 'golden': {
      // The Golden Age (#703): gilt domes and spires over the great buildings, a gold band and a glowing finial on the rest, so a
      // rival can see a golden town from across the map, and see the gilt go when it ends.
      if (['towncenter', 'temple', 'market', 'wonder'].includes(type)) {
        const r = type === 'wonder' ? 1.1 : big ? 0.85 : 0.6;
        const h = type === 'wonder' ? 3.6 : big ? 2.75 : 2.15;
        k.cyl(r * 0.95, r, 0.22, 10, GILT_DARK, 0, h - 0.22, 0);
        k.dome(r, GILT, 0, h, 0);
        k.cyl(0.03, 0.05, 0.55, 5, GILT, 0, h + r * 0.85, 0);
        k.glow(k.octa(0.11, GLINT, 0, h + r * 0.85 + 0.62, 0));
        for (const x of [-r * 1.6, r * 1.6]) {
          k.cyl(0.035, 0.035, h * 0.85, 5, GILT_DARK, x, 0, r * 1.4);
          k.box(0.34, 0.5, 0.025, GILT, x + 0.18, h * 0.6, r * 1.4);
        }
      } else if (['house', 'barracks', 'range', 'stable', 'workshop', 'forge', 'storehouse', 'dock', 'mill', 'tower'].includes(type)) {
        const span = type === 'house' ? 0.62 : type === 'tower' ? 0.5 : 1.05;
        const h = type === 'tower' ? 2.4 : type === 'house' ? 1.15 : 1.55;
        k.box(span * 2 + 0.06, 0.08, 0.05, GILT, 0, h * 0.62, span + 0.02);
        k.cyl(0.02, 0.03, 0.4, 4, GILT_DARK, span * 0.6, h, 0);
        k.glow(k.octa(0.06, GLINT, span * 0.6, h + 0.45, 0));
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
      } else if (type === 'towncenter') {
        // The hillfort (`ironHillfort`) is the whole look.
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

const MAKERS: Record<Exclude<BuildingType, 'wall' | 'snare' | 'shaft' | 'dyke' | 'thornwall' | 'garden' | 'orchard' | 'channel' | 'hive' | 'sluice' | 'causeway' | 'bridge' | 'dam' | 'tidegate'>, (k: Kit, e: number, st: Style) => void> = {
  sapling: (k, e) => sapling(k, e),
  heart: (k) => heart(k),
  spire: (k) => spire(k),
  greatden,
  towncenter, house, storehouse, huntcamp, den, prospector, warcamp, drainrig, transfusion, bloodtower, caravanserai, mission, farm, barracks, range, stable, tower, forge, workshop, temple, market, wonder, gate, dock, airfield, silo, battery, windmill, bloomery, stockade, gallery, hirehall, standard, strand, wheelyard, pharos, chantry, mews,
  // The Age of Tides (#739), drawn in `tideModels.ts`.
  tidemill: (k: Kit, _e: number, st: Style) => tidemill(k, st.base),
  cockler: (k: Kit, _e: number, st: Style) => cocklerHut(k, st.base),
  // The Age of Floating Cities (#770), drawn in `floatModels.ts`.
  pontoon: (k: Kit) => pontoon(k),
  // The Deep Road (#876), drawn in `deepModels.ts`.
  henge: (k: Kit, _e: number, st: Style) => henge(k, st.base),
  barrow: (k: Kit, _e: number, st: Style) => barrow(k, st.base),
  ventforge: (k: Kit, _e: number, st: Style) => ventforge(k, st.base),
  faultengine: (k: Kit, _e: number, st: Style) => faultengine(k, st.base),
  heartstone: (k: Kit, _e: number, st: Style) => heartstone(k, st.base),
};

/** The Aeronauts' Airfield (#816): no runway but a mooring mast, an airship riding at its nose with a winch house and fuel drums below. */
function aeroAirfield(k: Kit, st: Style): void {
  k.box(3.9, 0.05, 3.9, '#8fa586', 0, -0.02, 0);
  k.cyl(1.7, 1.7, 0.03, 20, '#aeb2a8', 0, 0.02, -0.2);
  // The mast: a tapering lattice of three legs with a landing cap, and the winch house at its foot.
  const mx = 1.45;
  for (const a of [0, 2.1, 4.2]) {
    const leg = k.box(0.05, 1.9, 0.05, '#d7e4e8', mx + Math.sin(a) * 0.14, 0, -0.2 + Math.cos(a) * 0.14);
    leg.rotation.z = Math.sin(a) * -0.05;
  }
  for (const y of [0.5, 1.0, 1.5]) k.cyl(0.14 - y * 0.03, 0.14 - y * 0.03, 0.04, 6, '#9aa6ab', mx, y, -0.2);
  k.cyl(0.13, 0.1, 0.12, 8, '#2b3a48', mx, 1.9, -0.2);
  k.box(0.6, 0.4, 0.5, st.wall, 1.1, 0, 1.0);
  k.prism(0.7, 0.2, 0.6, st.roof, 1.1, 0.4, 1.0);
  k.box(0.2, 0.22, 0.02, '#1d1e24', 1.1, 0, 1.26);
  // The airship: a long cream envelope nosed on to the mast, tail fins in team colour, a slung gondola.
  const ship = k.sphere(0.5, '#e9e6df', 0, 2.05, -0.2);
  ship.scale.set(3, 0.95, 0.95);
  const belly = k.sphere(0.5, '#c2cbd0', 0, 1.9, -0.2);
  belly.scale.set(2.7, 0.7, 0.8);
  k.cone(0.12, 0.3, 8, '#2b3a48', mx - 0.15, 2.05, -0.2).rotation.z = -Math.PI / 2;
  k.team(k.box(0.5, 0.8, 0.04, TEAM, -1.15, 1.65, -0.2));
  k.team(k.box(0.5, 0.04, 0.8, TEAM, -1.15, 2.03, -0.2));
  k.box(0.9, 0.18, 0.26, '#2b3a48', 0, 1.35, -0.2);
  k.box(0.7, 0.07, 0.02, '#9ad0dc', 0, 1.4, -0.06);
  for (const x of [-0.3, 0.3]) k.cyl(0.015, 0.015, 0.25, 4, '#d7e4e8', x, 1.52, -0.2);
  // Bollards for the tail lines, and fuel drums by the winch house.
  for (const z of [-1.1, 0.7]) k.cyl(0.07, 0.08, 0.14, 6, '#5a6450', -1.9, 0, z);
  for (const [x, z] of [[0.5, 1.2], [0.7, 1.4]]) k.cyl(0.1, 0.1, 0.26, 8, '#5a6450', x, 0, z);
}

/** Buildings an age raises in a shape of its own (#816), in place of the trunk's model; its touches still follow. */
const AGE_SHAPES: Partial<Record<AgeId, Partial<Record<BuildingType, (k: Kit, st: Style) => void>>>> = {
  iron: { house: ironHouse, towncenter: ironHillfort },
  aeronaut: { airfield: aeroAirfield },
};

const cache = new Map<string, THREE.BufferGeometry>();

/** The Way a people lives by (#336) shows at its Town Center, so a rival who scouts the town can read it. */
export const WAY_MARKS = ['way:hunt', 'way:hearth', 'way:warband'];

/** The building an heirloom (#224) shows on, and the tech that earns the mark. */
export const HEIRLOOM_MARKS: Partial<Record<BuildingType, string>> = { temple: 'bellFoundry', dock: 'ironHulls' };

/** A second heirloom that shows on a building type that already has one: the Temple holds both the Bell Foundry's bell and the Masons' Lodge's works. */
export const HEIRLOOM_MORE: Partial<Record<BuildingType, string>> = { market: 'jointStock', temple: 'masonsLodge' };

/** The Age of Lightning's heirlooms (#240), which show on a Temple, Dock and Workshop beside any others. */
export const HEIRLOOM_FIELD: Partial<Record<BuildingType, string>> = { temple: 'stElmo', dock: 'telegraphy', workshop: 'galvanic' };

/** The Path of Blood's heirlooms (#355 s6), on a Temple and a Workshop beside any others. */
export const HEIRLOOM_BLOOD: Partial<Record<BuildingType, string>> = { temple: 'militaryOrders', workshop: 'galvanicBlood' };

/** Every heirloom id that dresses a kind of building. */
export function heirloomsFor(type: BuildingType): string[] {
  return [HEIRLOOM_MARKS[type], HEIRLOOM_MORE[type], HEIRLOOM_FIELD[type], HEIRLOOM_BLOOD[type], ...(type === 'towncenter' ? WAY_MARKS : [])].filter((id): id is string => !!id);
}

/** Bell Foundry: a bronze bell hung in a little timber cote on the Temple's roof ridge. Iron-Bound Hulls: iron bands and bolts on the dock's boathouse and pier. Joint-Stock Company: a counting-house board with a gilt seal and coin stacks by the Market. Masons' Lodge: dressed ashlar and shear-legs hoisting a block beside the Temple. */
function heirloomTouch(k: Kit, id: string, deep = false): void {
  if (id.startsWith('way:')) return wayTouch(k, id.slice(4), deep);
  const BRONZE = '#b8893a';
  const IRON = '#34373d';
  const GOLD = '#e2b23c';
  const ASHLAR = '#b9b2a2';
  const COPPER = '#b8683a';
  if (id === 'bellFoundry') {
    k.box(0.07, 0.5, 0.07, '#5a4630', -0.22, 1.7, -0.2);
    k.box(0.07, 0.5, 0.07, '#5a4630', 0.22, 1.7, -0.2);
    k.box(0.6, 0.07, 0.14, '#5a4630', 0, 2.2, -0.2);
    k.prism(0.7, 0.22, 0.3, '#6e5a44', 0, 2.27, -0.2);
    k.cone(0.17, 0.3, 8, BRONZE, 0, 1.78, -0.2);
    k.sphere(0.04, IRON, 0, 1.76, -0.2);
  } else if (id === 'ironHulls') {
    for (const x of [-1.2, -0.7, -0.2]) k.box(0.06, 0.9, 1.44, IRON, x, 0, -0.55);
    for (const z of [0.85, 1.35, 1.8]) k.box(1.14, 0.03, 0.06, IRON, 0.4, 0.2, z);
    for (const x of [-0.1, 0.9]) k.cyl(0.07, 0.07, 0.05, 6, IRON, x, -0.1, 1.0);
  } else if (id === 'jointStock') {
    // A counting-house board on two posts at the back, a gilt seal on it, and coin stacks on a ledger desk.
    for (const x of [-0.5, 0.5]) k.cyl(0.04, 0.05, 1.1, 5, '#5a4630', x, 0, -1.2);
    k.box(1.3, 0.4, 0.06, '#2f3d55', 0, 0.85, -1.2);
    k.box(1.36, 0.05, 0.1, '#5a4630', 0, 1.25, -1.2);
    k.cyl(0.14, 0.14, 0.03, 10, GOLD, 0, 0.9, -1.16).rotation.x = Math.PI / 2;
    k.box(0.7, 0.3, 0.4, '#8a6440', 1.05, 0, -0.75);
    k.box(0.5, 0.03, 0.3, '#f4efe4', 1.05, 0.31, -0.75);
    for (let i = 0; i < 4; i++) k.cyl(0.07, 0.07, 0.03, 8, GOLD, 0.9, 0.34 + i * 0.03, -0.75);
    for (let i = 0; i < 3; i++) k.cyl(0.07, 0.07, 0.03, 8, GOLD, 1.2, 0.34 + i * 0.03, -0.75);
  } else if (id === 'masonsLodge') {
    // Shear-legs with a dressed block hanging from them, and a stack of ashlar beside.
    k.box(0.06, 1.5, 0.06, '#5a4630', 1.05, 0, 1.15).rotation.x = 0.28;
    k.box(0.06, 1.5, 0.06, '#5a4630', 1.05, 0, 1.45).rotation.x = -0.28;
    k.box(0.1, 0.06, 0.5, '#5a4630', 1.05, 1.42, 1.3);
    k.cyl(0.008, 0.008, 0.6, 3, IRON, 1.05, 0.8, 1.3);
    k.box(0.3, 0.22, 0.3, ASHLAR, 1.05, 0.52, 1.3);
    for (let i = 0; i < 3; i++) k.box(0.4, 0.18, 0.3, i % 2 ? ASHLAR : '#a29a8a', -1.1 + (i % 2) * 0.05, i * 0.18, 1.3);
    k.box(0.3, 0.18, 0.3, '#a29a8a', -1.5, 0, 1.3);
  } else if (id === 'stElmo') {
    // A copper lightning rod on the roof, a blue glow burning on its tip, and a bronze ring at its foot.
    k.cyl(0.02, 0.03, 1.3, 4, COPPER, -0.6, 1.7, 0.3);
    k.cyl(0.1, 0.1, 0.04, 8, COPPER, -0.6, 1.75, 0.3);
    k.glow(k.sphere(0.07, '#9fd8ff', -0.6, 3.05, 0.3));
  } else if (id === 'telegraphy') {
    // A lattice mast with two crossbars on the pier's end, a lamp on top, and a wire down to a signal hut.
    for (const x of [-0.05, 0.05]) k.cyl(0.02, 0.025, 2.2, 4, IRON, 1.5 + x, 0, 1.5);
    for (const y of [1.2, 1.7]) k.box(0.5, 0.03, 0.03, IRON, 1.5, y, 1.5);
    k.glow(k.sphere(0.05, '#9fd8ff', 1.5, 2.3, 1.5));
    k.box(0.4, 0.3, 0.3, '#6e5a44', 1.5, 0, 0.9);
  } else if (id === 'galvanic') {
    // A small copper coil with a blue spark between its horns, set beside the workshop.
    k.cyl(0.14, 0.18, 0.1, 8, IRON, 1.1, 0, 1.2);
    for (let i = 0; i < 5; i++) k.cyl(0.16, 0.16, 0.05, 8, COPPER, 1.1, 0.12 + i * 0.09, 1.2);
    for (const s of [-1, 1]) k.box(0.03, 0.3, 0.03, COPPER, 1.1 + s * 0.1, 0.6, 1.2).rotation.z = -s * 0.25;
    k.glow(k.sphere(0.06, '#9fd8ff', 1.1, 0.8, 1.2));
  } else if (id === 'galvanicBlood') {
    // A tall glass tank of dark blood on an iron foot, a copper wire wound round it and a blue spark at its crown, on the far corner.
    k.cyl(0.2, 0.24, 0.12, 8, IRON, -1.1, 0, 1.2);
    k.cyl(0.15, 0.15, 0.7, 8, '#6a0f14', -1.1, 0.12, 1.2);
    for (let i = 0; i < 4; i++) k.cyl(0.17, 0.17, 0.035, 8, COPPER, -1.1, 0.2 + i * 0.16, 1.2);
    k.cyl(0.12, 0.18, 0.08, 8, IRON, -1.1, 0.82, 1.2);
    k.cyl(0.015, 0.015, 0.25, 3, COPPER, -1.1, 0.9, 1.2);
    k.glow(k.sphere(0.05, '#9fd8ff', -1.1, 1.18, 1.2));
  } else if (id === 'militaryOrders') {
    // A war banner on a tall pole at the back corner, deep red with a gold band, and a kite shield and a sword planted at its foot.
    k.cyl(0.03, 0.035, 2.4, 5, '#5a4630', 1.3, 0, -1.15);
    k.box(0.03, 0.75, 0.5, '#8a1f22', 1.3, 1.55, -0.88);
    k.box(0.035, 0.12, 0.5, GOLD, 1.3, 1.9, -0.88);
    k.cone(0.05, 0.12, 4, BRONZE, 1.3, 2.4, -1.15);
    k.box(0.05, 0.45, 0.3, '#d8d2c2', 1.05, 0, -1.25).rotation.x = -0.15;
    k.box(0.06, 0.14, 0.12, '#8a1f22', 1.08, 0.2, -1.25);
    k.box(0.03, 0.6, 0.05, '#9a9aa0', 1.5, 0, -1.3);
    k.box(0.18, 0.03, 0.05, IRON, 1.5, 0.45, -1.3);
  }
}

/**
 * A Way's mark before the Town Center (#336). The Hunters: a drying frame hung with pelts and a stag skull
 * on a pole. The Hearth: a ring of stones round a glowing fire with a clay pot. The Warband: spears planted
 * in a rack with a painted shield.
 */
function wayTouch(k: Kit, way: string, deep = false): void {
  const WOOD = '#5a4630';
  if (way === 'hunt') {
    for (const x of [-1.6, -0.7]) k.cyl(0.04, 0.05, 1.2, 5, WOOD, x, 0, 2.1);
    k.box(1.1, 0.05, 0.05, WOOD, -1.15, 1.15, 2.1);
    for (const [i, c] of ['#8a6440', '#b89a6a', '#6e5238'].entries()) k.box(0.24, 0.55, 0.03, c, -1.5 + i * 0.35, 0.85, 2.1);
    k.cyl(0.035, 0.045, 1.4, 5, WOOD, 0.3, 0, 2.2);
    k.box(0.22, 0.16, 0.28, '#e6dcc4', 0.3, 1.4, 2.2);
    for (const s of [-1, 1]) k.box(0.04, 0.34, 0.04, '#d8cdb0', 0.3 + s * 0.16, 1.62, 2.2).rotation.z = -s * 0.5;
  } else if (way === 'hearth') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.box(0.22, 0.16, 0.2, i % 2 ? '#8a8478' : '#9a948a', -1.2 + Math.cos(a) * 0.42, 0, 2.2 + Math.sin(a) * 0.42);
    }
    k.cone(0.2, 0.5, 6, '#e8803a', -1.2, 0.05, 2.2);
    k.glow(k.sphere(0.1, '#ffd070', -1.2, 0.3, 2.2));
    k.cyl(0.14, 0.1, 0.22, 8, '#9a5a3a', -0.55, 0, 2.5);
    k.cyl(0.16, 0.16, 0.03, 8, '#7a4a30', -0.55, 0.22, 2.5);
  } else if (way === 'warband') {
    k.box(1.3, 0.06, 0.06, WOOD, -1.1, 0.75, 2.1);
    for (const x of [-1.7, -1.1, -0.5]) {
      k.cyl(0.02, 0.025, 1.9, 4, WOOD, x, 0, 2.1);
      k.cone(0.045, 0.2, 4, '#9a9aa0', x, 1.9, 2.1);
    }
    k.cyl(0.26, 0.26, 0.05, 10, '#a83a2e', -1.1, 0.95, 2.18).rotation.x = Math.PI / 2;
    k.cyl(0.07, 0.07, 0.06, 6, '#d8b25a', -1.1, 0.95, 2.2).rotation.x = Math.PI / 2;
  }
  if (!deep) return;
  // A vow deepened (#338) adds a second flourish beside the first.
  if (way === 'hunt') {
    // A second frame, hung with a long hide and a row of teeth, and antlers piled at its foot.
    for (const x of [-2.5, -1.9]) k.cyl(0.04, 0.05, 1.3, 5, WOOD, x, 0, 2.1);
    k.box(0.8, 0.05, 0.05, WOOD, -2.2, 1.25, 2.1);
    k.box(0.4, 0.8, 0.03, '#a8845a', -2.35, 0.4, 2.1);
    for (let i = 0; i < 4; i++) k.cone(0.03, 0.12, 4, '#e6dcc4', -2.5 + i * 0.2, 1.1, 2.1).rotation.x = Math.PI;
    for (const s of [-1, 1]) k.box(0.05, 0.4, 0.05, '#d8cdb0', -1.9 + s * 0.12, 0, 2.5).rotation.z = s * 0.6;
  } else if (way === 'hearth') {
    // A drying rack of fish and herbs over the fire, and a second pot beside the first.
    for (const x of [-1.7, -0.7]) k.cyl(0.03, 0.04, 1.0, 5, WOOD, x, 0, 2.2);
    k.box(1.1, 0.04, 0.04, WOOD, -1.2, 1.0, 2.2);
    for (let i = 0; i < 4; i++) k.box(0.08, 0.3, 0.03, i % 2 ? '#c2b08a' : '#6f8a4a', -1.5 + i * 0.22, 0.7, 2.2);
    k.cyl(0.11, 0.08, 0.18, 8, '#8a4a30', -0.3, 0, 2.4);
  } else if (way === 'warband') {
    // A second rack of spears, a war drum, and a banner pole with a red pennant.
    k.box(1.0, 0.06, 0.06, WOOD, -2.5, 0.7, 2.1);
    for (const x of [-2.9, -2.5, -2.1]) {
      k.cyl(0.02, 0.025, 1.7, 4, WOOD, x, 0, 2.1);
      k.cone(0.045, 0.2, 4, '#9a9aa0', x, 1.7, 2.1);
    }
    k.cyl(0.2, 0.2, 0.3, 8, '#7a5a3a', -0.2, 0, 2.3);
    k.cyl(0.21, 0.21, 0.03, 8, '#e6dcc4', -0.2, 0.3, 2.3);
    k.cyl(0.025, 0.03, 2.2, 4, WOOD, 0.4, 0, 2.0);
    k.box(0.45, 0.28, 0.03, '#a83a2e', 0.65, 1.8, 2.0);
  }
}

/** What a building is for, read from its roof (#625): war under cold slate, faith under pale gold, trade under teal, the land's work under ochre. Houses and the Town Center keep their epoch's own red. The Stone Age keeps its thatch and reads by plinth and pennant. */
const ROOFS: Partial<Record<BuildingType, [string, string]>> = {
  barracks: ['#3e4858', '#2e3641'], range: ['#3e4858', '#2e3641'], stable: ['#3e4858', '#2e3641'], workshop: ['#3e4858', '#2e3641'], forge: ['#3e4858', '#2e3641'],
  tower: ['#3e4858', '#2e3641'], warcamp: ['#3e4858', '#2e3641'], bloodtower: ['#3e4858', '#2e3641'], airfield: ['#3e4858', '#2e3641'], silo: ['#3e4858', '#2e3641'], battery: ['#3e4858', '#2e3641'],
  temple: ['#e9e2cf', '#d8b25a'], mission: ['#e9e2cf', '#d8b25a'],
  market: ['#1a5961', '#133f46'], caravanserai: ['#1a5961', '#133f46'], dock: ['#1a5961', '#133f46'],
  storehouse: ['#e2b855', '#d4a642'], huntcamp: ['#e2b855', '#d4a642'], prospector: ['#e2b855', '#d4a642'], shaft: ['#e2b855', '#d4a642'],
};

/** No plinth or pennant: open or thin pieces, and buildings that already carry their own standards. */
const BARE: BuildingType[] = ['wall', 'gate', 'snare', 'sapling', 'farm', 'towncenter', 'wonder', 'dyke', 'thornwall', 'garden', 'orchard', 'channel', 'hive', 'sluice', 'causeway', 'tidemill', 'cockler', 'tidegate', 'heart', 'bridge', 'dam', 'pontoon', 'spire'];

function roleStyle(type: BuildingType, epoch: number, st: Style): Style {
  const r = ROOFS[type];
  return r && epoch >= 1 ? { ...st, roof: r[0], roof2: r[1] } : st;
}

/** A rim of the owner's colour round the pad and a tall pennant at the front corner, so whose a building is reads from above. */
function teamMarks(k: Kit, type: BuildingType): void {
  const n = BUILDINGS[type].size;
  k.team(k.box(n + 0.08, 0.1, n + 0.08, TEAM, 0, -0.07, 0));
  banner(k, n / 2 - 0.12, 0, n / 2 - 0.45, 1.1 + n * 0.3, 1.3);
  // A team-cloth awning over the front: the one big mass of the owner's colour, readable from the default zoom.
  const w = Math.min(n * 0.5, 1.6);
  const z = n / 2 - 0.2;
  for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) k.cyl(0.02, 0.025, 0.42, 4, '#5b4330', x, 0, z);
  const cloth = k.team(k.box(w, 0.04, 0.34, TEAM, 0, 0.42, z));
  cloth.rotation.x = 0.28;
}

/** The baked model of a building in an epoch, in a player's color (`variant`: which way a wall piece joins its neighbors). */
export function buildingGeometry(type: BuildingType, epochIn: number, color: string, variant = 0, age?: AgeId, heirloom = ''): THREE.BufferGeometry {
  // The Atomic Age (#605) has one building of its own; every other model keeps its Industrial shape, in the Atomic palette (#803).
  const epoch = type === 'silo' ? epochIn : Math.min(epochIn, 4);
  const look = age && DRESSED_AGES.includes(age) && type !== 'wall' ? age : undefined;
  const held = heirloom.split(',');
  const marks = heirloomsFor(type).filter((id) => held.includes(id));
  const deep = type === 'towncenter' && held.includes('deep');
  const key = `${type}:${epoch}:${color}:${variant}${look ? ':' + look : ''}${marks.map((m) => ':' + m).join('')}${deep ? ':deep' : ''}`;
  let g = cache.get(key);
  if (!g) {
    const k = new Kit();
    // Every age past the trunk paints its town in its own palette (#803); role roofs still win, so a building's job reads.
    const palette = look ? AGE_PALETTES[look] : undefined;
    const style = roleStyle(type, epoch, palette ? { ...STYLES[Math.min(epoch, 4)], ...palette } : STYLES[Math.min(epoch, 4)]);
    if (type === 'wall') wall(k, epoch, STYLES[Math.min(epoch, 4)], variant);
    else if (type === 'dyke') dyke(k, variant);
    else if (type === 'sluice') sluice(k, variant);
    else if (type === 'bridge') bridge(k, variant);
    else if (type === 'dam') dam(k, variant);
    else if (type === 'channel') channel(k, variant);
    else if (type === 'causeway') causewaySite(k, variant);
    else if (type === 'tidegate') tideGate(k, variant);
    else if (type === 'snare') snare(k, epoch, variant === 1);
    else if (type === 'thornwall') thornwall(k, variant);
    else if (type === 'garden') garden(k, epoch, variant);
    else if (type === 'orchard') orchard(k, epoch, variant);
    else if (type === 'hive') hive(k, epoch, variant);
    else if (type === 'shaft') shaft(k, epoch, style, variant);
    else if (type === 'silo') silo(k, epoch, style, variant);
    else if (look && AGE_SHAPES[look]?.[type]) AGE_SHAPES[look][type](k, style);
    else MAKERS[type](k, epoch, style);
    // A Watch Tower's `variant` is its step on the tower line; a Town Center's 1, that it was knelt from a Behemoth.
    if (type === 'tower' && variant) towerLevel(k, variant);
    if (type === 'towncenter' && variant === 1) kneltShell(k);
    if (!BARE.includes(type)) teamMarks(k, type);
    const stack = STACKS[type];
    if (epoch >= 4 && stack) smokestack(k, stack[0], stack[1], stack[2]);
    if (look) ageTouches(k, type, look);
    for (const m of marks) heirloomTouch(k, m, deep);
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


const sunkCache = new Map<string, THREE.BufferGeometry>();

/** A sunk building's mound (the Age of the Undercity, #883): one shape for every kind, by its size and its people's colour. */
export function sunkGeometry(size: number, color: string): THREE.BufferGeometry {
  const key = `${size}:${color}`;
  let g = sunkCache.get(key);
  if (!g) {
    const k = new Kit();
    sunken(k, size);
    g = bake(k.root, color);
    sunkCache.set(key, g);
  }
  return g;
}
