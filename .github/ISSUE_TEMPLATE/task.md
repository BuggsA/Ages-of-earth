---
name: Task
about: One piece of work any agent can pick up (docs/team.md)
title: ''
labels: ''
---

<!-- One status label (ready, blocked, owner-decision) and one lane label (lane:rules, lane:ai, lane:look, lane:online, lane:tooling). Add effort:hard if it needs the stronger model (docs/successors.md), with a line here saying why. -->

**What it builds:** one or two sentences, in the player's terms.

**Why:** the owner's words, `docs/design-notes.md` or the umbrella issue it comes from.

**Done when:**
- …
- the checks in `AGENTS.md` §6 pass, with a `## Verification` section.

**Read first:** `AGENTS.md`, `docs/status.md`, `docs/team.md`, and only the files this task needs.

**Files it expects to touch:** …

**Depends on:** #… (or "nothing").

**Lane:** rules, ai, look, online or tooling (`docs/team.md`, "Lanes"). Other lanes' hot files it edits: …

**Saves:** none, or "bumps the save `v`" (claim it on #2 first; `docs/team.md`, "Saves and replays").

**Slow tests:** which files in `tests/slow/` cover it, if any.
