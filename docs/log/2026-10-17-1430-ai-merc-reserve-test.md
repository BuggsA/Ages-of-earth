# AI hire-reserve test (#420)

Added `tests/ai-merc.test.ts`: the computer at the Market hires nothing one gold short of the cheapest hire plus its `AI_MERC.reserve` paydays of keep, and hires with the dearest hire plus that keep. Test only; no rules or numbers changed.

Gotcha: the computer trains soldiers only once it has 8 citizens, so the test spawns six.

Not done from #420: the win-rate sweep over many maps (`npx tsx scripts/campaign.ts --seeds 8`).
