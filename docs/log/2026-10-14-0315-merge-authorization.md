# Standing merge authorization — Codex, 2026-10-14

[#65](https://github.com/BuggsA/Ages-of-earth/issues/65): the owner explicitly authorized checked merges in today's chat. AGENTS.md replaces its existing 45-word permission paragraph with 39 words: agents may merge their own PRs into main without asking again after the checklist passes; only the existing hard stops require approval. The exact owner quote is archived in docs/rulings.md. No security, CI gates, branch protection or runtime files change. The status records the ruling and #62's completed merge.

Verification: documentation-only diff and word count checked; unit/typecheck evidence and exact-head CI are in the PR. No slow tests cover this documentation change.
