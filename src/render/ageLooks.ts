import type { Kit } from './kit';
import { BUILDINGS } from '../sim/data';
import type { AgeId, BuildingType } from '../sim/types';

/**
 * Every age has a look of its own (#803; the owner, 2026-10-25: "each age should have a distinct or unique look").
 *
 * Two layers, both baked into a building's one geometry, so no age costs an extra draw:
 * - **A palette** (`AGE_PALETTES`): every age past the five trunk epochs repaints its town's walls, roofs and trim, so a
 *   whole town changes colour when it changes age and a rival reads it from across the map. Role roofs (war slate, trade
 *   teal, faith gold, work ochre) still win over it, so what a building is for keeps reading. Held to `docs/art.md`'s
 *   bands by `tests/age-palettes.test.ts`: roofs dark (L ≤ 0.08) or light (L ≥ 0.37), never green, and trim muted (a trunk
 *   model may lay its trim over whole walls, so a bright trim would paint a town in a team's colour).
 * - **Touches** (`ageLookTouches`): things from the age's own story, set by the door, on the roof or at a corner. The 17
 *   ages dressed before (#55 on) keep theirs in `buildingModels.ts`; the 21 here were the ones still borrowing their
 *   parent epoch's buildings.
 *
 * Fronts face +z. The team awning hangs at the front centre and the pennant at the front right corner, so touches keep to
 * the front left, the sides, the back and the roof line.
 */

export interface AgePalette {
  wall: string;
  wall2: string;
  roof: string;
  roof2: string;
  trim: string;
  base: string;
}

const pal = (wall: string, wall2: string, roof: string, roof2: string, trim: string, base: string): AgePalette => ({ wall, wall2, roof, roof2, trim, base });

/** Each age's walls, roofs and trim. The trunk epochs (Stone to Industrial) keep `STYLES`; every other age is here. */
export const AGE_PALETTES: Partial<Record<AgeId, AgePalette>> = {
  // Tier 1, beside the Bronze Age's mudbrick and dark terracotta.
  chariots: pal('#d8b07a', '#c29c70', '#3a2718', '#2e1f13', '#b59a72', '#a38a66'), // ochre plaster
  iron: pal('#c5b9a4', '#6f6458', '#2e2c2a', '#252321', '#6e5a4e', '#7a7268'), // bog-iron grey
  wild: pal('#d2c09e', '#b49f7a', '#3e2416', '#321c10', '#ede3cc', '#8f7a5c'), // hide walls, bracken roofs, bone
  rivers: pal('#dccaa0', '#c4af84', '#d5c58e', '#c2b07a', '#cdb88a', '#b5a37e'), // sun-dried mud, reed roofs
  hunt: pal('#4a3626', '#3a2a1e', '#d8ccb0', '#c6b99c', '#a89068', '#7a6a52'), // stained leather under pale felt
  steppe: pal('#ece4cf', '#d4c8ac', '#c9b48a', '#b8a27a', '#5a3a30', '#a59878'), // white felt
  // Tier 2, beside the Middle Ages' white plaster and slate.
  mycelium: pal('#d9d2d8', '#bfb6bd', '#c9a9bb', '#bea0b1', '#7a6a72', '#8a8086'), // pale fungus-grey under mauve caps
  merchant: pal('#e9c7a0', '#d4c3a0', '#4a2a12', '#3c220e', '#bfa878', '#a89880'), // warm ochre fronts
  pilgrim: pal('#efebe0', '#d7d1c2', '#36324c', '#2b2840', '#bfae86', '#aaa496'), // pale stone, dusk-violet slate
  sail: pal('#e8e2d2', '#b7ae98', '#1e2e44', '#17253a', '#f2ece0', '#958e80'), // whitewash, navy roofs
  warband: pal('#c2ae90', '#a8957a', '#3a1a16', '#2e1411', '#4a2a24', '#6e5f4c'), // raw hide, blood-dark roofs
  horde: pal('#e4dac4', '#c8b996', '#3a2e26', '#2e241d', '#b8a070', '#a59878'), // felt under smoke-dark domes
  searaider: pal('#3c2e24', '#2e231b', '#b4ab98', '#b2a996', '#c4b08a', '#6c6152'), // tarred timber, silvered shingle
  alchemy: pal('#e6d6bc', '#cbbfa4', '#2a2626', '#221f1f', '#5a2a24', '#9a9080'), // pale walls, black tile
  grove: pal('#e0d6c0', '#c9bc9e', '#d8a070', '#d09a68', '#8a8a68', '#7d6e56'), // pale birch under copper autumn leaves
  missions: pal('#f1ebdc', '#d9cdb4', '#5e2b1c', '#4c2316', '#5c6c78', '#b3a68e'), // whitewashed adobe, clay tile
  dykes: pal('#5e2a20', '#efe9dc', '#2b2b30', '#222226', '#f1ece0', '#7f786e'), // dark Holland brick, white gables
  beggars: pal('#3a4650', '#2e3840', '#cbbfa6', '#b6aa90', '#b89a70', '#6c6356'), // slate-blue planking, sailcloth
  // Tier 3, beside the Gunpowder Age's red brick.
  golden: pal('#f1e7cf', '#dacaa0', '#e2c06a', '#d8b86c', '#c8b68a', '#b5a27a'), // cream and gilt
  fair: pal('#efe3cb', '#d8c9a8', '#5a2436', '#481c2b', '#c9b47a', '#9a8d78'), // wine roofs
  silk: pal('#ead9b8', '#c9b088', '#3e1c16', '#30150f', '#6a2a20', '#a48d6c'), // lacquer-dark roofs and beams
  ironblood: pal('#3f3a37', '#2f2b29', '#b9b2a6', '#aea79a', '#3a1c1e', '#5d5650'), // black iron, lead roofs
  reclaimer: pal('#d5cbb3', '#8f8a7c', '#3a302a', '#2e2621', '#7a6a5e', '#7f7a6e'), // salvaged stone, rust
  hive: pal('#efdfae', '#d9c48c', '#d9b968', '#d0b066', '#a89068', '#a8925e'), // wax walls, skep-straw roofs
  sapper: pal('#cbb68a', '#a8946a', '#34322c', '#2a2823', '#5f513a', '#8a7c60'), // sandbag and soot
  waterline: pal('#ebe5d8', '#c9c2b2', '#25303d', '#1d2631', '#5a6878', '#8f9095'), // white
  // Tier 4, beside the Industrial Age's dark brick.
  aeronaut: pal('#e9e6df', '#c2cbd0', '#2b3a48', '#223040', '#a8c0c6', '#9aa0a2'),
  lightning: pal('#d9d4cb', '#4a4c52', '#2a2c33', '#202228', '#9a8068', '#7a7a7c'), // copper-brown on iron
  totalwar: pal('#bfbcb2', '#9f9c92', '#2a2c2e', '#222426', '#4a3a36', '#6e6c66'), // poured concrete
  hemocraft: pal('#e6dcd6', '#c2b4ac', '#3c1218', '#300e13', '#4a2226', '#968a84'), // clinical pale, blood roofs
  bloodrite: pal('#1e1a1a', '#2a2424', '#d8ccb6', '#c4b69c', '#3a2224', '#4c4440'), // basalt and bone
  wildwood: pal('#d2c1a2', '#6b5440', '#2c2216', '#221a10', '#a08a6a', '#6f604c'), // peeled wood, leaf-litter roofs
  locks: pal('#cdb88e', '#b39d74', '#2b2f35', '#22262b', '#1f2124', '#8c8478'), // yellow stock brick, cast iron
  // Tier 5.
  atomic: pal('#c9c7c0', '#a9a8a2', '#2c3034', '#23272b', '#b8ac80', '#8e8c86'), // concrete
  fission: pal('#3c4650', '#323a42', '#d4d2ca', '#c0beb4', '#a89e7a', '#6a7078'), // steel halls, pale concrete roofs
  fusion: pal('#eef1f3', '#c9d3da', '#1d2836', '#16202c', '#b8ccd4', '#a7b0b8'), // white
  bloom: pal('#e6dccb', '#cdbfa6', '#e3aebd', '#d697aa', '#7a4a5a', '#a89a84'), // petal roofs
  leviathans: pal('#2a3236', '#20272a', '#d9d0bc', '#c6bca6', '#7f9aa3', '#5f6a6c'), // sea-dark walls, whalebone roofs
  tides: pal('#8fa3ad', '#7d9099', '#d8cdb0', '#c8bc9e', '#dcd7c5', '#7e8a8e'), // sea-washed stone, sand-pale roofs
  floating: pal('#d9c47c', '#c4b072', '#cfb76e', '#bba25c', '#5a4430', '#a8955e'), // totora reed
};

