# Gatherers look further: merged (#344)

Chain 1017-0502, session 3. PR #404 (`SPREAD.far = 18`, human gatherers search further before idling) merged once `ci` was green.

- Farms never deplete, so "farms running out" on #344 is moot. A farmer idles only when its farm is destroyed or no free farm lies within 12 tiles (`farmStep`, `src/sim/units.ts`).
- Still open on #344: builders after far builds.
- Other leftovers: Steppe camp creeping toward a rival (#331, #322), Age of Lightning win-rate sweep (#231 s4), browser verification (unverified; Anissa1030 unlocks everything in a solo match).
- Nothing else changed this session.
