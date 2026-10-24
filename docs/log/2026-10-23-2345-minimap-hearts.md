# Town Centers stand out on the minimap (look only)

The owner asked that Town Centers the viewer has found clearly show on the minimap. They were drawn like any other building: a small square in the owner's colour.

- `src/ui/minimap.ts`: every Town Center the viewer knows of (seen, and remembered under fog) is drawn last, after the other buildings, as a larger square in its people's colour with a pale rim and a dark heart; at least 4.5 canvas px a side, so it stays readable on a large map. The known-buildings list now carries `type` (`view.ts`, `knownBuildings`).
- Headless Chromium, `?seed=7`: the home Town Center shows as a blue square with a pale rim and a dark heart on the minimap at the start. A found rival Town Center, and a large map, were not looked at.
- `npm run check` run before merging; see the pull request.
- Decision added for the player: none (look); it makes rival towns easier to find and a scout's work easier to read.
