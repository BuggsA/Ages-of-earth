# Wonder guard: win rates (#374)

Added `AiLevel.wonderGuard` (off = unguarded) so `scripts/ai-ab.ts` can compare. `npx tsx scripts/ai-ab.ts 21 4 40 '{"wonderGuard":false}'` → 8 games, seats mirror exactly (same results with seats swapped), 2 wins each, gather x1.000: **no Wonder was begun in any of them**, so the guard never ran and the result says nothing about it. Next: a setup that forces a Wonder race (start epoch 3+, rich), then compare.
