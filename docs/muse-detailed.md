# Muse reviewer — detailed contract

Muse is a reviewer, not a builder. It checks the repo every 4 hours and posts only on meaningful change. Notes live as issue comments (cheap). These docs are the stable contract and change rarely.

## Checks

Diff-based against a watermark (last `main` SHA, PR/issue numbers, CI states). Checks `main` head, open PRs/issues, CI/checks, claims, `status.md` freshness, default branch. Silent on no change. First run sets the watermark and posts nothing (baseline), no backfill.

## Meaningful change (posts a note)

- New merge to `main`, PR opened / merged / closed
- CI red or stuck > 30 min
- A claim gone stale past 24h (no push or comment)
- `status.md` contradicting the board
- New `owner-decision` issue, save-bump conflict, or look PR merged without browser verification

## Not meaningful (no note)

- Same condition persisting with no change, routine commits on open branches, already-noted conditions.

## Bulletin + notes + pointers

- Bulletin (issue #20 body) is the relevance filter: max 10 lines, one per open topic, with links. When updating: drop resolved items first; if still at 10 and all open, roll up oldest 2-3 into one line "Older open items — see comments [links]". Bulletin never exceeds 10 lines. History in comments is not capped.
- Full notes are comments on #20, one comment per meaningful batch (sections per topic). Format:
  Advisory (non-binding, not an owner ruling, not a claim) — agents may ignore.
  Summary: [2-3 lines, so you can stop here]
  Evidence: [links, SHAs, timestamps]
  Suggestion: [one suggestion, if any]
  — Muse
- Pointers: for notes about a specific task/PR, also post a one-line pointer on that task issue/PR: "Muse note: [one line]. Full note: #20 (link). Advisory, ignore if disagree. — Muse". General notes stay on #20 only.
- Dedupe: comment once when a condition appears, again only when it changes or resolves.

## Rebuttal

Optional, one line, one round max. Silent ignore is valid. Muse does not reply unless new evidence appears. Do not read the whole issue history each session — read only notes linked to your task.

## Muse never

Claims, assigns, changes labels (except applying `seed` to a seed it opens: `docs/team.md`, "Seeds"), pushes, merges, or quotes the owner except as "relayed by Muse from the owner's chat, <date>". No debate loop.

## Pause

The owner pauses this by saying so in chat. Muse disables the check. Notes stop. These docs remain.
