import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../../src/sim/campaign';
import { proveChapter } from '../../src/sim/campaignPlay';

/**
 * How many maps a chapter gets before the proof calls it unwinnable. A match is deterministic but
 * chaotic: any change to the rules or the AI reshuffles which maps a computer wins. On 2026-10-14,
 * over 8 maps at Normal and Hard, the close chapters were won on 1 to 6 maps (Wings 3 on `main`, 1
 * with the trade fix of #42), a different few with each change, so one map was a coin toss (#43).
 * With 16, a chapter won on 1 map in 4 fails by chance about once in 100 changes, one won on 1 in 8
 * about once in 8; a chapter nobody can win still loses them all. Win rates for tuning:
 * `npx tsx scripts/campaign.ts --seeds 8`.
 */
export const PROOF_MAPS = 16;

/**
 * Each chapter played to the end by a computer in the player's seat, playing toward the chapter's
 * goals (`chapterGoals` in src/sim/ai.ts): proof the chapter can be won. It counts as won when a
 * computer wins it on its own map at Normal or Hard or, failing that, at Hard on any of the next
 * maps (`proveChapter`). Chapters are split across files so vitest plays them side by side.
 */
export function campaignProof(ids: string[]): void {
  describe('the campaign can be won', () => {
    for (const sc of SCENARIOS.filter((c) => ids.includes(c.id))) {
      it(`${sc.title}: a computer in your seat wins it`, () => {
        const { won, tries } = proveChapter(sc.id, PROOF_MAPS);
        const played = tries.map((t) => `${t.seed} ${t.level} ${t.result}`).join(', ');
        // Margin wearing thin shows in the daily log before it turns red (vitest hides console.log here).
        if (tries.length > 3) process.stdout.write(`${sc.title} needed ${tries.length} matches: ${played}\n`);
        expect(won, `no win on ${PROOF_MAPS} maps: ${played}`).not.toBeNull();
        sc.objectives.forEach((o, i) => {
          if (!o.bonus) expect(won!.scenario!.done[i]).toBe(true);
        });
      }, 90 * 60_000);
    }
  });
}
