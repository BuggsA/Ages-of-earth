import { AGE_PALETTES } from '../render/ageLooks';
import type { AgeId } from '../sim/types';
import { AGE_ART } from './ageArt';

/**
 * The interface wears the age (the owner, 2026-10-25: "a real different look. Not a color change, the button icons for
 * upgrades and making people should look different … It should be iconic to the age").
 *
 * Every command button (train, build, research, age-up) sits on a **plate** of its age: a shape of its own (a chipped slab,
 * a riveted disc, a gothic arch, a gear, a tent, a scallop …), a **motif** worked into it (cracks, rivets, bricks, waves,
 * stitches, circuits …) and a **stamp**, the way the glyphs on it are struck (carved, cast, inked, gilt, neon, blood,
 * verdant, tidal). The unit and building pictures on the buttons are the age's own models (`thumbs.ts`). No two ages
 * share a shape and a motif (`tests/age-icons.test.ts`); a new age adds its line to `AGE_ICONS`.
 *
 * Drawn as one inline SVG per age, kept as a data URI and set as a CSS variable on the command panel, so the cost is a
 * string per age and no image files.
 */

export type PlateId =
  | 'slab' | 'disc' | 'arch' | 'bastion' | 'cog' | 'hex' | 'wing' | 'octagon' | 'scroll' | 'banner'
  | 'tent' | 'shell' | 'star' | 'shield' | 'claw' | 'lozenge' | 'leaf' | 'cloud' | 'drop' | 'trilithon' | 'mound' | 'chimney' | 'anvil' | 'rift';

export type MotifId =
  | 'cracks' | 'rivets' | 'bricks' | 'dots' | 'pipes' | 'orbits' | 'chevrons' | 'patches' | 'coins' | 'grain'
  | 'rays' | 'stars' | 'waves' | 'circuit' | 'stitches' | 'chains' | 'hatch' | 'drips' | 'runes' | 'spiral'
  | 'diamonds' | 'bones' | 'lattice' | 'planks' | 'spokes' | 'feathers' | 'vines' | 'cells' | 'rings' | 'petals'
  | 'scales' | 'web' | 'cross' | 'ripples' | 'lines';

/** How the glyphs (the pictures that are not 3D models) are struck. */
export type StampId = 'carved' | 'cast' | 'inked' | 'gilt' | 'neon' | 'blood' | 'verdant' | 'tidal';

export interface AgeIcon {
  plate: PlateId;
  motif: MotifId;
  stamp: StampId;
}

const ic = (plate: PlateId, motif: MotifId, stamp: StampId): AgeIcon => ({ plate, motif, stamp });

