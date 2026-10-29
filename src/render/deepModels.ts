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
