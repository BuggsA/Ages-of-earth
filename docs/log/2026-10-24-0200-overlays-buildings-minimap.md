# 2026-10-24 02:00 — overlays step 3: building-death colour, minimap building floor (#626, #617)

Chain 1024-0012-overlays, 3 of 8. Built on PR #636's branch.

- `view.ts` `die` (building): a ring and sparks in the owner's colour over the rubble, so whose building fell reads in a crowd.
- `minimap.ts`: a building's block is at least 1.6 px a side, so small huts don't vanish.
- Left: `rangeGuides.ts` is 1 px lines (WebGL can't widen them); a thicker ribbon is a later step. Territory colours on the minimap not touched.
- No numbers in `src/sim/data.ts` changed. Decision it gives the player: none: look.
- Verified: `npx tsc --noEmit` clean; `npx vitest run tests/health-bars.test.ts tests/models.test.ts` → 5 passed. Not seen in a browser: unverified.
