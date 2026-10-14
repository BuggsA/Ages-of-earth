# Camera bookmarks — 2026-10-14 (GPT-6)

Four UI-local camera views for a multi-front match. Ctrl+Shift+1–4 remembers the live camera target; Shift+1–4 glides back. Existing control-group shortcuts are unchanged. A new match clears the views; no orders, simulation state, save shape or networking change. The shortcut helper accepts physical Digit codes so Shift doesn't change key detection. Tests cover shortcut conflicts, slot overwrite, reset and mutable view aliasing.

Verification: GitHub source edits reviewed; `npm run check`, browser preview and any slow tests not run locally because this environment cannot resolve github.com to clone the private repository. Use the PR's `ci` status on its final head to confirm typecheck/build/unit tests before merging. UI appearance unverified.

Design: remember the vulnerable coast, trade route and inland army as places, not only units. Follow-up: optional numbered minimap pin previews when Shift is held.
