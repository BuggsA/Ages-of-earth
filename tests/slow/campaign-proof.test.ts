import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../../src/sim/campaign';
import { playChapter } from '../../src/sim/campaignPlay';

/**
 * Each chapter played to the end by a Hard computer in the player's seat, playing toward the chapter's
 * goals (`chapterGoals` in src/sim/ai.ts): proof the chapter can be won. Wings over the Steppe isn't
 * proven yet (#24 follows it up), so it is left out.
 */
const PROVEN = ['first-fires', 'river-of-kings', 'the-wall', 'iron-and-gold', 'sea-lords'];

describe('the campaign can be won', () => {
  for (const sc of SCENARIOS.filter((c) => PROVEN.includes(c.id))) {
    it(`${sc.title}: a Hard computer in your seat wins it`, () => {
      const s = playChapter(sc.id, 'hard');
      expect(s.scenario!.result).toBe('win');
      sc.objectives.forEach((o, i) => {
        if (!o.bonus) expect(s.scenario!.done[i]).toBe(true);
      });
    }, 300_000);
  }
});
