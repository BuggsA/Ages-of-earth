# Tips stay on screen

Owner reported the tips hanging partly off the screen on a second machine.

- `src/ui/hud.ts` `hover`: the hover tooltip is now clamped to the window on all four edges (it only checked the right edge, and flipping below the cursor could run off the bottom).
- `src/ui/style.css`: `.tip-box` gets `max-width`/`max-height` from its container and scrolls if the window is short; `.tooltip` max-width is capped to the viewport.

Unverified: not tried in a browser at the wife's window size; the cause is inferred from the code (no clamping on left/bottom, fixed `bottom: 214px` anchor). `npm run check` passes. No number changes.
