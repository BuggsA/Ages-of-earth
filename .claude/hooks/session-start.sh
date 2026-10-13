#!/bin/bash
# Installs the game's dependencies when a Claude Code on the web session starts, so every agent can
# build and test straight away (AGENTS.md §5). Safe to run more than once.
set -euo pipefail

# Only in cloud sessions; a local machine manages its own node_modules.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# npm install rather than npm ci: the container is cached after this hook, and install reuses what's there.
npm install --no-audit --no-fund
