import * as THREE from 'three';
import { hash2 } from '../sim/rng';
import { AGES } from '../sim/data';
import type { AgeId } from '../sim/types';
import { AGE_PALETTES } from './ageLooks';

/**
 * The ground wears your age (#815, after #803; the owner, 2026-10-25: "each age should have a distinct or unique look").
 *
 * The trodden ground round every building takes its owner's age: a colour, an accent and a pattern laid tile by tile on the
 * faceted terrain (two triangles a tile), so a town reads its age from the ground up. Patterns are coarse on purpose, at the
 * terrain's own grain: cobbles alternate tiles, flags pair them, brick runs in courses, lanes in stripes, a meadow is
 * flecked with flowers. Held to `docs/art.md`'s ground band (dark and dull enough that units and buildings stand off it)
 * by `tests/age-grounds.test.ts`.
 */

export type GroundPattern = 'earth' | 'cobble' | 'flags' | 'brick' | 'lanes' | 'meadow' | 'boards' | 'slab' | 'shell' | 'ash';

export interface AgeGround {
  /** The main ground colour. */
  a: string;
  /** The accent: joints, flowers, shells, rust. */
  b: string;
  pattern: GroundPattern;
}

const g = (a: string, b: string, pattern: GroundPattern): AgeGround => ({ a, b, pattern });

/** Every age's ground. The trunk runs from bare earth to concrete; the side roads each tread their own. */
export const AGE_GROUNDS: Record<AgeId, AgeGround> = {
  // The trunk.
  stone: g('#7a6648', '#685640', 'earth'), // bare trodden earth
  bronze: g('#967a4e', '#826a44', 'earth'), // packed ochre clay
  middle: g('#7c7a72', '#625f57', 'cobble'), // cobbles
  gunpowder: g('#865e4a', '#6c4638', 'brick'), // brick-paved streets
  industrial: g('#4e4a46', '#36332f', 'ash'), // cinder and soot
  atomic: g('#8e8c85', '#7a7872', 'slab'), // poured concrete
  // Tier 1.
  chariots: g('#a07e52', '#76603e', 'lanes'), // wheel ruts
  iron: g('#6e5a48', '#7e4a32', 'earth'), // red-brown bog earth
  wild: g('#5e7a3e', '#b8a45c', 'meadow'), // deep meadow in flower
  rivers: g('#7a7058', '#5e6a5a', 'earth'), // river silt
  megaliths: g('#6c6c64', '#8a877a', 'flags'), // granite flags, chalk in the joints
  hunt: g('#6a6a44', '#7e5236', 'meadow'), // trampled grass, hides pegged out
  steppe: g('#8c8a5c', '#77744e', 'earth'), // dry steppe grass
  // Tier 2.
  mycelium: g('#6e5a6a', '#56465a', 'earth'), // mauve mould
  merchant: g('#9a8462', '#80694a', 'flags'), // market flagstones
  pilgrim: g('#8e8a80', '#74706a', 'flags'), // pale pilgrim stone
  sail: g('#7a6a50', '#5a4c3a', 'boards'), // quay planking
  warband: g('#6a4a3a', '#4e3428', 'earth'), // blood-dark mud
  horde: g('#8a7e5e', '#6c6246', 'shell'), // hoof-churned ground
  searaider: g('#6e6a5e', '#9a9384', 'shell'), // beach shingle
  alchemy: g('#5a5048', '#8a7a3a', 'ash'), // spent ash with sulphur
  grove: g('#5a6a3a', '#a8683a', 'meadow'), // autumn leaves on moss
  missions: g('#a07a5a', '#86644a', 'flags'), // terracotta tiles
  dykes: g('#74483c', '#5a382e', 'brick'), // Holland brick
  beggars: g('#5a5a54', '#43433d', 'boards'), // tarred planks
  // Tier 3.
  golden: g('#9a8c66', '#857852', 'flags'), // gilt-sand paving
  fair: g('#8a6e5e', '#6e5446', 'cobble'), // fairground cobbles
  silk: g('#7a5a48', '#5a3c30', 'flags'), // lacquer-red stone
  ironblood: g('#3e3634', '#5a2c2a', 'ash'), // black iron slag
  reclaimer: g('#6a6656', '#7a5a3e', 'shell'), // rubble and rust
  hive: g('#7a7040', '#b09440', 'meadow'), // clover and honey flowers
  sapper: g('#7a6a4a', '#5a4c36', 'lanes'), // trenches
  waterline: g('#6a7270', '#545c5a', 'lanes'), // wet causeways
  // Tier 4.
  aeronaut: g('#8a8e8c', '#72767a', 'slab'), // airfield apron
  lightning: g('#5a5650', '#7a5e46', 'cobble'), // iron setts, copper strips
  totalwar: g('#6e6c66', '#585650', 'slab'), // blast-scarred concrete
  hemocraft: g('#8e8682', '#6e3a3a', 'slab'), // clinical tile, stained
  bloodrite: g('#2e2828', '#5e544a', 'shell'), // basalt grit
  wildwood: g('#4a5a34', '#6a5a3a', 'meadow'), // leaf litter
  locks: g('#8a7656', '#6a5a44', 'brick'), // yellow stock brick
  // Tier 5.
  fission: g('#7a8088', '#646a72', 'slab'), // steel-blue concrete
  fusion: g('#8e959b', '#7a8188', 'slab'), // white composite
  bloom: g('#6a7a4a', '#c88a9a', 'meadow'), // petals
  leviathans: g('#4e5a5c', '#aaa38e', 'shell'), // sea-dark sand, whalebone
  tides: g('#8a8470', '#aea78f', 'shell'), // shell-sand
  floating: g('#8a7a4a', '#6e6038', 'boards'), // reed mats
};

