# 2026-10-24 · #344 step 7: idle cards in a browser

**Decision it gives the player:** none: fix (the field card no longer scolds the starting five).

Drove headless Chromium (swiftshader) against a build of `main` after #715, using `window.ages.game` to stand citizens idle:

- **Idle miners card** (#715): 5 citizens given a real stone seam, then idled → "5 miners stand idle: their seam is spent" appears after ~5 s; clicking "Find more stone" put all 5 back on `gather:stone`. No page errors.
- **Idle field card** (#714): appears once hands that foraged run out of food nodes and stand idle 5 s.
- **Found:** at match start the five starting citizens stand idle until ordered, and on a seed where farms are allowed (seed 3) the field card fired ~5 s in with "nothing to forage", though berries lay nearby. Fixed in `idleFieldCard`: only citizens seen on food or a field (`foraged`) count. HUD only; `scripts/sim.ts 3 medium 30` checksum is still 1591387014.
- Notes for the next pass: the card lives 8.7 s, and headless the HUD updates about once a second, so a test must wait on the selector rather than sleep. Mongol camps (nomad) never see the field card, by design.
- Not tried: a real mouse click through the Workers panel, sound, a phone viewport.
