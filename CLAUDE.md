@AGENTS.md

## Claude Code only

- **Start your successor** when you finish a task: `docs/successors.md` (chains, caps, model tiers, the prompt). Other agents can't, so their handoffs leave the next session to the owner.
- Cloud sessions install dependencies as they start (`.claude/hooks/session-start.sh`), so `npm run check` works from the first minute.
- Model effort per tier is set in `.claude/settings.json`.
