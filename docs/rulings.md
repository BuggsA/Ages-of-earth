# The owner's rulings

A ruling counts when it quotes the owner and says where (`docs/team.md`, "Claims, handoffs and takeovers"). Add new ones at the end, dated. If one changes how things get built, add a line to `docs/status.md`'s standing rulings too.

- 2026-10-13: **port Homeward Bound's multi-agent system** (the owner's chat with Claude Code, session `hopeful-feynman`). Asked whether that system makes sense, then: "I am thinking about getting this concept ported in ages of empire could you help?" Asked four questions, the owner chose:
  - **Base branch:** "Create main". `main` was made from `claude/beautiful-franklin-6gj8tt` (a29e3ad), and pull request #1 retargeted to it; switching the default branch is the owner's.
  - **Autonomy:** "Full, like Homeward": agents claim, build, merge their own pull requests under the checklist, and start successor sessions (chains, caps, Sonnet and Opus tiers).
  - **Other agents:** "Yes, mixed tools": the rules live in `AGENTS.md`, which `CLAUDE.md` imports.
  - **Tests:** "The one thing is the tests can often eat a lot of the build time. If there were more periodic build tests. Sometimes check can take 20-35 mins and each agent might do a check after each change. It eats up a lot of time." So the three tiers in `AGENTS.md` §5, with the slow tier run daily by GitHub Actions. Choosing GitHub Actions for it, and the 10-second and 2-minute lines, are this session's reading, flagged in `docs/status.md`.
  - Not chosen, so not built: a playtest checkpoint (pausing features until the owner playtests) and a flaky-test rule.
