# Status

Read at the start of every session. Current state only: what runs, what's blocked, what waits on the owner. Finished work goes in `docs/log/`, not here; the old ledger is `docs/status-archive.md` (history, not startup reading).

## Standing rulings

Full list, in the owner's words: `docs/rulings.md`.

- **Autonomous team** (2026-10-13, reaffirmed 10-14): claim from the board, build, merge your own PRs under `docs/team.md` "Merging"; Claude Code sessions start successors (`docs/successors.md`).
- **Co-designers** (2026-10-13): no approval for design, numbers, looks, sounds or words; only the hard stops wait (`AGENTS.md` §2–3).
- **Rich play, not a mechanical race** (2026-10-14): give players real choices (`docs/design-notes.md`, "Richness").
- **Seeds** (2026-10-14) and **the vision** (`docs/vision.md`) are inspiration, not rules.
- **Save tokens** (2026-10-16): short docs, focused tests while building, spawn successors only when worth it.

## Checks

| Check | State |
| --- | --- |
| Quick tier (`npm run check`) | 614 tests, ~100 s on 4 cores (2026-10-16) |
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

**Defaults in force, flagged:** saves may break when a change bumps their `v` (`docs/team.md`, "Saves and replays"); CI costs ~2 min a run of 2,000 free a month; chain caps are 10 a chain, one per lane (`docs/successors.md`); the quick-tier budget (2 min) is a draft.
