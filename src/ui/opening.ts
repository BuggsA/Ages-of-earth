import { CIVS, HOMELANDS, WAYS, WAY_LEAN } from '../sim/data';
import type { CivId, GameState } from '../sim/types';

/**
 * The first minute (#555 s8): what is special about this people, on this land, with its leaning Way, told once at
 * minute 0. `first` is the people's own opening move; `later` is the follow-up tip once the town has settled.
 */
const FIRST: Record<CivId, { first: string; later: string }> = {
  egyptians: {
    first: 'Plant Farms early: a farm gives the most of any people\'s, and food must be laid up before the flood stops the fields.',
    later: 'When the river rises, farms yield nothing: take your farmers off the fields and <b>build</b>, for the corvée raises buildings twice as fast in the flood.',
  },
  greeks: {
    first: 'Grow the town first: you train no foot soldiers, because your citizens are the army.',
    later: 'When war comes, arm your citizens where they stand; when it is over, send them home to lay their arms down and work again. A long campaign starves the town.',
  },
  romans: {
    first: 'Citizens are few: put your soldiers to the axe and the quarry while there is no war.',
    later: 'Soldiers at the quarry are not at the front. Send them to work between wars, and call them back before the raid arrives.',
  },
  mongols: {
    first: 'Never farm. Drive the flock to fresh grass and hunt: food walks with you.',
    later: 'You can build no quarry. Stone is bought, or taken as tribute from the settled, so find a rival\'s town that has some.',
  },
  chinese: {
    first: 'Lay houses out in streets and wards: gold comes from the people and their housing, not from mines.',
    later: 'A thin or scattered town is poor, and a raid on the houses empties the treasury. Build them close and guard the wards.',
  },
  britons: {
    first: 'Raise an Archery Range early: your archers reach one tile farther and train faster.',
    later: 'Keep the bowmen behind foot soldiers or walls: they shoot over the front line and are slow afoot.',
  },
};

/** The follow-up tip for a people, shown once the town has settled. */
export const laterTip = (civ: CivId): string => FIRST[civ].later;

export interface Opening {
  people: string;
  /** Lines for the card, in order, as safe HTML. */
  lines: string[];
  later: string;
}

/** The land-and-Way card for the human at minute 0, or undefined if the state has no such player. */
export function openingFor(s: GameState, me: number): Opening | undefined {
  const p = s.players[me];
  if (!p) return undefined;
  const civ = CIVS[p.civ];
  const f = FIRST[p.civ];
  const lines = [`<b>${civ.name}:</b> ${civ.verb ?? civ.blurb}.`, f.first];
  const hl = s.homeland ? HOMELANDS[s.homeland] : undefined;
  if (hl) lines.push(`${hl.icon} <b>${hl.name}:</b> ${hl.short}.`);
  const way = WAYS[WAY_LEAN[p.civ]];
  const wv = way.verb ?? way.blurb;
  lines.push(`${way.icon} <b>Way:</b> your people lean to ${way.name}: ${wv.charAt(0).toLowerCase()}${wv.slice(1)}. Choose at the Town Center.`);
  return { people: civ.name, lines, later: f.later };
}