/** The ages whose touches live in this file. */
export const NEW_LOOK_AGES: AgeId[] = [
  'atomic', 'fission', 'fusion', 'alchemy', 'sapper', 'searaider', 'chariots', 'wild', 'grove', 'hive', 'wildwood', 'bloom', 'leviathans',
  'missions', 'dykes', 'rivers', 'tides', 'waterline', 'locks', 'floating', 'beggars', 'hunt', 'mycelium',
];

/** Buildings that take touches: the town's own halls and houses. Water works, walls, fields and one-tile pieces keep their shape. */
const TOWN: BuildingType[] = [
  'towncenter', 'house', 'storehouse', 'barracks', 'range', 'stable', 'forge', 'workshop', 'temple', 'market', 'dock', 'wonder', 'huntcamp',
  'prospector', 'den', 'mission', 'caravanserai', 'windmill', 'bloomery', 'stockade', 'gallery', 'tidemill', 'cockler', 'battery', 'warcamp', 'greatden', 'airfield', 'tower',
];
const GREAT: BuildingType[] = ['towncenter', 'wonder', 'temple', 'market'];

/** Where touches sit on a building: `h` its half width, `f` its front line, `l` its front-left corner's x, `e` its eave. */
function frame(type: BuildingType): { n: number; h: number; f: number; l: number; e: number; big: boolean } {
  const n = BUILDINGS[type].size;
  const h = n / 2 - 0.3;
  const e = type === 'house' ? 0.8 : type === 'towncenter' ? 1.35 : type === 'wonder' ? 2.2 : type === 'tower' ? 2.0 : n <= 2 ? 0.9 : 1.15;
  return { n, h, f: n / 2 - 0.12, l: -h, e, big: type === 'towncenter' || type === 'wonder' };
}

const WOOD = '#7a5636';
const DARK = '#2e2a26';
const BRONZE = '#b07a3a';
const REED = '#cdb46c';
const REED_DARK = '#a8904e';
const BONE = '#ece3cc';
const SANDBAG = '#b2a27a';
const CONCRETE = '#b9b7b0';
const HAZARD = '#e0b830';
const CYAN = '#7fe6ff';
const AMBER = '#ffb24a';
const LEAF = '#4f7a3a';
const WHITE = '#efeae0';

/** A barrel on its end: a keg, a water butt or a tar barrel. */
function keg(k: Kit, x: number, z: number, r = 0.11, color = '#6a4a2e'): void {
  k.cyl(r * 0.85, r * 0.85, r * 2.2, 7, color, x, 0, z);
  for (const y of [r * 0.4, r * 1.7]) k.cyl(r * 0.9, r * 0.9, r * 0.18, 7, '#3a3a3a', x, y, z);
}

/** A wheel standing upright in the x-y plane (facing front), its hub at (x, y, z). */
function wheel(k: Kit, x: number, y: number, z: number, r: number, color: string, spokes = 4): void {
  const rim = k.ring(r, r * 0.09, color, y);
  rim.rotation.x = 0;
  rim.position.set(x, y, z);
  for (let i = 0; i < spokes; i++) {
    // A box's geometry is centred on its mesh, so set at the hub it turns about it.
    const s = k.box(0.025, r * 2, 0.025, color);
    s.position.set(x, y, z);
    s.rotation.z = (i * Math.PI) / spokes;
  }
}

/** A pole with a cloth of horizontal bands (top first) that flies in the wind. */
function bandFlag(k: Kit, x: number, z: number, h: number, bands: string[], w = 0.42): void {
  k.cyl(0.022, 0.028, h, 5, '#4a3626', x, 0, z);
  const bh = 0.09;
  bands.forEach((c, i) => k.cloth(k.box(0.012, bh, w, c, x, h - 0.06 - (i + 1) * bh, z + w / 2), w, z));
}

