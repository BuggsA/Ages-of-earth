# Reading market recovery (#30)

Branch `codex/30-market-recovery`; Codex, 2026-10-14 UTC.

- Originally pitched recovery; another agent implemented the same idea in #31. Adopted its implementation, then contributed readable Market indicators and extra regression tests. No duplicate drift loop.
- Market quotes show recovery direction; tooltips show the baseline and explain shared prices.
- New tests cover scheduled drift, equilibrium, frozen ended matches, save/load continuity, shared transaction shocks and immediate buy/sell spread.
- No new balance numbers or save fields. Existing rules remain #31's.
- Native `npm run check` fails before tests: TypeScript 7 panics reading `/proc/self/exe`. Fallback TypeScript 5.9.3 is a separate compatibility check, not a claim that the required native check passed.
- Browser unverified: `/opt/pw-browsers/chromium` is absent. No automated browser claim.
- Update 2026-10-14: #33 permits shipping without Chromium on green CI, with browser claims unverified. Merged the latest main including repairs, kept both Market and repair hints, and refreshed quote tooltips when their price changes. CI may run in its supported environment.
- Successor: none; the owner starts the next session.
