import { CIVS, FLOOD } from './data';
import { seasonAt } from './seasons';
import type { GameState } from './types';

/** The Nile flood (#501 s1): whether this player's fields lie under the river now, and its corvée builds (`FLOOD`). */
export function flooded(s: GameState, owner: number): boolean {
  const p = s.players[owner];
  return !!p && !!CIVS[p.civ].flood && seasonAt(s) === FLOOD.season;
}