/** A curved bone (a rib, a tusk) of `n` straight pieces rising from (x, z) and arching toward +x by `lean`. */
function rib(k: Kit, x: number, z: number, len: number, lean: number, color = BONE, n = 4): void {
  let px = x;
  let py = 0;
  for (let i = 0; i < n; i++) {
    const a = (lean * (i + 0.5)) / n;
    const l = len / n;
    const seg = k.cyl(0.045 - i * 0.006, 0.05 - i * 0.006, l, 5, color, 0, 0, 0);
    seg.geometry.translate(0, l / 2, 0);
    seg.position.set(px, py, z);
    seg.rotation.z = -a;
    px += Math.sin(a) * l;
    py += Math.cos(a) * l;
  }
}

/** Touches for the ages of `NEW_LOOK_AGES`; returns whether `age` is one of them. */
export function ageLookTouches(k: Kit, type: BuildingType, age: AgeId): boolean {
  if (!NEW_LOOK_AGES.includes(age)) return false;
  if (!TOWN.includes(type)) return true;
  const { h, f, l, e, big } = frame(type);
  const great = GREAT.includes(type);
  switch (age) {
    case 'atomic': {
      // The 1950s: a low blast wall with a civil-defence band by the door, an aerial on every roof, a radar dish over the great halls.
      k.box(0.7, 0.32, 0.12, CONCRETE, l + 0.35, 0, f);
      k.box(0.7, 0.06, 0.125, HAZARD, l + 0.35, 0.22, f);
      k.cyl(0.015, 0.015, 0.7, 4, DARK, -h * 0.5, e, -h * 0.5);
      for (const y of [0.45, 0.6]) k.box(0.36, 0.015, 0.015, DARK, -h * 0.5, e + y, -h * 0.5);
      if (great || type === 'barracks' || type === 'battery') {
        const mx = -h - 0.1;
        const mz = -h + 0.2;
        for (const [dx, dz] of [[-0.12, -0.12], [0.12, -0.12], [0, 0.12]]) k.cyl(0.018, 0.026, e + 0.8, 4, '#5a5e64', mx + dx, 0, mz + dz);
        const dish = k.dome(0.42, '#dcdad4', mx, e + 0.95, mz);
        dish.scale.set(1, 0.35, 1);
        dish.rotation.x = -0.9;
        k.cyl(0.012, 0.012, 0.3, 4, DARK, mx, e + 0.95, mz + 0.05).rotation.x = -0.9;
      }
      if (type === 'towncenter') {
        // The air-raid siren on its pole.
        k.cyl(0.03, 0.04, e + 1.4, 5, '#5a5e64', h + 0.05, 0, -h + 0.2);
        for (const d of [-1, 1]) k.cone(0.12, 0.28, 8, '#c9c7c0', h + 0.05 + d * 0.14, e + 1.3, -h + 0.2).rotation.z = (d * Math.PI) / 2;
      }
      break;
    }
    case 'fission': {
      // A cooling tower's waist behind the great halls, and black-and-yellow hazard bands round the foot of every wall.
      const n = 6;
      const w = (h * 2) / n;
      for (let i = 0; i < n; i++) k.box(w, 0.1, 0.05, i % 2 ? '#1e1e1e' : HAZARD, -h + w * (i + 0.5), 0.05, f);
      if (great || type === 'forge' || type === 'workshop') {
        const r = big ? 0.6 : 0.42;
        k.lathe([[r, 0], [r * 0.72, r * 1.4], [r * 0.66, r * 1.9], [r * 0.78, r * 2.6]], 12, '#d7d5ce', -h, 0, -h);
        for (const [dy, sr] of [[0.15, 0.55], [0.5, 0.45]]) k.blob(r * sr, '#eef0f0', -h, r * 2.6 + r * dy, -h).scale.set(1, 0.6, 1);
      } else {
        k.glow(k.box(0.14, 0.14, 0.02, '#ffe27a', l + 0.2, e * 0.55, f + 0.01));
      }
      break;
    }
    case 'fusion': {
      // The star in a bottle: a glowing ring held over the great halls on three pylons, a smaller ring on every front.
      if (great) {
        const r = big ? 0.75 : 0.5;
        const y = e + (big ? 1.5 : 1.1);
        for (const a of [0, 2.1, 4.2]) k.cyl(0.03, 0.04, y, 4, '#c9d3da', Math.cos(a) * r * 1.2, 0, Math.sin(a) * r * 1.2 - 0.3);
        const ring = k.glow(k.ring(r, 0.07, CYAN, y));
        ring.position.z = -0.3;
        k.glow(k.sphere(0.12, '#e8fbff', 0, y - 0.06, -0.3));
      } else {
        const ring = k.glow(k.ring(0.18, 0.035, CYAN, e * 0.6));
        ring.rotation.x = 0;
        ring.position.set(l + 0.3, e * 0.6, f + 0.02);
        k.cyl(0.02, 0.02, e + 0.5, 4, '#c9d3da', -h, 0, -h);
        k.glow(k.octa(0.06, CYAN, -h, e + 0.55, -h));
      }
      break;
    }
    case 'alchemy': {
      // The alchemist's bench by the door: a copper still with its neck and pipe, a flask aglow, and a cinnabar-banded chimney.
      k.box(0.55, 0.32, 0.3, WOOD, l + 0.3, 0, f - 0.1);
      k.sphere(0.13, '#c27a3e', l + 0.18, 0.44, f - 0.1);
      k.cone(0.07, 0.25, 6, '#c27a3e', l + 0.18, 0.53, f - 0.1);
      k.cyl(0.015, 0.015, 0.4, 4, '#c27a3e', l + 0.36, 0.62, f - 0.1).rotation.z = -1.1;
      k.glow(k.sphere(0.07, '#8af0a0', l + 0.48, 0.38, f - 0.1));
      k.cyl(0.13, 0.15, e + 0.75, 6, '#8a8278', -h * 0.6, 0, -h * 0.6);
      k.cyl(0.14, 0.14, 0.09, 6, '#a8352c', -h * 0.6, e + 0.6, -h * 0.6);
      if (great) k.glow(k.octa(0.09, '#ffd27a', -h * 0.6, e + 0.95, -h * 0.6));
      break;
    }
    case 'sapper': {
      // A siege yard: sandbags banked along the front, timber shoring against the side, powder kegs by the door.
      for (let i = 0; i < 4; i++) k.blob(0.13, SANDBAG, l + 0.12 + i * 0.22, 0.06, f).scale.set(1, 0.55, 0.75);
      for (let i = 0; i < 3; i++) k.blob(0.13, '#a69670', l + 0.23 + i * 0.22, 0.17, f).scale.set(1, 0.55, 0.75);
      for (const z of [-h * 0.5, h * 0.3]) k.box(0.07, e + 0.2, 0.07, '#6a5038', -h - 0.2, 0, z).rotation.z = 0.32;
      keg(k, l + 0.15, f - 0.45, 0.1, '#4e3a28');
      keg(k, l + 0.38, f - 0.5, 0.1, '#4e3a28');
      break;
    }
    case 'searaider': {
      // Out of the fjords: painted round shields along the side wall, dragon heads crossed at the gable, a prow beached by the hall.
      const shields = ['#8a3a2a', '#e0d6bc', '#c8a24a', '#3a4a5a'];
      const m = big ? 5 : 3;
      for (let i = 0; i < m; i++) {
        const s = k.cyl(0.16, 0.16, 0.03, 8, shields[i % 4], h + 0.12, e * 0.5, -h + 0.25 + (i * (h * 2 - 0.5)) / Math.max(1, m - 1));
        s.rotation.z = Math.PI / 2;
        k.sphere(0.04, '#9a9aa0', h + 0.14, e * 0.5, s.position.z);
      }
      for (const d of [-1, 1]) {
        const b = k.box(0.06, 0.6, 0.06, '#3a2a1e', d * 0.12, e + 0.25, f - 0.15);
        b.rotation.z = d * 0.55;
        k.box(0.08, 0.08, 0.16, '#3a2a1e', d * 0.33, e + 0.72, f - 0.1);
      }
      if (type === 'towncenter' || type === 'dock' || type === 'wonder') {
        for (let i = 0; i < 5; i++) k.box(0.1, 0.12, 0.3, '#4a3626', l - 0.1, i * 0.1 + i * i * 0.02, f + 0.1 - i * 0.12);
        k.box(0.12, 0.14, 0.18, '#4a3626', l - 0.1, 0.78, f - 0.42);
      }
      break;
    }
    case 'chariots': {
      // A spare spoked wheel against the front, and over the halls a standard: a horse's head and a bronze sun-disc.
      wheel(k, l + 0.3, 0.32, f + 0.04, 0.3, '#5a3a22', 4);
      k.cyl(0.04, 0.04, 0.05, 6, BRONZE, l + 0.3, 0.32, f + 0.04).rotation.x = Math.PI / 2;
      if (great || type === 'stable' || type === 'barracks') {
        const x = -h - 0.15;
        const z = -h + 0.1;
        k.cyl(0.025, 0.03, e + 1.2, 5, '#4a3626', x, 0, z);
        const disc = k.cyl(0.2, 0.2, 0.03, 12, BRONZE, x, e + 1.25, z);
        disc.rotation.x = Math.PI / 2;
        k.box(0.08, 0.24, 0.1, BRONZE, x, e + 0.95, z + 0.04).rotation.x = -0.4;
        k.box(0.07, 0.07, 0.14, BRONZE, x, e + 1.13, z + 0.12);
      }
      break;
    }
    case 'wild': {
      // A people that keeps company with beasts: antlers over the door, bone posts at the corners, a hide stretched to dry.
      for (const d of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const t = k.cyl(0.012, 0.022, 0.32 - i * 0.06, 4, BONE, d * (0.06 + i * 0.07), e + 0.05 + i * 0.07, f + 0.02);
          t.rotation.z = -d * (0.5 + i * 0.25);
        }
      }
      for (const x of [-h - 0.05, h + 0.05]) {
        k.cyl(0.04, 0.05, 0.6, 5, BONE, x, 0, f);
        k.sphere(0.06, BONE, x, 0.62, f);
      }
      const fx = -h - 0.35;
      for (const z of [-0.35, 0.35]) k.cyl(0.02, 0.024, 0.95, 4, WOOD, fx, 0, z);
      k.box(0.02, 0.02, 0.8, WOOD, fx, 0.9, 0);
      k.box(0.03, 0.55, 0.6, '#b08a5a', fx, 0.28, 0);
      break;
    }
    case 'grove': {
      // A people that grows what others build: a living tree grown into the back corner, vines down the front corners.
      const tx = -h + 0.05;
      const tz = -h + 0.05;
      k.cyl(0.1, 0.15, e + 0.6, 6, '#5a4228', tx, 0, tz);
      for (const [dx, dy, dz, r] of [[0, 0.75, 0, 0.42], [0.25, 0.55, 0.15, 0.3], [-0.2, 0.6, 0.2, 0.32]] as const) k.blob(r, LEAF, tx + dx, e + dy, tz + dz);
      for (const x of [-h, h - 0.25]) {
        k.box(0.06, e * 0.9, 0.04, '#3e6a32', x, e * 0.05, f + 0.02);
        k.sphere(0.04, '#f2e6f0', x + 0.04, e * 0.55, f + 0.04);
      }
      break;
    }
    case 'hive': {
      // Straw skeps on a bench by the door and a honeycomb plaque on the front.
      k.box(0.6, 0.18, 0.24, WOOD, l + 0.32, 0, f - 0.05);
      for (let i = 0; i < 3; i++) {
        const x = l + 0.12 + i * 0.2;
        k.lathe([[0.09, 0], [0.095, 0.08], [0.08, 0.15], [0.05, 0.21], [0.0, 0.24]], 8, '#d8b860', x, 0.18, f - 0.05);
        k.box(0.03, 0.025, 0.02, '#2a1e10', x, 0.2, f + 0.04);
      }
      const comb = k.cyl(0.14, 0.14, 0.03, 6, '#d69a2c', -l - 0.45, e * 0.62, f + 0.03);
      comb.rotation.x = Math.PI / 2;
      if (great) for (const [dx, dy] of [[-0.25, 0], [0.25, 0], [0, 0.22]]) {
        const c = k.cyl(0.11, 0.11, 0.03, 6, '#e4b24a', dx, e + 0.15 + dy, f + 0.03);
        c.rotation.x = Math.PI / 2;
      }
      break;
    }
    case 'wildwood': {
      // The forest wakes: roots grip the corners, moss lies along the eaves, and a knot-hollow glows amber by the door.
      for (const [x, z] of [[-h, f - 0.1], [h - 0.1, -h], [-h, -h]] as const) {
        for (let i = 0; i < 3; i++) {
          const r = k.cyl(0.03, 0.06, 0.55, 5, '#4e3a26', x + (i - 1) * 0.1, 0, z);
          r.rotation.z = (i - 1) * 0.6;
          r.rotation.x = 0.3;
        }
      }
      for (let i = 0; i < 4; i++) k.blob(0.12, '#5a7a3a', -h + i * ((h * 2) / 3), e, f - 0.2).scale.set(1.3, 0.45, 1);
      k.glow(k.octa(0.07, AMBER, l + 0.3, e * 0.5, f + 0.04));
      break;
    }
    case 'bloom': {
      // The plants' end: flowering vines over the eaves, and a blossom crown over the great halls.
      const petals = ['#f2b8c8', '#f6f0f2', '#f2d27a'];
      for (let i = 0; i < 7; i++) k.sphere(0.07, petals[i % 3], -h + (i * h * 2) / 6, e + 0.04 + (i % 2) * 0.06, f - 0.05);
      for (const x of [-h, -h + 0.18]) k.box(0.05, e, 0.04, '#4a6e38', x, 0, f + 0.02);
      if (great) {
        const y = e + (big ? 1.2 : 0.85);
        k.cyl(0.05, 0.08, y, 5, '#4a6e38', 0, 0, -0.3);
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          k.sphere(0.2, '#f2b8c8', Math.cos(a) * 0.28, y, Math.sin(a) * 0.28 - 0.3).scale.set(1, 0.45, 1);
        }
        k.glow(k.sphere(0.13, '#ffe28a', 0, y + 0.05, -0.3));
      }
      break;
    }
    case 'leviathans': {
      // The beasts' end: whale ribs arch over the door, and a great jawbone gate before the Town Center.
      for (const d of [-1, 1]) rib(k, d * 0.42, f + 0.08, e + 0.45, -d * 0.5);
      for (let i = 0; i < 3; i++) k.sphere(0.05, '#b8b0a0', l + 0.1 + i * 0.09, 0.08 + (i % 2) * 0.06, f + 0.02);
      if (big) for (const d of [-1, 1]) rib(k, d * 1.1, f + 0.6, e + 1.4, -d * 0.7, '#f2ead6', 6);
      break;
    }
    case 'missions': {
      // A bell gable (espadaña) beside the great halls: a whitewashed stepped wall with a bronze bell in its arch and a small
      // cross above; houses keep blue-painted shutters.
      if (great || type === 'mission') {
        const x = l - 0.05;
        const z = f - 0.2;
        k.box(0.62, e + 0.55, 0.16, '#f1ebdc', x, 0, z);
        k.box(0.36, 0.3, 0.16, '#f1ebdc', x, e + 0.55, z);
        k.box(0.22, 0.28, 0.17, '#2a2420', x, e + 0.18, z);
        k.lathe([[0.0, 0], [0.09, 0.01], [0.075, 0.1], [0.04, 0.18], [0.0, 0.2]], 8, BRONZE, x, e + 0.18, z);
        k.box(0.035, 0.24, 0.035, '#3a3028', x, e + 0.85, z);
        k.box(0.14, 0.035, 0.035, '#3a3028', x, e + 0.99, z);
      } else {
        for (const d of [-1, 1]) k.box(0.1, 0.22, 0.02, '#3a6a8a', l + 0.3 + d * 0.13, e * 0.45, f + 0.02);
      }
      break;
    }
    case 'dykes': {
      // A Holland gable: white-edged steps climbing the front above the eave, and a weathervane on top.
      const w = big ? 1.2 : type === 'house' ? 0.7 : 0.9;
      for (let i = 0; i < 4; i++) {
        const sw = w * (1 - i * 0.22);
        k.box(sw, 0.2, 0.1, '#5e2a20', 0, e + i * 0.2, f - 0.25);
        // Pale stone caps only where each step ends, as on a Holland gable.
        for (const d of [-1, 1]) k.box(0.09, 0.05, 0.12, '#f1ece0', d * (sw / 2 - 0.045), e + i * 0.2 + 0.2, f - 0.25);
      }
      k.cyl(0.012, 0.012, 0.3, 4, DARK, 0, e + 0.8, f - 0.25);
      k.box(0.2, 0.06, 0.012, DARK, 0.06, e + 1.02, f - 0.25);
      k.glow(k.box(0.12, 0.14, 0.02, '#ffd68a', 0, e + 0.3, f - 0.19));
      break;
    }
    case 'rivers': {
      // The first river towns: bound-reed columns flanking the door, a water jar and a little blue trough fed from the channel.
      for (const x of [-0.42, 0.42]) {
        k.cyl(0.08, 0.1, e + 0.25, 7, REED, x, 0, f + 0.02);
        for (const y of [0.25, 0.55, e]) k.cyl(0.085, 0.085, 0.04, 7, REED_DARK, x, y, f + 0.02);
      }
      k.lathe([[0.06, 0], [0.13, 0.1], [0.12, 0.24], [0.06, 0.32], [0.07, 0.36]], 8, '#b86a42', l + 0.05, 0, f - 0.05);
      k.box(0.5, 0.1, 0.18, '#8a7a5a', -h * 0.3 - 0.1, 0, f + 0.25);
      k.box(0.44, 0.02, 0.12, '#3d6f86', -h * 0.3 - 0.1, 0.09, f + 0.25);
      if (big) {
        // A mudhif's ribbed reed arch out from the hall's flank.
        for (let i = 0; i < 4; i++) {
          const a = k.ring(0.55, 0.05, REED, 0.0);
          a.rotation.x = 0;
          a.rotation.y = Math.PI / 2;
          a.position.set(-h - 0.4 + 0.0, 0.0, -h + 0.3 + i * 0.45);
        }
      }
      break;
    }
    case 'waterline': {
      // The year of disaster's watch: a white flood gauge marked in blue, a sluice wheel on its post, a punt drawn up alongside.
      const gx = l + 0.05;
      k.box(0.08, e + 0.4, 0.08, WHITE, gx, 0, f);
      for (let i = 1; i <= 4; i++) k.box(0.085, 0.04, 0.085, '#2f5679', gx, i * ((e + 0.4) / 5), f);
      k.cyl(0.03, 0.03, 0.55, 5, DARK, gx + 0.35, 0, f);
      wheel(k, gx + 0.35, 0.55, f + 0.05, 0.16, '#2a2a2a', 3);
      k.box(0.3, 0.1, 1.0, '#5a4430', h + 0.35, 0, 0);
      k.box(0.24, 0.02, 0.9, '#3a2c20', h + 0.35, 0.09, 0);
      break;
    }
    case 'locks': {
      // The canal age: a lock gate's black-and-white balance beam, a capstan, and a lamp by the door.
      const bx = l + 0.1;
      k.box(0.1, 0.4, 0.1, DARK, bx, 0, f);
      for (let i = 0; i < 6; i++) k.box(0.18, 0.08, 0.08, i % 2 ? '#1f2124' : WHITE, bx + 0.08 + i * 0.17, 0.42, f);
      k.cyl(0.11, 0.13, 0.28, 8, '#3a3c40', -h * 0.4, 0, f + 0.15);
      for (const a of [0, Math.PI / 2]) k.box(0.48, 0.03, 0.03, WOOD, -h * 0.4, 0.3, f + 0.15).rotation.y = a;
      k.cyl(0.02, 0.025, e + 0.3, 5, '#1f2124', -h - 0.1, 0, f - 0.1);
      k.glow(k.box(0.09, 0.12, 0.09, '#ffd68a', -h - 0.1, e + 0.3, f - 0.1));
      break;
    }
    case 'tides': {
      // Keeping the sea's hours: a striped tide gauge, wrack along the foot of the walls, bollards, and a tide bell over the halls.
      const gx = l + 0.02;
      for (let i = 0; i < 6; i++) k.box(0.07, 0.15, 0.07, i % 2 ? '#2a3a46' : WHITE, gx, i * 0.15, f + 0.02);
      for (let i = 0; i < 5; i++) k.box(0.18, 0.05, 0.05, '#4a4a2e', -h + 0.3 + i * ((h * 2 - 0.6) / 4), 0, f + 0.03).rotation.y = (i % 2) * 0.3;
      for (const x of [h * 0.2, h * 0.55]) {
        k.cyl(0.06, 0.07, 0.22, 7, '#2a2c2e', x, 0, f + 0.25);
        k.cyl(0.08, 0.08, 0.04, 7, '#2a2c2e', x, 0.22, f + 0.25);
      }
      if (great) {
        const x = -h - 0.1;
        const z = -h + 0.3;
        for (const dz of [-0.2, 0.2]) k.box(0.06, e + 0.7, 0.06, '#5a5048', x, 0, z + dz);
        k.box(0.08, 0.06, 0.5, '#5a5048', x, e + 0.7, z);
        k.lathe([[0.0, 0], [0.12, 0.01], [0.1, 0.14], [0.05, 0.25], [0.0, 0.27]], 8, BRONZE, x, e + 0.4, z);
      }
      break;
    }
    case 'floating': {
      // A town that floats: bundled totora reed lashed under every side of the pad, and a reed boat moored alongside.
      const { n } = frame(type);
      for (const s of [-1, 1]) {
        const a = k.cyl(0.14, 0.14, n - 0.1, 7, REED, 0, 0, 0);
        a.rotation.x = Math.PI / 2;
        a.position.set(s * (n / 2 - 0.08), 0.0, 0);
        const b = k.cyl(0.14, 0.14, n - 0.1, 7, REED_DARK, 0, 0, 0);
        b.rotation.z = Math.PI / 2;
        b.position.set(0, 0.0, s * (n / 2 - 0.08));
      }
      const bx = h + 0.5;
      const boat = k.cyl(0.13, 0.13, 1.0, 7, REED, 0, 0, 0);
      boat.rotation.x = Math.PI / 2;
      boat.position.set(bx, 0.08, 0);
      for (const d of [-1, 1]) k.cone(0.12, 0.3, 7, REED, bx, 0.08, d * 0.5).rotation.x = (d * Math.PI) / 2;
      if (big) for (let i = 0; i < 3; i++) {
        const r = k.ring(0.5, 0.05, REED, 0.0);
        r.rotation.x = 0;
        r.position.set(-h + 0.6 + i * 0.4, 0.0, f + 0.2);
      }
      break;
    }
    case 'hunt': {
      // Hounds and hawks: a T-perch with a hooded hawk by the door, a wolf pelt over the side, a tether stake and its ring.
      const px = l + 0.1;
      k.cyl(0.02, 0.025, e + 0.2, 5, '#4a3626', px, 0, f);
      k.box(0.3, 0.03, 0.03, '#4a3626', px, e + 0.2, f);
      k.blob(0.07, '#7a5a3a', px + 0.06, e + 0.29, f).scale.set(0.8, 1.2, 0.9);
      k.sphere(0.035, '#3a2a1e', px + 0.06, e + 0.39, f + 0.01);
      k.box(0.04, 0.5, 0.5, '#8a8478', h + 0.12, e * 0.35, 0);
      k.box(0.05, 0.1, 0.16, '#8a8478', h + 0.12, e * 0.35 + 0.45, 0.2);
      k.cyl(0.02, 0.02, 0.3, 4, WOOD, -h * 0.3, 0, f + 0.3);
      const ring = k.ring(0.05, 0.012, '#5a5a5a', 0.28);
      ring.position.set(-h * 0.3, 0.28, f + 0.3);
      if (great || type === 'stable') bandFlag(k, -h - 0.1, -h + 0.1, e + 1.0, ['#d8ccb0', '#4a3626'], 0.36);
      break;
    }
    case 'mycelium': {
      // A people that lives on the fungus: shelf fungi up the walls, glowcaps at the foot, pale threads out over the ground.
      for (const [x, y] of [[-h + 0.1, e * 0.35], [-h + 0.35, e * 0.6], [h - 0.45, e * 0.45]] as const) {
        const b = k.cyl(0.13, 0.15, 0.05, 9, '#d8c8b0', x, y, f + 0.02);
        b.scale.set(1, 1, 0.55);
      }
      for (const [x, z, r] of [[l + 0.05, f + 0.1, 0.07], [l + 0.22, f + 0.18, 0.05], [l + 0.4, f + 0.08, 0.06], [h - 0.2, -h + 0.1, 0.07]] as const) {
        k.cyl(0.015, 0.02, r * 1.4, 5, '#ece6dc', x, 0, z);
        k.glow(k.dome(r, '#9af0d0', x, r * 1.4, z)).scale.set(1, 0.6, 1);
      }
      for (let i = 0; i < 5; i++) {
        const t = k.box(0.02, 0.012, 0.6 + (i % 2) * 0.3, '#eee8e0', -h + i * (h / 2), 0.005, f + 0.35);
        t.rotation.y = (i - 2) * 0.35;
      }
      break;
    }
    case 'beggars': {
      // The Watergeuzen: the Prince's flag of orange, white and blue at the back corner, a grapnel and its coil by the door.
      bandFlag(k, -h - 0.1, -h + 0.1, e + (big ? 1.6 : 1.1), ['#d8782a', '#f2ece0', '#2f4f8a'], big ? 0.55 : 0.42);
      const gx = l + 0.25;
      k.cyl(0.11, 0.11, 0.08, 9, '#b8a27a', gx, 0, f - 0.05);
      k.cyl(0.015, 0.015, 0.4, 4, '#3a3a3a', gx + 0.2, 0, f);
      for (let i = 0; i < 3; i++) k.cone(0.02, 0.14, 4, '#3a3a3a', gx + 0.2, 0.35, f).rotation.z = ((i - 1) * Math.PI) / 3;
      if (type === 'dock' || big) k.glow(k.box(0.1, 0.14, 0.1, '#ffc46b', h + 0.15, e * 0.8, f - 0.1));
      break;
    }
  }
  return true;
}

