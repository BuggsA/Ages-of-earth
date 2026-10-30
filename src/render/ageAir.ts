import type { AgeId } from '../sim/types';

/**
 * The air of an age (#803, beyond the buildings and people): the owner, 2026-10-25, "each age should have a distinct or
 * unique look". The sky, the haze that melts the map's edge and the sun's colour take a tint from the age the viewer
 * stands in, so a match changes its whole weather of light as the people change age: dust over the Bronze Age, soot
 * over the Industrial, a sterile white over the Atomic, a bruised violet under the Mycelium's spores.
 *
 * It is drawn only (the rules never know of it) and never hides the play area: the tint is a lerp of at most 0.4 over
 * the day's own colours, it follows the hour (it dims with dusk like the weather's grey) and weather greys it after.
 */

export interface Air {
  /** The colour the air leans to. */
  tint: string;
  /** How far: 0 is the clear day, 0.4 the most any age leans. The horizon leans 1.3 times as far as the zenith. */
  k: number;
}

const air = (tint: string, k: number): Air => ({ tint, k });

/** Every age's air. A new age adds its own; `tests/age-air.test.ts` fails one without it, or two that look alike at noon. */
export const AGE_AIR: Record<AgeId, Air> = {
  // The trunk
  stone: air('#f0e2b8', 0.14), // morning smoke of cooking fires
  bronze: air('#e0b070', 0.24), // dust of kilns and threshing floors
  middle: air('#aab8c8', 0.2), // cool mist off damp stone
  gunpowder: air('#a39a8e', 0.3), // powder smoke
  industrial: air('#7a6a58', 0.36), // soot
  atomic: air('#e8f0f4', 0.3), // sterile pale
  // Tier 1
  chariots: air('#e8a860', 0.28), // dry gold of the plains
  iron: air('#8a8e98', 0.28), // forge grey
  wild: air('#9ab87a', 0.24), // green forest light
  rivers: air('#c8d890', 0.26), // river-mist, reed green
  megaliths: air('#e6bfae', 0.24), // a solstice dawn on the stones
  delvings: air('#9a7a5a', 0.34), // lamp smoke and earth-dust from the shafts
  forges: air('#8a5a48', 0.32), // vent steam lit from below, ember-dark
  living: air('#b8b060', 0.26), // pollen-gold haze over green, the earth breathing
  faults: air('#5e8682', 0.3), // rock-dust over the rift, lit teal off the crystal
  undercity: air('#c8b090', 0.3), // tuff dust and vent smoke in a Cappadocian dusk
  hunt: air('#b8905e', 0.24), // woodsmoke at dawn
  steppe: air('#d8d8b0', 0.2), // pale wind-dust
  // Tier 2
  mycelium: air('#b890c8', 0.3), // spore violet
  merchant: air('#f4b040', 0.3), // saffron lamp-light of the bazaar
  pilgrim: air('#a8a0d0', 0.26), // dusk-violet incense
  sail: air('#80b0d8', 0.28), // sea-blue salt air
  warband: air('#c06a4e', 0.28), // red war-dust
  horde: air('#d0b46a', 0.3), // gold dust of a thousand hooves
  searaider: air('#789cae', 0.3), // cold northern grey-blue
  alchemy: air('#a8c070', 0.28), // vapour of the furnace, greenish gold
  grove: air('#d89050', 0.3), // autumn copper
  missions: air('#f0c898', 0.24), // warm adobe dust
  dykes: air('#9cb4b8', 0.26), // low-country damp
  beggars: air('#7a8aa0', 0.3), // cold slate-blue fog
  // Tier 3
  golden: air('#f4d870', 0.36), // gilt
  fair: air('#e8a0b0', 0.26), // wine-rose festival haze
  silk: air('#d89898', 0.24), // rose-red lacquer dusk
  ironblood: air('#9a6a68', 0.34), // furnace red-grey
  totalwar: air('#847c70', 0.38), // trench smog
  hemocraft: air('#b04a5a', 0.3), // blood-rose
  bloodrite: air('#8a2e44', 0.3), // wine-dark crimson
  // Tier 4 and the water and sky roads
  aeronaut: air('#c8dcf0', 0.24), // high clear blue
  lightning: air('#a8b4e8', 0.32), // static violet-blue
  fission: air('#b8e090', 0.34), // glow of the pile
  fusion: air('#a8e8e0', 0.32), // blue-white plasma teal
  sapper: air('#a89070', 0.32), // tunnel dust
  reclaimer: air('#a07a58', 0.3), // rust
  hive: air('#e8b830', 0.34), // honey amber
  waterline: air('#68a8c0', 0.3), // wet blue
  tides: air('#70a890', 0.3), // sea-green grey
  wildwood: air('#58985a', 0.3), // deep leaf green
  locks: air('#98a8a0', 0.26), // canal mist
  floating: air('#c0b8e8', 0.28), // lavender high sky
  bloom: air('#d8c8e0', 0.28), // pollen lilac
  leviathans: air('#5a88b0', 0.34), // deep-sea blue
};

/** The air of an age; an age without one (never, by the test) leans nowhere. */
export function airOf(age: AgeId): Air {
  return AGE_AIR[age] ?? { tint: '#ffffff', k: 0 };
}