export const AGE_ICONS: Record<AgeId, AgeIcon> = {
  stone: ic('slab', 'cracks', 'carved'),
  bronze: ic('disc', 'rivets', 'cast'),
  middle: ic('arch', 'bricks', 'inked'),
  gunpowder: ic('bastion', 'dots', 'cast'),
  industrial: ic('cog', 'pipes', 'cast'),
  atomic: ic('hex', 'orbits', 'neon'),
  aeronaut: ic('wing', 'chevrons', 'cast'),
  reclaimer: ic('octagon', 'patches', 'carved'),
  merchant: ic('scroll', 'coins', 'inked'),
  iron: ic('slab', 'grain', 'carved'),
  pilgrim: ic('banner', 'rays', 'inked'),
  fair: ic('tent', 'stars', 'inked'),
  sail: ic('shell', 'waves', 'tidal'),
  lightning: ic('star', 'circuit', 'neon'),
  warband: ic('shield', 'stitches', 'carved'),
  ironblood: ic('shield', 'chains', 'cast'),
  totalwar: ic('bastion', 'hatch', 'cast'),
  hemocraft: ic('claw', 'drips', 'blood'),
  bloodrite: ic('claw', 'runes', 'blood'),
  fission: ic('hex', 'rays', 'neon'),
  fusion: ic('star', 'orbits', 'neon'),
  steppe: ic('tent', 'diamonds', 'carved'),
  horde: ic('tent', 'bones', 'carved'),
  silk: ic('lozenge', 'lattice', 'inked'),
  alchemy: ic('lozenge', 'runes', 'inked'),
  sapper: ic('bastion', 'cracks', 'cast'),
  searaider: ic('shell', 'planks', 'tidal'),
  chariots: ic('disc', 'spokes', 'carved'),
  hunt: ic('claw', 'stitches', 'carved'),
  wild: ic('slab', 'feathers', 'carved'),
  grove: ic('leaf', 'vines', 'verdant'),
  hive: ic('hex', 'cells', 'verdant'),
  wildwood: ic('arch', 'rings', 'verdant'),
  bloom: ic('leaf', 'petals', 'verdant'),
  leviathans: ic('shell', 'scales', 'verdant'),
  mycelium: ic('cloud', 'web', 'verdant'),
  missions: ic('arch', 'cross', 'inked'),
  dykes: ic('octagon', 'bricks', 'tidal'),
  rivers: ic('drop', 'ripples', 'tidal'),
  megaliths: ic('trilithon', 'spiral', 'carved'),
  delvings: ic('mound', 'planks', 'inked'),
  undercity: ic('chimney', 'dots', 'carved'),
  forges: ic('anvil', 'cracks', 'cast'),
  faults: ic('rift', 'diamonds', 'carved'),
  tides: ic('drop', 'waves', 'neon'),
  waterline: ic('octagon', 'lines', 'tidal'),
  locks: ic('cog', 'planks', 'cast'),
  floating: ic('cloud', 'waves', 'tidal'),
  beggars: ic('shield', 'waves', 'tidal'),
  golden: ic('disc', 'rays', 'gilt'),
};

// ---- Colour ----------------------------------------------------------------------------------------

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const hex = (c: number[]): string => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number): string => {
  const x = rgb(a);
  const y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
};
/** WCAG relative luminance of a `#rrggbb` colour. */
export function luminance(c: string): number {
  const [r, g, b] = rgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The plate colours of the trunk epochs, which keep their style in `buildingModels.ts`. */
const TRUNK_FACE: Partial<Record<AgeId, [string, string]>> = {
  stone: ['#d3c7ae', '#a99d84'],
  bronze: ['#e0ac5e', '#a8742f'],
  middle: ['#ebe5d6', '#b7ae98'],
  gunpowder: ['#c0563e', '#7e3526'],
  industrial: ['#9ba5b0', '#5b656f'],
  atomic: ['#cfe6c6', '#7fa08b'],
};

export interface PlateColors {
  top: string;
  bottom: string;
  edge: string;
  ink: string;
  inkOpacity: number;
}

export function plateColors(age: AgeId): PlateColors {
  const pal = AGE_PALETTES[age];
  const [top, bottom] = TRUNK_FACE[age] ?? (pal ? [pal.wall, pal.wall2] : ['#cfc3ad', '#a99d84']);
  const dark = luminance(mix(top, bottom, 0.5)) < 0.18;
  return {
    top,
    bottom,
    edge: dark ? mix(bottom, '#ffffff', 0.35) : mix(bottom, '#000000', 0.6),
    ink: dark ? '#ffffff' : mix(bottom, '#000000', 0.55),
    inkOpacity: dark ? 0.3 : 0.5,
  };
}

/** Whether the plate is dark enough that its glyphs are struck in light ink. */
export const plateIsDark = (age: AgeId): boolean => {
  const c = plateColors(age);
  return (luminance(c.top) + luminance(c.bottom)) / 2 < 0.12;
};

// ---- Plates: shapes in a 56 by 56 box -----------------------------------------------------------------

const poly = (pts: Array<[number, number]>): string => 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L') + ' Z';
/** A regular polygon, or a star when `inner` is given, with the first point at the top. */
function ring(n: number, outer: number, inner?: number): string {
  const pts: Array<[number, number]> = [];
  const steps = inner === undefined ? n : n * 2;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const r = inner === undefined || i % 2 === 0 ? outer : inner;
    pts.push([28 + Math.cos(a) * r, 28 + Math.sin(a) * r]);
  }
  return poly(pts);
}
/** A gear: `n` square teeth round a body. */
function gear(n: number): string {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    for (const [da, r] of [[-0.3, 20], [-0.2, 26], [0.2, 26], [0.3, 20]] as const) {
      const a = ((i + da) / n) * Math.PI * 2 - Math.PI / 2;
      pts.push([28 + Math.cos(a) * r, 28 + Math.sin(a) * r]);
    }
  }
  return poly(pts);
}

