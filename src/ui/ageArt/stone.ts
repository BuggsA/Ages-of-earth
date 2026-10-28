import type { AgeArt } from './types';

/** The `stone` age's own interface art. Claim a chunk on its issue first (`docs/age-art.md`). */
export const art: AgeArt = {
  // The first hearth: a flame over crossed logs in a ring of stones, the fire a band gathers round.
  emblem:
    '<path d="M16 2 C17 7 23 10.4 23 17.4 C23 21.4 20 24 16 24 C12 24 9 21.4 9 17.4 C9 14.4 10.6 12.6 12 11 C12.4 13 13.4 14 14.6 14.4 C13.6 9.6 14.6 5.4 16 2z"/><path d="M16 12.6 C17 15.4 19.4 16.6 19.4 19.6 C19.4 21.6 18 22.8 16 22.8 C14 22.8 12.6 21.6 12.6 19.6 C12.6 17.4 14.8 16 16 12.6z" fill="#e8a21c"/><path d="M5 26.6 L25.6 21.4 M26.6 26.6 L6 21.4" stroke="#6b4a2a" stroke-width="3.4" stroke-linecap="round" fill="none"/><path d="M2.4 29.6 a3.4 2.6 0 0 1 6.8 0z M9.6 29.8 a3.4 2.6 0 0 1 6.8 0z M16.6 29.8 a3.4 2.6 0 0 1 6.8 0z M23.4 29.6 a3.4 2.6 0 0 1 6.4 0z"/>',  glyphs: {
    // An ard, the first plow: a wooden beam and stilt, a flint share biting the ground, a furrow behind it.
    'tech:plow':
      '<path d="M2 29.6 H30" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".5"/><path d="M5 21 L29 12 l1.2 3.4 L8 25.6z"/><path d="M20 16 L24 2.6 l3.6 1 -4.2 13.6z"/><path d="M2.4 29.6 L5.2 18.4 L14 24 L11.6 29.6z"/><path d="M5.8 22.4 L7 26" stroke="#fff" stroke-opacity=".6" stroke-width="1.4" stroke-linecap="round" fill="none"/><path d="M16 29.6 q3-5 6 0 M23 29.6 q3-5 6 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    // A double-bit axe: a wooden haft, two chipped flint blades lashed at the head, one to each side.
    'tech:axes':
      '<path d="M14.2 30 L13.4 10 h5.2 l-.8 20 z"/><path d="M13 8.6 C9 5.6 5.4 4 2.6 3.6 L4.6 7.4 L2.6 11.2 L5 14.6 L3 18.4 C7.6 17.6 11 16 13.4 14z"/><path d="M19 8.6 C23 5.6 26.6 4 29.4 3.6 L27.4 7.4 L29.4 11.2 L27 14.6 L29 18.4 C24.4 17.6 21 16 18.6 14z"/><path d="M12.6 11.4 h6.8 M12.6 13.6 h6.8" stroke="#fff" stroke-opacity=".6" stroke-width="1.2" fill="none"/>',
    // A drying rack: two forked posts, a pole across, and strips of meat hung to cure.
    'tech:drying':
      '<path d="M5 30 V11 M5 11 L2.4 6.4 M5 11 L7.6 6.4 M27 30 V11 M27 11 L24.4 6.4 M27 11 L29.6 6.4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M3 9 H29" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M8.4 10 h4.2 l-.4 11.4 q-1.7 3-3.4 0z"/><path d="M14 10 h4.2 l.4 16 q-2.4 3.4-4.8 0z"/><path d="M19.8 10 h4.2 l-.4 8.6 q-1.7 3-3.4 0z"/><path d="M10 13 v5" stroke="#fff" stroke-opacity=".5" stroke-width="1.1" fill="none"/>',
    // A hound beside the hunter: a lean, tall-eared dog in profile, tail up, a bone-thong at the neck.
    'tech:hounds':
      '<path d="M4.4 10 C4 12.6 5 14 7.4 15 L9 14.6 L10 12.6 L21 12.6 C23 12.6 24 11.4 24.6 9.8 L26.4 3.4 L28.2 7.6 L31 9.4 L31 12 L28.6 13.2 C27.8 14.4 26.6 15.4 25 15.8 L25 28 L22 28 L21.4 19 L12 19 L11.4 28 L8.4 28 L9 17.4 C6.4 17.2 4.2 15.6 3.6 12.6z"/><circle cx="27.4" cy="9.4" r="1" fill="#fff" fill-opacity=".85"/><path d="M23.8 12.4 l1.6 2.4" stroke="#fff" stroke-opacity=".6" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
  },
};