// ---- People who wear their age (#803 s2) ----------------------------------------------------------
// A town's people dress for its age too, so an army or a work crew reads like the town it came from. Citizens wear the age's
// hat in place of their epoch's (a team band kept round it, so whose worker it is still reads); foot soldiers, archers and
// priests keep their helmets and hoods and wear a scarf in the town's colours. Heads sit at y 0.5 (radius 0.066), facing +z.

/** The lines that wear their age: a hat for citizens, a scarf for the rest. */
export const WEAR_LINES: string[] = ['citizen', 'infantry', 'ranged', 'priest'];

const TEAM_WHITE = '#f4f4f4';

const brim = (k: Kit, r: number, col: string, y = 0.545) => k.cyl(r, r, 0.012, 12, col, 0, y, 0);
const crown = (k: Kit, r: number, h: number, col: string, y = 0.55) => k.cyl(r * 0.88, r, h, 10, col, 0, y, 0);
const cap = (k: Kit, col: string, r = 0.071) => k.sphere(r, col, 0, 0.53, -0.008).scale.set(1, 0.78, 1.02);
const band = (k: Kit, y = 0.545, r = 0.072) => k.team(k.cyl(r, r, 0.016, 10, TEAM_WHITE, 0, y, 0));

/** Each age's hat for its citizens. */
const HATS: Partial<Record<AgeId, (k: Kit) => void>> = {
  chariots: (k) => { cap(k, '#a8783a'); band(k); },
  iron: (k) => { cap(k, '#4a4a4e'); band(k); },
  wild: (k) => {
    band(k, 0.53);
    for (const d of [-1, 1]) for (let i = 0; i < 2; i++) k.cyl(0.006, 0.01, 0.1 - i * 0.03, 4, BONE, d * (0.04 + i * 0.025), 0.56 + i * 0.03, 0).rotation.z = -d * (0.35 + i * 0.5);
  },
  rivers: (k) => { k.cone(0.14, 0.07, 10, REED, 0, 0.55, 0); band(k, 0.54, 0.07); },
  hunt: (k) => { crown(k, 0.074, 0.05, '#6a5038'); k.cone(0.01, 0.12, 4, '#8a7a62', 0.05, 0.56, -0.04).rotation.z = -0.6; band(k, 0.55, 0.075); },
  mycelium: (k) => { k.dome(0.11, '#c9a9bb', 0, 0.535, 0).scale.set(1, 0.55, 1); for (const [x, z] of [[0.04, 0.04], [-0.05, 0.02], [0.0, -0.06]]) k.sphere(0.014, '#efe8dc', x, 0.585, z); band(k, 0.527, 0.07); },
  steppe: (k) => { crown(k, 0.07, 0.07, '#ece4cf'); k.cyl(0.078, 0.078, 0.025, 10, '#6a4a32', 0, 0.54, 0); band(k, 0.565, 0.066); },
  merchant: (k) => { cap(k, '#7a3a2a', 0.074); band(k); },
  pilgrim: (k) => { brim(k, 0.13, '#3a3430'); crown(k, 0.06, 0.045, '#3a3430'); k.sphere(0.022, '#efe6d2', 0, 0.575, 0.05); band(k, 0.556, 0.062); },
  sail: (k) => { cap(k, '#24344c'); band(k); },
  warband: (k) => { cap(k, '#6a5038', 0.075); band(k); k.box(0.2, 0.05, 0.13, '#6a5038', 0, 0.4, -0.01); },
  horde: (k) => { crown(k, 0.075, 0.06, '#3a2e26'); k.cone(0.06, 0.06, 8, '#c9a43c', 0, 0.61, 0); band(k, 0.552, 0.077); },
  searaider: (k) => { k.cone(0.074, 0.1, 8, '#7a7c80', 0, 0.53, 0); k.box(0.015, 0.06, 0.012, '#7a7c80', 0, 0.48, 0.07); band(k, 0.53, 0.074); },
  alchemy: (k) => { k.box(0.11, 0.07, 0.11, '#1e1e22', 0, 0.54, -0.005); for (const d of [-1, 1]) k.box(0.07, 0.012, 0.012, '#1e1e22', d * 0.08, 0.58, -0.05); band(k, 0.535, 0.072); },
  grove: (k) => { k.ring(0.07, 0.014, '#4e7a3a', 0.56); for (let i = 0; i < 5; i++) k.sphere(0.016, '#6a9a48', Math.cos(i * 1.26) * 0.07, 0.565, Math.sin(i * 1.26) * 0.07); band(k, 0.53, 0.07); },
  missions: (k) => { brim(k, 0.12, '#2a2622'); crown(k, 0.065, 0.035, '#2a2622'); band(k, 0.556, 0.062); },
  dykes: (k) => { brim(k, 0.1, '#1e1e22'); crown(k, 0.062, 0.07, '#1e1e22'); band(k, 0.556, 0.063); k.box(0.19, 0.035, 0.13, '#f1ece0', 0, 0.42, 0); },
  beggars: (k) => { cap(k, '#3a4650'); band(k); k.cyl(0.035, 0.03, 0.025, 8, '#b8a27a', 0.09, 0.2, 0.04); },
  golden: (k) => { band(k, 0.55, 0.07); k.ring(0.07, 0.012, '#e2b440', 0.57); for (let i = 0; i < 5; i++) k.cone(0.012, 0.04, 4, '#e2b440', Math.cos(i * 1.26) * 0.07, 0.575, Math.sin(i * 1.26) * 0.07); },
  fair: (k) => { cap(k, '#5a2436'); band(k); k.cone(0.012, 0.13, 4, '#e8c54a', 0.04, 0.58, -0.03).rotation.z = -0.5; },
  silk: (k) => { k.cyl(0.078, 0.074, 0.065, 10, '#efe2c4', 0, 0.53, 0); k.sphere(0.02, '#b8462e', 0, 0.565, 0.07); band(k, 0.527, 0.079); },
  ironblood: (k) => { cap(k, '#2a2a2e', 0.074); band(k); k.box(0.12, 0.012, 0.075, '#9b1c2c', 0, 0.582, 0); },
  reclaimer: (k) => { cap(k, '#8a6a4e', 0.073); band(k); },
  hive: (k) => { brim(k, 0.12, '#d8b860'); crown(k, 0.06, 0.05, '#d8b860'); k.cyl(0.085, 0.085, 0.09, 10, '#ece6d4', 0, 0.455, 0); band(k, 0.556, 0.062); },
  sapper: (k) => { cap(k, '#5a4430'); band(k); },
  waterline: (k) => { brim(k, 0.11, '#1e1e22'); for (const a of [0, 2.1, 4.2]) k.box(0.1, 0.05, 0.02, '#1e1e22', Math.sin(a) * 0.075, 0.555, Math.cos(a) * 0.075).rotation.y = a; band(k, 0.553, 0.065); },
  aeronaut: (k) => { cap(k, '#6a4a32'); band(k); for (const d of [-1, 1]) k.cyl(0.02, 0.02, 0.012, 8, '#9ad0dc', d * 0.03, 0.545, 0.062).rotation.x = Math.PI / 2; },
  lightning: (k) => { band(k, 0.53); k.ring(0.072, 0.012, '#c27a3e', 0.56); k.glow(k.octa(0.018, '#bfe6ff', 0, 0.6, 0)); },
  totalwar: (k) => { brim(k, 0.1, '#5a5e58', 0.555); cap(k, '#5a5e58', 0.07); band(k, 0.54); },
  hemocraft: (k) => { cap(k, '#e6dcd6'); band(k); k.box(0.085, 0.045, 0.02, '#e6dcd6', 0, 0.465, 0.06); },
  bloodrite: (k) => { band(k, 0.53); for (let i = 0; i < 6; i++) k.cone(0.012, 0.055, 4, BONE, Math.cos(i * 1.05) * 0.066, 0.555, Math.sin(i * 1.05) * 0.066); },
  wildwood: (k) => { cap(k, '#4e6a36', 0.078); band(k, 0.53, 0.079); },
  locks: (k) => { cap(k, '#5a5650'); k.box(0.09, 0.012, 0.06, '#5a5650', 0, 0.54, 0.06); band(k); },
  atomic: (k) => { cap(k, '#7a7c70'); band(k); k.box(0.08, 0.055, 0.03, '#9a9c96', 0, 0.47, 0.06); k.cyl(0.022, 0.022, 0.035, 6, '#5a5c58', 0, 0.44, 0.08).rotation.x = Math.PI / 2; },
  fission: (k) => { brim(k, 0.09, '#d8b850', 0.545); cap(k, '#d8b850', 0.072); band(k, 0.538, 0.073); },
  fusion: (k) => { cap(k, '#eef1f3'); band(k); k.glow(k.box(0.11, 0.02, 0.02, '#7fe6ff', 0, 0.51, 0.06)); },
  bloom: (k) => { band(k, 0.53); for (let i = 0; i < 5; i++) k.sphere(0.018, '#f2b8c8', 0.04 + Math.cos(i * 1.26) * 0.022, 0.575, Math.sin(i * 1.26) * 0.022); k.sphere(0.012, '#ffe28a', 0.04, 0.58, 0); },
  leviathans: (k) => { band(k, 0.53); k.ring(0.072, 0.014, BONE, 0.555); k.box(0.012, 0.06, 0.012, BONE, 0, 0.56, 0.072); },
  tides: (k) => { cap(k, '#c8a848', 0.075); k.box(0.12, 0.012, 0.09, '#c8a848', 0, 0.5, -0.07).rotation.x = 0.4; band(k); },
  floating: (k) => { k.cone(0.12, 0.09, 10, '#cfb76e', 0, 0.545, 0); band(k, 0.54, 0.07); },
};

/** The hat an age's citizens wear in place of their epoch's, if it has one. */
export function ageHat(age: AgeId | undefined): ((k: Kit) => void) | undefined {
  return age ? HATS[age] : undefined;
}

/** A scarf in the town's colours on a soldier, archer or priest of the age, over its shoulders. */
export function ageScarf(k: Kit, age: AgeId): void {
  const p = AGE_PALETTES[age];
  if (!p) return;
  k.box(0.19, 0.04, 0.128, p.roof, 0, 0.415, 0);
  k.box(0.04, 0.09, 0.02, p.roof, 0.04, 0.33, 0.062);
}
