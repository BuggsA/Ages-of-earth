import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../../src/sim/campaign';
import { playChapter } from '../../src/sim/campaignPlay';

/**
 * Each chapter played to the end by a computer in the player's seat, playing toward the chapter's
 * goals (`chapterGoals` in src/sim/ai.ts): proof the chapter can be won. A match turns on small
 * things, so a chapter counts as won if a Normal computer wins it, or failing that a Hard one.
 */
const PROVEN = ['first-fires', 'river-of-kings', 'the-wall', 'iron-and-gold', 'sea-lords', 'wings'];

describe('the campaign can be won', () => {
  for (const sc of SCENARIOS.filter((c) => PROVEN.includes(c.id))) {
    it(`${sc.title}: a computer in your seat wins it`, () => {
      let s = playChapter(sc.id, 'normal');
      if (s.scenario!.result !== 'win') s = playChapter(sc.id, 'hard');
      expect(s.scenario!.result).toBe('win');
      sc.objectives.forEach((o, i) => {
        if (!o.bonus) expect(s.scenario!.done[i]).toBe(true);
      });
    }, 300_000);
  }
});
