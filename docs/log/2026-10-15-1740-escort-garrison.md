# Escort garrisons in the hunt's tower (chain 1015-1525, s5)

`wilds()` in `src/sim/ai.ts`: idle far-hunt escort soldiers near a finished own Watch Tower with room and meat left shelter inside; once the meat is gone they are ungarrisoned and walk home. No new numbers (reuses `AI_WILD.towerNear`). Test in `tests/wild.test.ts`. No sweep, browser unseen, no save bump.
