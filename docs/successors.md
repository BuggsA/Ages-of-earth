# Starting your successor (Claude Code only)

When a Claude Code session finishes a task, it starts the next session itself, so work goes on without the owner starting each one. Other agents can't; their handoffs leave the next session to the owner. 
## Tiers

| Tier | Which issues | Model | Effort |
| --- | --- | --- | --- |
| Regular | every issue without `effort:hard` | `claude-sonnet-5-5` | medium |
| Hard | issues labelled `effort:hard` | `claude-opus-5-5` | high |

- **`effort:hard`** is for work where a wrong answer is costly to find or undo: the deterministic rules and anything that could desync online play, saves, the pathfinding, a failure that survived one fix, a plan for a multi-step feature. Whoever writes or triages an issue adds the label, with a line saying why.
- **The spawner picks the tier** and passes `model` to `create_session`. Effort comes from `.claude/settings.json` on `main`; `create_session` has no effort setting. In Homeward Bound one hard session reported `xhigh` instead of `high`; check it (below).
- **Escalating:** two failed attempts at the same problem means stop. A regular session relabels the issue `effort:hard`, comments what was tried, and releases the claim. A hard session swaps it to `owner-decision` with the question, options and a concrete case for each, releases the claim, and takes another `ready` issue.

## When and how

- **When:** after the task's pull request is merged and the handoff is posted.
- **How:** `create_session` (the claude-code-remote tools) on this repo, in the same environment. If you don't have it, say so in the handoff.

## Before spawning

Check cheaply (one `list_issues` by label with `minimal_output`, and `main`'s last `ci`), never by rereading the docs.
- **Don't spawn** if #2 is labelled `paused`, you merged nothing, `create_session` failed twice, a cap below stops you, or nothing waits in your lane and your chain's last two sessions each shipped only a minor tweak.
- **Don't spawn** from an owner-started chat or one-off, unless asked.
- **Otherwise spawn.** Its task, in order: a red `ci-periodic` or `ci` on `main`, an `owner-ask`, a `ready` issue in your lane, else its own pitch.
- Take related next steps yourself first (`docs/team.md`, "Small and often").

## Chains and caps

A chain is the run of sessions that each start the next.
- **Position:** a session the owner starts by hand is 0; its successor is 1. **Position 8 doesn't spawn:** the platform refuses `create_session` at lineage depth 8 (chain 1016-2001 ended there, 2026-10-16), so the cap is 8, not the 10 the first draft assumed.
- **The id** is the UTC date and time of the chain's first spawn (`1013-1720`). Position 0 makes it up; later sessions copy it.
- **One chain per lane** (`docs/team.md`, "Lanes"), and no limit on how many run at once (the owner, 2026-10-15, `docs/rulings.md`). Before spawning, read the recent `Chain` comments on #2 for the chains under two hours old that don't say "ended". One running in your lane: wait.
- **No daily cap** (the owner, 2026-10-14, `docs/rulings.md`): 8 sessions a chain (the platform's lineage depth) is the only count limit.
- **Log each spawn on #2, with why:** `Chain 1013-1720, 3 of 8, lane rules: <branch> took #42 (regular), started "<child title>" for #57.` When a chain ends: `Chain 1013-1720 ended at 3 of 8: <reason>.` Don't start a new chain yourself: that's the owner's.

## The prompt

Enough for a cold start, and no more; the issue and its last handoff carry the details.

```
You are a building agent for Ages of Earth (BuggsA/Ages-of-earth).
Start per AGENTS.md and docs/team.md: docs/status.md, then the board.
Chain <id>, session <k> of 8. When you finish, follow docs/successors.md.
Your task: #<N> (<regular|hard>). Read the issue and its latest handoff comment. (Or: "No task is waiting: pick a ready issue or pitch your own, AGENTS.md §2.")
Start from: <the files and functions involved, and anything you learned that saves searching>.
Waiting to merge: <pull request and what it waits on, or "nothing">.
```

Pass `model` from the tier, `source_url` for this repo, `outcome_branch` with the child's branch (`claude/<issue>-<topic>`; leave it out when no task is waiting), a `title` like `Chain 1013-1720 3/10 · #57`, and a `chain:<id>` tag. Don't pass `permission_mode` or `extra_allowed_tools`: a child has its parent's permissions, never more.

## Check the child started

A session that ends cleanly doesn't report back. Call `get_session` on the child once and check: not failed (`status_bucket`); `session_context.model` is the tier's; `permission_mode` matches yours; the branch is the one you named; the effort is the tier's. Failed, or the wrong model or permissions: try once more, then no successor, and say so on #2. Only the effort wrong: say so on #2 and carry on.
