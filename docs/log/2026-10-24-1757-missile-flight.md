# 2026-10-24 17:57 UTC: the flight (#772, s1 of #759)

Chain 1024-1610, session 5. Merged PR #771 first (the salvo, #765): main merged in (design-notes and the hud import conflicted, both sides kept), `npm run check` green, `ci` green on a95f6f2.

**Built:** a launch's course (`Launch.arc`, `flightOf`, `missilesAt` in `silo.ts`), a climb toward the middle of a rival's rings, then a bend onto the true point in the seconds before the reveal. `MissileView` draws it for every player, with a plume at the silo and a smoke trail. A salvo climbs as one missile and splits at the bend (provisional, the owner's question on #759 is open). The computer defender reads the bend (`ringsToClear` in `ai.ts`). Tip `missile`; words on the rival's launch toast and ☢ chip. New numbers: `FLIGHT`, `AI_SILO.read`.

**Tried:** `tests/missile-flight.test.ts` (7 tests); the arc in Chromium (single strike and salvo, screenshots in the session scratchpad). **Not tried:** sound (none added), and how well a person reads the turn at play speed.

**Next:** #759 s2, the missile defence battery.