/** Ages in a fixed order, so a tile can store its age as a small number. */
export const GROUND_AGES = Object.keys(AGES) as AgeId[];

const COLORS = new Map<AgeId, [THREE.Color, THREE.Color]>();
const colorsOf = (age: AgeId): [THREE.Color, THREE.Color] => {
  let c = COLORS.get(age);
  if (!c) COLORS.set(age, (c = [new THREE.Color(AGE_GROUNDS[age].a), new THREE.Color(AGE_GROUNDS[age].b)]));
  return c;
};

/**
 * One facet's ground colour for an age: tile `x, y`, triangle `t` (0 or 1), `fine` the terrain's soft noise (0 to 1).
 * Written into `out`.
 */
export function groundColor(out: THREE.Color, age: AgeId, x: number, y: number, t: number, fine: number): THREE.Color {
  const [a, b] = colorsOf(age);
  const n = hash2(x * 2 + t, y, 31);
  let k: number;
  switch (AGE_GROUNDS[age].pattern) {
    case 'earth':
      k = fine;
      break;
    case 'cobble':
      // Alternate tiles, and each tile's two facets a shade apart: rounded setts.
      k = (x + y) % 2 ? 0.15 + t * 0.2 : 0.7 + t * 0.3;
      break;
    case 'flags':
      // Slabs two tiles square, laid in a half bond.
      k = ((x >> 1) + ((y + (x >> 1)) >> 1)) % 2 ? 0.1 : 0.55 + n * 0.2;
      break;
    case 'brick':
      // Courses along x, the joints staggered course by course.
      k = (x + (y % 2) * 2) % 4 === 0 ? 1 : y % 2 ? 0.3 : 0.05 + t * 0.15;
      break;
    case 'lanes':
      // Ruts, trenches or causeways: stripes every third tile, both ways.
      k = x % 3 === 0 || y % 3 === 0 ? 0.9 : 0.15 * fine;
      break;
    case 'meadow':
      // A flower, a leaf or a hide here and there.
      k = n < 0.1 ? 0.7 : 0.1 * fine;
      break;
    case 'boards':
      // Planks along y, every other tile a shade darker, the odd one tarred or worn.
      k = x % 2 ? 0.6 : 0.1 + (n > 0.85 ? 0.6 : 0);
      break;
    case 'slab':
      // Poured squares with dark seams on one facet of every other tile.
      k = (x + y) % 2 && t ? 0.75 : n * 0.15;
      break;
    case 'shell':
      // Speckled: shells, stones, rubble.
      k = n < 0.25 ? 0.8 : 0.2 * fine;
      break;
    case 'ash':
      k = n * n;
      break;
  }
  return out.copy(a).lerp(b, k);
}

/** How strongly the ground under and right round a building wears its age (the rest grades out to the open land). */
export const GROUND_STRENGTH = 0.8;
/** Tiles out from a building's footprint that its ground reaches, fading as it goes. */
export const GROUND_REACH = 3;

/**
 * The sparks of an age-up in the new age's colours (#815): the trunk keeps the gold of the main road; a side age lights in its
 * own walls, trim and roof, lifted toward white so they glow.
 */
export function ageSparks(age: AgeId | undefined): string[] | null {
  const p = age ? AGE_PALETTES[age] : undefined;
  if (!p) return null;
  const lift = (hex: string, k: number) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), k).getHexString();
  return [lift(p.roof, 0.35), lift(p.wall, 0.2), lift(p.trim, 0.3)];
}
