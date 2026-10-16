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

## Before spawning: is it worth it?

A new session costs its startup (the docs, the board, finding the code) before any work. Spawn only when it will earn that. Check cheaply: one `list_issues` by label with `minimal_output`, and `main`'s last `ci` run; don't reread the docs.

1. **Don't spawn** (checked first) when: #2 carries the `paused` label (the owner's stop switch); you are position 10; your session merged nothing; `create_session` failed twice; another chain in your lane is under two hours old and not "ended"; or nothing waits in your lane and your chain's last two sessions each shipped only a minor tweak (a number, a word, a small look change).
2. **An owner-started session** that wasn't working the board (a chat, a one-off) doesn't spawn unless the owner asks.
3. **Otherwise spawn.** It takes, in order: a red `ci-periodic` or `ci` on `main`, an `owner-ask`, a `ready` issue in your lane; with none, it pitches its own (`AGENTS.md` §2).
- **Related next step** (up to 3 a session, `docs/team.md` "Small and often"): take it yourself while the code is loaded and cheap to reread, rather than spawning for it.
- **Say why** in your #2 line: what you shipped, and why you spawned or ended.

## Chains and caps

A chain is the run of sessions that each start the next.
- **Position:** a session the owner starts by hand is 0; its successor is 1. **Position 10 doesn't spawn.**
- **The id** is the UTC date and time of the chain's first spawn (`1013-1720`). Position 0 makes it up; later sessions copy it.
- **One chain per lane** (`docs/team.md`, "Lanes"), and no limit on how many run at once (the owner, 2026-10-15, `docs/rulings.md`). Before spawning, read the recent `Chain` comments on #2 for the chains under two hours old that don't say "ended". One running in your lane: wait.
- **No daily cap** (the owner, 2026-10-14, `docs/rulings.md`): 10 sessions a chain is the only count limit.
- **Log each spawn on #2:** `Chain 1013-1720, 3 of 10, lane rules: <branch> took #42 (regular), started "<child title>" for #57.` When a chain ends: `Chain 1013-1720 ended at 3 of 10: <reason>.` Don't start a new chain yourself: that's the owner's.

## The prompt

Enough for a cold start, and no more; the issue and its last handoff carry the details.

```
You are a building agent for Ages of Earth (BuggsA/Ages-of-earth).
Start per AGENTS.md and docs/team.md: docs/status.md, then the board.
Chain <id>, session <k> of 10. When you finish, follow docs/successors.md.
Your task: #<N> (<regular|hard>). Read the issue and its latest handoff comment. (Or: "No task is waiting: pick a ready issue or pitch your own, AGENTS.md §2.")
Start from: <the files and functions involved, and anything you learned that saves searching>.
Waiting to merge: <pull request and what it waits on, or "nothing">.
```

Pass `model` from the tier, `source_url` for this repo, `outcome_branch` with the child's branch (`claude/<issue>-<topic>`; leave it out when no task is waiting), a `title` like `Chain 1013-1720 3/10 · #57`, and a `chain:<id>` tag. Don't pass `permission_mode` or `extra_allowed_tools`: a child has its parent's permissions, never more.

## Check the child started

A session that ends cleanly doesn't report back. Call `get_session` on the child once and check: not failed (`status_bucket`); `session_context.model` is the tier's; `permission_mode` matches yours; the branch is the one you named; the effort is the tier's. Failed, or the wrong model or permissions: try once more, then no successor, and say so on #2. Only the effort wrong: say so on #2 and carry on.
