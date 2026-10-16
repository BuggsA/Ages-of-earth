# Speed both ways, and back from the map (#346, #347)

Two of the owner's playtest notes (2026-10-15), both in `src/main.ts`.

- **#346, speed only went up.** The top-bar button called `cycleSpeed(1)`, which clamped at 3×; only the `-` key went down, and nothing on screen said so. Now the button wraps (3× → 1×), right-click on it steps down, and its tooltip says both. `cycleSpeed(d, wrap)`.
- **#347, stuck after "Look around".** In `mode === 'over'` the keydown handler returned before Esc, and `openMenu` returned too, so nothing led back. Now Esc / F10 / ☰ Menu re-open the results card (`showEnd(..., again = true)`: no sound, banner, stars or replay write again; the match length is the one at the end, kept in `lastEnd`). Without a result (an online disconnect) a small "The match is over" card offers Keep looking and Quit to title. Arrow keys pan while looking around. Pressing Look around toasts how to come back.

Tried in headless Chromium (a scratch Playwright script): button 1× → 1.5× → 2× → 3× → 1×, right-click 2× → 1.5× → 1× → 1× (stops at 1×); resign, Look around, Esc brings "Defeat" back, Esc hides it, ☰ Menu brings it back, Quit to title reaches the title; no console errors.

Next: #345 (the minimap feels inverted against the camera) is the other quick playtest note.
