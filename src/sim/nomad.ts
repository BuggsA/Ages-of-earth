import { CIVS } from './data';
import { R_BOG, R_STONE } from './types';
import type { Player } from './types';

/**
 * Born on the move (#501, the Mongols): a people whose camp is on wagons from the first minute (`isMobile`), whose food walks in a
 * flock, and whose citizens quarry no stone and dig no bog iron (`mineable`, in `household.ts`) and till and wall nothing (`buildBarred`).
 * What it lacks the camp takes: riders standing in a rival's land exact tribute in gold and stone (`tributeStep`), and a Market buys stone with the herd's gold.
 */
export const isNomad = (p: Player): boolean => !!CIVS[p.civ].nomad;

/** Whether a nomad people's citizens leave a tile of this kind alone: stone and bog iron stay in the ground; gold is still dug. */
export const nomadSpurns = (kind: number): boolean => kind === R_STONE || kind === R_BOG;
