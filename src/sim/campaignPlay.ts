import { scenarioById } from './campaign';
import { createGame, step } from './game';
import type { Difficulty, GameState } from './types';

/** Plays a campaign chapter to the end with the computer in the player's seat (for checks and tests). */
export function playChapter(id: string, level: Difficulty = 'normal', maxMinutes = 50): GameState {
  const sc = scenarioById(id)!;
  const setup = { ...sc.setup, scenario: sc.id, players: sc.setup.players.map((p, i) => (i === 0 ? { ...p, ai: level } : p)) };
  const s = createGame(setup);
  while (!s.over && s.tick < 20 * 60 * maxMinutes) step(s);
  return s;
}
