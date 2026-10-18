import { CIVS, NOMAD } from './data';
import { R_STONE } from './types';
import type { Ent, Player } from './types';

/**
 * Born on the move (#501, the Mongols): a people whose camp is on wagons and whose flock walks with it from the first minute, in
 * every age. The town on wheels and the flock themselves are the Steppe's (`steppe.ts`, `flocks.ts`), opened to this people by
 * `isMobile`; what is its own is here: no quarry, no fields (`buildBarred`), a flock that grows with the yurts, and stone taken
 * as tribute (`tribute.ts`). The numbers are `NOMAD` in `data.ts`.
 */
export const isNomad = (p: Player): boolean => !!CIVS[p.civ].nomad;

/** Whether this player's citizens may work a tile of this kind: a nomad people quarries no stone. */
export const quarries = (p: Player, kind: number): boolean => !isNomad(p) || kind !== R_STONE;

/** The sheep a nomad people keeps for this entity beyond its Town Centers': `NOMAD.house` for a finished House or one on its wagon. */
export const yurtRoom = (p: Player, e: Ent): number =>
  isNomad(p) && e.hp > 0 && (e.kind === 'building' ? e.type === 'house' && e.built : e.type === 'wagon' && e.packed === 'house') ? NOMAD.house : 0;

/** The stone a nomad people takes with `gold` of tribute; none for anyone else. */
export const stoneTribute = (p: Player, gold: number): number => (isNomad(p) ? gold * NOMAD.stone : 0);
