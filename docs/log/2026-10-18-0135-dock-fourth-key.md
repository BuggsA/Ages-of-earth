# Dock's fourth button gets hotkey R

Picked up the fix from stale PR #269 (open since 10-15, base far behind `main`), which `main` still lacked: `unitKeys` in `src/ui/hud.ts` had three keys for buildings that train four unit types, so the fourth button read "undefined" and had no hotkey.

- Buildings other than Town Center and Market now use `Q W E R`; a missing key falls back to `''`, so "undefined" can't print.
- `R` is free on those cards: their technologies use `A S D F G`; the town bell and Rallying Cry sit on other selections.
- Not seen in a browser.
- Next: #271, #378, #409 are docs-only PRs on old bases; merge or close them.
