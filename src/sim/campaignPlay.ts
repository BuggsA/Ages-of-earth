import { scenarioById } from './campaign';
import { createGame, step } from './game';
import type { Difficulty, GameState } from './types';

/**
 * Plays a campaign chapter to the end with the computer in the player's seat (for checks and tests).
 * `seed` swaps the chapter's map for another of the same kind (same peoples, goals, raids and gifts),
 * so a check can play the chapter on several maps rather than lean on one chaotic match.
 */
export function playChapter(id: string, level: Difficulty = 'normal', maxMinutes = 50, seed?: number): GameState {
  const sc = scenarioById(id)!;
  const players = sc.setup.players.map((p, i) => (i === 0 ? { ...p, ai: level } : p));
  const setup = { ...sc.setup, seed: seed ?? sc.setup.seed, scenario: sc.id, players };
  const s = createGame(setup);
  while (!s.over && s.tick < 20 * 60 * maxMinutes) step(s);
  return s;
}

/** The maps a check plays a chapter on: its own seed first, then `n - 1` others of the same kind. */
export function chapterSeeds(id: string, n: number): number[] {
  const own = scenarioById(id)!.setup.seed;
  return Array.from({ length: n }, (_, k) => own + 101 * k);
}

export interface ChapterProof {
  /** The first match a computer won, or null if it won none. */
  won: GameState | null;
  /** Every match played, in order. */
  tries: { seed: number; level: Difficulty; result: string }[];
}

/**
 * Shows a chapter can be won: plays it on its own map at Normal and then Hard, then on up to
 * `maps - 1` other maps at Hard, and stops at the first win. One match is deterministic but chaotic,
 * so a close chapter won on one map flips with any unrelated change; a chapter nobody can win loses
 * on every map (#43). The other maps are played at Hard only: in the sweeps behind #43 a Normal seat
 * won just two maps that Hard lost (both Iron and Gold, which Hard wins on most maps), so Hard alone
 * halves the cost of a map and loses little.
 */
export function proveChapter(id: string, maps: number): ChapterProof {
  const tries: ChapterProof['tries'] = [];
  for (const [k, seed] of chapterSeeds(id, maps).entries()) {
    for (const level of k === 0 ? (['normal', 'hard'] as const) : (['hard'] as const)) {
      const s = playChapter(id, level, 50, seed);
      const result = s.scenario!.result ?? 'unfinished';
      tries.push({ seed, level, result });
      if (result === 'win') return { won: s, tries };
    }
  }
  return { won: null, tries };
}