// Trigonometry here is for the picture only; `src/ui/` is outside the rules the simulation keeps deterministic.
export const PLATES: Record<PlateId, string> = {
  slab: 'M6 12 L17 5 L33 7 L47 4 L52 17 L49 33 L53 46 L38 52 L20 49 L5 51 L4 33 L7 22 Z',
  disc: 'M28 3 A25 25 0 1 1 27.9 3 Z',
  arch: 'M5 52 V24 C5 10 16 3 28 3 C40 3 51 10 51 24 V52 Z',
  bastion: 'M5 52 V10 H13 V5 H21 V10 H35 V5 H43 V10 H51 V52 Z',
  cog: gear(8),
  hex: ring(6, 26),
  wing: 'M3 40 L28 5 L53 40 L40 36 L28 52 L16 36 Z',
  octagon: ring(8, 27),
  scroll: 'M10 4 H50 V42 Q50 52 40 52 H6 V14 Q6 4 10 4 Z',
  banner: 'M8 3 H48 V54 L28 43 L8 54 Z',
  tent: 'M3 52 L12 28 L28 5 L44 28 L53 52 Z',
  shell: 'M28 52 C10 48 3 34 4 22 C10 24 14 26 16 30 C14 20 18 10 28 4 C38 10 42 20 40 30 C42 26 46 24 52 22 C53 34 46 48 28 52 Z',
  star: ring(8, 27, 19),
  shield: 'M6 6 H50 V28 C50 42 40 50 28 54 C16 50 6 42 6 28 Z',
  claw: 'M5 4 C30 6 48 20 52 52 C34 44 14 30 5 4 Z',
  lozenge: 'M28 2 L54 28 L28 54 L2 28 Z',
  leaf: 'M5 51 C5 22 22 5 52 4 C52 34 36 52 5 51 Z',
  cloud: 'M14 46 C5 46 3 36 11 33 C9 24 18 17 26 22 C30 12 46 14 46 25 C54 26 55 38 47 46 Z',
  drop: 'M28 3 C40 20 52 30 52 38 C52 47 41 53 28 53 C15 53 4 47 4 38 C4 30 16 20 28 3 Z',
  // Two uprights and a lintel laid across them, a little rough at the edges (the Age of Megaliths, #877).
  trilithon: 'M3 53 L5 17 L3 15 L4 4 L28 6 L52 4 L53 15 L51 17 L53 53 L37 53 L38 22 L28 21 L18 22 L19 53 Z',
  // A barrow mound with its stone-framed mouth at the foot (the Age of Delvings, #881).
  mound: 'M2 53 C3 28 14 9 28 9 C42 9 53 28 54 53 H35 V39 Q28 32 21 39 V53 Z',
  // A fairy chimney of Cappadocia: a cone of soft tuff under its cap of hard rock, a rock-cut door at its foot (the Undercity, #883).
  // A smith's anvil: its horn to the left, the flat face, the waist and the spread foot (the Deep Forges, #884).
  anvil: 'M2 9 C10 10 15 8 19 5 H54 V20 H45 C41 21 39 25 39 30 V37 H46 L51 53 H5 L10 37 H17 V30 C17 26 15 23 11 22 C6 20 3 16 2 9 Z',
  // A block of rock riven top to bottom, its halves leaning apart over the gap (the Faults, #900).
  rift: 'M3 53 L6 8 L24 3 L29 16 L25 27 L30 38 L27 53 Z M31 53 L35 40 L31 29 L36 17 L32 4 L50 8 L53 53 Z',
  chimney: 'M6 53 L19 19 C10 18 6 14 7 10 C12 4 20 3 28 3 C36 3 44 4 49 10 C50 14 46 18 37 19 L50 53 H34 V42 Q28 35 22 42 V53 Z',
};

