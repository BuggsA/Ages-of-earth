# 2026-10-14 03:10 UTC: trade from an ally's Market

Branch `claude/zealous-knuth-njzd4m` (restarted from `main` after #60 merged). `homeMarket` in `src/sim/trade.ts`: own nearest Market, else an ally's; used by the route command, the trader's trip, and the post panel. The computer is unchanged (it keeps `nearestMarket`). No numbers, no save bump. Test in `tests/trade.test.ts`. Browser not tried.
