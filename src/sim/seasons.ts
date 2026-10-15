import { SEASON, SEASONS, secs } from './data';
import type { GameState } from './types';

/**
 * Seasons (own pitch, Stone Age depth): a year of four seasons, `SEASON.len` seconds each, turning the same
 * way in every browser. Every match opens in spring and meets its first winter at 7½ minutes. No state is kept:
 * the season is the tick, so saves and replays need nothing new. See `SEASONS` in `data.ts`.
 */
export function seasonAt(s: GameState, tick: number = s.tick): number {
  return Math.floor(tick / secs(SEASON.len)) % 4;
}

/** The season's numbers: berry and field gathering, how fast meat spoils, how boldly beasts come for your people. */
export function seasonOf(s: GameState) {
  return SEASONS[seasonAt(s)];
}

/** Tells the players when the year turns. */
export function turnSeason(s: GameState): void {
  if (s.tick > 0 && s.tick % secs(SEASON.len) === 0) s.events.push({ k: 'season', i: seasonAt(s) });
}