// ---- Motifs: worked into the plate, in the plate's ink -----------------------------------------------------

const line = (x1: number, y1: number, x2: number, y2: number): string => `M${x1} ${y1} L${x2} ${y2}`;
const dot = (x: number, y: number, r: number): string => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
const grid = (cols: number[], rows: number[], f: (x: number, y: number, i: number) => string): string => rows.flatMap((y, j) => cols.map((x, i) => f(x, y, i + j))).join('');
const C = [10, 22, 34, 46];
const R = [10, 22, 34, 46];

/** Each motif returns SVG markup; strokes are the ink, set by the caller on a wrapping group. */
export const MOTIFS: Record<MotifId, string> = {
  cracks: `<path fill="none" d="${line(14, 8, 20, 22)} ${line(20, 22, 12, 34)} ${line(12, 34, 19, 48)} ${line(38, 6, 33, 20)} ${line(33, 20, 42, 30)} ${line(42, 30, 36, 50)}"/>`,
  rivets: grid(C, R, (x, y) => (x < 8 || x > 48 || y < 8 || y > 48 || (x > 12 && x < 44 && y > 12 && y < 44) ? '' : dot(x, y, 1.8))) + dot(28, 6, 1.8) + dot(28, 50, 1.8) + dot(6, 28, 1.8) + dot(50, 28, 1.8),
  bricks: `<path fill="none" d="${[12, 22, 32, 42].map((y) => line(0, y, 56, y)).join(' ')} ${[0, 20, 40].map((x) => line(x + 8, 2, x + 8, 12)).join(' ')} ${[0, 20, 40].map((x) => line(x + 18, 12, x + 18, 22)).join(' ')} ${[0, 20, 40].map((x) => line(x + 8, 22, x + 8, 32)).join(' ')} ${[0, 20, 40].map((x) => line(x + 18, 32, x + 18, 42)).join(' ')}"/>`,
  dots: grid([9, 19, 29, 39, 49], [9, 19, 29, 39, 49], (x, y) => dot(x, y, 1.4)),
  pipes: `<path fill="none" stroke-width="3" d="M4 14 H30 V30 H52 M4 40 H18 V50 H52"/>`,
  orbits: `<g fill="none"><ellipse cx="28" cy="28" rx="23" ry="8"/><ellipse cx="28" cy="28" rx="23" ry="8" transform="rotate(60 28 28)"/><ellipse cx="28" cy="28" rx="23" ry="8" transform="rotate(120 28 28)"/></g>${dot(28, 28, 3)}`,
  chevrons: `<path fill="none" stroke-width="2.5" d="M8 22 L28 10 L48 22 M8 34 L28 22 L48 34 M8 46 L28 34 L48 46"/>`,
  patches: `<g fill="none"><rect x="8" y="8" width="16" height="14" stroke-dasharray="3 2"/><rect x="30" y="26" width="18" height="16" stroke-dasharray="3 2"/><rect x="10" y="32" width="14" height="14" stroke-dasharray="3 2"/></g>`,
  coins: `<g fill="none">${[[16, 16], [38, 14], [28, 30], [14, 42], [42, 42]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7"/><circle cx="${x}" cy="${y}" r="3.5"/>`).join('')}</g>`,
  grain: `<path fill="none" d="${[8, 16, 24, 32, 40, 48].map((x, i) => `M${x} 4 C${x + 6} 18 ${x - 6} 34 ${x + (i % 2 ? 4 : -2)} 52`).join(' ')}"/>`,
  rays: `<path fill="none" stroke-width="2" d="${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return line(28 + Math.cos(a) * 8, 28 + Math.sin(a) * 8, 28 + Math.cos(a) * 30, 28 + Math.sin(a) * 30); }).join(' ')}"/>`,
  stars: [[14, 14], [42, 12], [28, 28], [12, 42], [44, 42]].map(([x, y]) => `<path d="${star5(x, y, 5)}"/>`).join(''),
  waves: `<path fill="none" stroke-width="2.4" d="${[14, 26, 38, 50].map((y) => `M2 ${y} q7 -8 13 0 t13 0 t13 0 t13 0`).join(' ')}"/>`,
  circuit: `<g fill="none" stroke-width="2"><path d="M6 12 H22 V24 H40 V12 H50 M6 44 H16 V34 H34 V46 H50 M28 24 V34"/></g>${dot(22, 12, 2.2)}${dot(40, 12, 2.2)}${dot(16, 44, 2.2)}${dot(34, 46, 2.2)}`,
  stitches: `<path fill="none" stroke-width="2" stroke-dasharray="4 3" d="M8 8 L48 8 M8 48 L48 48 M8 8 L8 48 M48 8 L48 48 M28 12 V44"/>`,
  chains: `<g fill="none" stroke-width="2">${[8, 18, 28, 38, 48].map((y, i) => `<ellipse cx="${i % 2 ? 22 : 34}" cy="${y}" rx="${i % 2 ? 3 : 7}" ry="${i % 2 ? 7 : 3}"/>`).join('')}</g>`,
  hatch: `<path fill="none" d="${Array.from({ length: 10 }, (_, i) => line(i * 8 - 14, 56, i * 8 + 14, 0)).join(' ')}"/>`,
  drips: `<path d="M12 4 V20 a3 3 0 1 0 0.1 0 Z M30 4 V30 a3.5 3.5 0 1 0 0.1 0 Z M46 4 V16 a3 3 0 1 0 0.1 0 Z"/>`,
  runes: `<path fill="none" stroke-width="2.2" d="M10 12 V30 M10 18 L18 12 M10 24 L18 18 M26 14 L36 14 L26 30 L36 30 M44 12 V32 M40 18 L48 24 M12 38 L22 50 M22 38 L12 50 M32 38 V50 M32 44 H42 M42 38 V50"/>`,
  spiral: `<path fill="none" stroke-width="2.4" d="M28 28 m0 0 a3 3 0 1 1 3 3 a7 7 0 1 1 -7 -7 a12 12 0 1 1 12 12 a17 17 0 1 1 -17 -17 a22 22 0 1 1 22 22"/>`,
  diamonds: `<g fill="none" stroke-width="2"><path d="M28 6 L40 18 L28 30 L16 18 Z M28 26 L40 38 L28 50 L16 38 Z M8 28 L14 34 L8 40 M48 28 L42 34 L48 40"/></g>`,
  bones: `<g fill="none" stroke-width="3" stroke-linecap="round"><path d="M10 14 L30 34 M30 14 L10 34 M24 38 L46 50 M46 38 L24 50"/></g>${dot(8, 12, 2.4)}${dot(32, 36, 2.4)}`,
  lattice: `<path fill="none" d="${Array.from({ length: 8 }, (_, i) => line(i * 8 - 8, 0, i * 8 + 48, 56) + ' ' + line(i * 8 + 56, 0, i * 8, 56)).join(' ')}"/>`,
  planks: `<path fill="none" d="${[11, 21, 31, 41].map((y) => line(0, y, 56, y)).join(' ')} M14 0 V11 M38 11 V21 M22 21 V31 M44 31 V41 M10 41 V56"/>`,
  spokes: `<g fill="none"><circle cx="28" cy="28" r="18"/><circle cx="28" cy="28" r="4"/>${Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return `<path d="${line(28 + Math.cos(a) * 4, 28 + Math.sin(a) * 4, 28 + Math.cos(a) * 18, 28 + Math.sin(a) * 18)}"/>`; }).join('')}</g>`,
  feathers: `<g fill="none" stroke-width="2"><path d="M14 50 C14 30 20 14 26 6 M26 6 L18 14 M24 12 L16 22 M22 18 L15 30 M20 26 L14 38"/><path d="M40 50 C40 34 44 20 48 12 M48 12 L42 18 M46 18 L40 28 M44 26 L39 38"/></g>`,
  vines: `<g fill="none" stroke-width="2"><path d="M8 52 C8 38 24 36 24 24 C24 14 14 12 14 4 M24 24 C34 22 38 14 46 12"/></g>${dot(14, 4, 2)}${dot(46, 12, 2.4)}${dot(30, 40, 2.4)}`,
  cells: `<g fill="none">${[[18, 14], [38, 14], [8, 31], [28, 31], [48, 31], [18, 48], [38, 48]].map(([x, y]) => `<path d="${ring6(x, y, 9)}"/>`).join('')}</g>`,
  rings: `<g fill="none"><circle cx="28" cy="32" r="5"/><circle cx="28" cy="32" r="11"/><circle cx="28" cy="32" r="17"/><circle cx="28" cy="32" r="23"/></g>`,
  petals: `<g>${Array.from({ length: 6 }, (_, i) => `<ellipse cx="28" cy="16" rx="5" ry="10" transform="rotate(${i * 60} 28 28)"/>`).join('')}</g>`,
  scales: `<g fill="none">${[[8, 10], [24, 10], [40, 10], [16, 22], [32, 22], [48, 22], [8, 34], [24, 34], [40, 34], [16, 46], [32, 46], [48, 46]].map(([x, y]) => `<path d="M${x - 8} ${y} a8 8 0 0 0 16 0"/>`).join('')}</g>`,
  web: `<g fill="none"><path d="${Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return line(28, 28, 28 + Math.cos(a) * 30, 28 + Math.sin(a) * 30); }).join(' ')}"/>${[8, 15, 22].map((r) => `<path d="${ring(8, r)}"/>`).join('')}</g>`,
  cross: `<path d="M24 6 H32 V22 H46 V30 H32 V50 H24 V30 H10 V22 H24 Z"/>`,
  ripples: `<g fill="none" stroke-width="2"><ellipse cx="22" cy="24" rx="8" ry="4"/><ellipse cx="22" cy="24" rx="16" ry="8"/><ellipse cx="22" cy="24" rx="24" ry="12"/><ellipse cx="38" cy="42" rx="6" ry="3"/><ellipse cx="38" cy="42" rx="13" ry="6.5"/></g>`,
  lines: `<path fill="none" stroke-width="2.4" d="${[10, 18, 26, 34, 42, 50].map((y) => line(0, y, 56, y)).join(' ')}"/>`,
};

function star5(cx: number, cy: number, r: number): string {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return poly(pts);
}
function ring6(cx: number, cy: number, r: number): string {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return poly(pts);
}

// ---- The plate itself ------------------------------------------------------------------------------------------

const svgCache = new Map<AgeId, string>();

/** The age's button plate as SVG markup (56 by 56, stretched to the button). */
export function plateSvg(age: AgeId): string {
  const hit = svgCache.get(age);
  if (hit) return hit;
  const { plate, motif } = AGE_ICONS[age];
  const own = AGE_ART[age].plate;
  const c = plateColors(age);
  const d = own?.path ?? PLATES[plate];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" preserveAspectRatio="none">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.top}"/><stop offset="1" stop-color="${c.bottom}"/></linearGradient>` +
    `<clipPath id="c"><path d="${d}"/></clipPath></defs>` +
    `<path d="${d}" fill="url(#g)"/>` +
    `<g clip-path="url(#c)" fill="${c.ink}" stroke="${c.ink}" stroke-width="1.4" opacity="${c.inkOpacity}">${own?.motif ?? MOTIFS[motif]}</g>` +
    `<path d="${d}" fill="none" stroke="${c.edge}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="#ffffff" stroke-opacity=".28" stroke-width="1" transform="translate(28 28) scale(.88) translate(-28 -28)"/>` +
    `</svg>`;
  svgCache.set(age, svg);
  return svg;
}

/** The plate as a CSS `url(...)` value. */
export function plateUrl(age: AgeId): string {
  return `url('data:image/svg+xml;base64,${btoa(plateSvg(age))}')`;
}

export const stampOf = (age: AgeId): StampId => AGE_ART[age].stamp ?? AGE_ICONS[age].stamp;
