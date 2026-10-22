# Status

Current state only: what's blocked and what waits on the owner. Finished work goes in `docs/log/`; old entries are in `docs/status-archive.md` (not startup reading).

## Standing rulings

Full list, in the owner's words: `docs/rulings.md`.

- **Autonomous team** (2026-10-13, reaffirmed 10-14): claim from the board, build, merge your own PRs under `docs/team.md` "Merging"; Claude Code sessions start successors (`docs/successors.md`).
- **Co-designers** (2026-10-13): no approval for design, numbers, looks, sounds or words; only the hard stops wait (`AGENTS.md` §2–3).
- **Rich play, not a mechanical race** (2026-10-14): give players real choices (`docs/design-notes.md`, "Richness").
- **Seeds** (2026-10-14) and **the vision** (`docs/vision.md`) are inspiration, not rules.
- **Goals** (2026-10-17): branch the opening (#463), every PR names the decision it adds (`docs/goals.md`).
- **The age road** (2026-10-22): build your empire through ages the land unlocks, going back when it helps; new ages welcome again (#555, `docs/age-roads.md`).
- **Save tokens** (2026-10-16): short docs, focused tests while building, spawn successors only when worth it.

## Checks

| Check | State |
| --- | --- |
| Quick tier (`npm run check`) | 743 tests, ~85 s on 4 cores (2026-10-17) |
| Slow tier (`tests/slow/`) | campaign proofs, long AI matches, browser smoke; daily in `periodic` |
| Coverage | rules 83–100%; rendering, sound, HUD and `main.ts` untested, checked by hand |

## In flight

Claims and open PRs live on the board (`claimed`, `in-review`). List here only what the board can't show: a blocker, or something half-merged.

- None listed.

## Waiting on the owner

- **`periodic` never fired on its schedule** (by 2026-10-14). Check Settings → Actions allows scheduled workflows.
- Optional: Settings → General → "Automatically delete head branches".
- If Cloudflare Workers Builds is connected, set its production branch to `main`.
- Other agent tools (Codex etc.): run `npm install` as a setup step.
- Many features are unseen in a browser or want an ear for their sound levels; each says so in its log or archive entry.

**Defaults in force, flagged:** saves may break when a change bumps their `v` (`docs/team.md`, "Saves and replays"); CI costs ~2 min a run of 2,000 free a month; chain caps are 8 a chain (the platform's lineage depth), one per lane (`docs/successors.md`); the quick-tier budget (2 min) is a draft.
