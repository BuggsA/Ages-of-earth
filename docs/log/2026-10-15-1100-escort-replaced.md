# A fallen escort is replaced (chain 1015-0206 s8, lane ai)

Built: when every soldier of a walker's escort has died, `escortWalker` drops the empty escort and sends a fresh pair if the town still has `AI_MARK.escort + AI_MARK.party` idle soldiers. Test in `tests/ai-landmarks.test.ts` (fails without the change). No sweep, no browser, no save bump.

Note: `tests/relics.test.ts` timed out (15 s) in the full parallel run on this slow container, twice; it passes alone, with and without this change.
