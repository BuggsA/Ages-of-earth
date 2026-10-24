# Mine Shafts (#681): browser check and AI sweep

Follow-up to the unverified note in `2026-10-24-1400-mine-shafts.md`.

- Browser (Chromium via Playwright, `vite preview`, Britons seed 7, Bronze Age): a shaft built beside home draws as a headframe with spoil heap and collar; selected, it shows "Mine Shaft", the status "Open ground: gold at 30% · waiting for a miner (right-click it with a citizen)", and seam buttons Q (stone) and W (gold, lit). A citizen sent with `work` held `{k:'shaft', phase:'work'}` and its panel read "Digging the seam". No page errors. Nothing looked broken or unreadable.
- Not checked in a browser: the placement toast (clicked placement through the build menu), the Industrial headframe model, sound.
- AI: `npx tsx scripts/sim.ts 3 medium 30` played to a winner (Hard, 23.4 min); `tests/slow/ai-opponent`, `ai-ore-sweep`, `ai-web`, `ai-winter` all pass (4 files, 11 tests). No code changed.
- Next in lane rules: #555 s0, the route sweeps (see `docs/age-roads.md`).
