import type { CivId } from '../sim/types';

/** A people's crest (#267, art pass): a banner in the player's colour with a plain emblem, as inline SVG. */

const EMBLEMS: Record<CivId | 'random', string> = {
  // a sun disc between two river reeds
  egyptians: '<circle cx="24" cy="26" r="7" fill="#f6d36a"/><path d="M14 44c1-8 1-12 0-16M34 44c-1-8-1-12 0-16" stroke="#f6d36a" stroke-width="2.4" fill="none" stroke-linecap="round"/>',
  // a crested helm
  greeks: '<path d="M13 36c0-9 5-15 11-15s11 6 11 15z" fill="#f2e9d0"/><path d="M24 21c0-4 3-7 8-7-1 4-3 6-8 7z" fill="#f2e9d0"/><path d="M19 36v6h10v-6" fill="#d9ccaa"/>',
  // a laurel wreath around a standard
  romans: '<path d="M24 14v30" stroke="#f2e9d0" stroke-width="2.6" stroke-linecap="round"/><path d="M24 16l-6 5 6 3 6-3z" fill="#f2e9d0"/><path d="M13 22c-2 8 2 16 11 20M35 22c2 8-2 16-11 20" stroke="#f2e9d0" stroke-width="2" fill="none" stroke-linecap="round"/>',
  // a horse-tail standard under a ring
  mongols: '<circle cx="24" cy="21" r="5" fill="none" stroke="#f2e9d0" stroke-width="2.4"/><path d="M24 26v18" stroke="#f2e9d0" stroke-width="2.4" stroke-linecap="round"/><path d="M24 29c-7 2-9 8-8 13M24 29c7 2 9 8 8 13M24 31c-3 3-3 8-2 11" stroke="#f2e9d0" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  // a coin: a ring around a square hole, with a drifting cloud-curl
  chinese: '<circle cx="24" cy="28" r="11" fill="none" stroke="#f6d36a" stroke-width="2.6"/><rect x="20" y="24" width="8" height="8" fill="none" stroke="#f6d36a" stroke-width="2.2"/>',
  // a long bow with its arrow
  britons: '<path d="M17 14c10 6 10 24 0 30" stroke="#f2e9d0" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M17 14v30M17 29h18" stroke="#f2e9d0" stroke-width="1.6"/><path d="M35 29l-5-3v6z" fill="#f2e9d0"/>',
  random: '<text x="24" y="37" text-anchor="middle" font-family="Cinzel, serif" font-weight="800" font-size="26" fill="#f2e9d0">?</text>',
};

/** The crest of `civ` (or `'random'`) on a banner of `color`. */
export function crestSvg(civ: CivId | 'random', color: string, size = 56): string {
  return `<svg class="crest" viewBox="0 0 48 56" width="${size}" height="${Math.round((size * 56) / 48)}" aria-hidden="true">` +
    `<path d="M4 4h40v34L24 52 4 38z" fill="${color}" stroke="#1c1408" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M4 4h40v6H4z" fill="rgba(0,0,0,.22)"/>` +
    `<path d="M7 7h34v30L24 48 7 36z" fill="none" stroke="rgba(255,223,138,.55)" stroke-width="1.2"/>` +
    `${EMBLEMS[civ]}</svg>`;
}
