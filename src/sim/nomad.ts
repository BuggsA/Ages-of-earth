import { CIVS } from './data';
import { R_BOG, R_GOLD, R_STONE } from './types';
import type { Player } from './types';

/**
 * Born on the move (#501, the Mongols): a people whose camp is on wagons from the first minute (`isMobile`), whose food walks in a
 * flock, and whose citizens dig no stone, gold or bog iron (`mineable`, in `household.ts`) and till and wall nothing (`buildBarred`).
 * What it lacks the camp takes: riders standing in a rival's land exact tribute in gold and stone (`tributeStep`), and the herd is sold.
 */
export const isNomad = (p: Player): boolean => !!CIVS[p.civ].nomad;

/** Whether a nomad people's citizens leave a tile of this kind alone: stone, gold and bog iron lie under the plough's cousin, the spade. */
export const nomadSpurns = (kind: number): boolean => kind === R_STONE || kind === R_GOLD || kind === R_BOG;
