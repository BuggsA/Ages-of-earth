# Double-click as a right-click (owner's ask in chat)

- A double-click (two left clicks within 350 ms and 8 px) on anything but one of your own units gives the units selected before the first click the right-click order there: move, attack, gather, build, repair, shelter. A double-click on your own unit still picks every unit of its kind on screen. `src/ui/doubleOrder.ts`, wired in `main.ts`'s `pointerup`; README controls line.
- The first click still acts as a click (it may deselect or select what is under it for a moment); the second restores the earlier selection and orders it.
- Not covered: the minimap (right-click only), boarding your own transport (it is your unit, so double-click selects its kind).
- Decision added for the player: none: controls.
- Seen in headless Chromium (vite preview, seed 7): 7 citizens box-selected, double-click on open ground → all 7 `move` to the spot; a single click there deselects. `npm run check` passes.
