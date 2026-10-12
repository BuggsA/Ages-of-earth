import type { CivId, Difficulty, MapSize, MapType } from '../src/sim/types';

/** The choices a room accepts (kept here so the Worker needn't load the game's rules). */
export const CIVS_FOR_ROOMS: CivId[] = ['egyptians', 'greeks', 'romans', 'mongols', 'chinese', 'britons'];
export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];
export const MAP_SIZES_FOR_ROOMS: MapSize[] = ['small', 'medium', 'large'];
export const MAP_TYPES_FOR_ROOMS: MapType[] = ['continental', 'highlands', 'lakes', 'forest', 'plains'];
