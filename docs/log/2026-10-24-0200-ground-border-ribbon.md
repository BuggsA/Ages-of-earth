# Ground art: borders as ribbons (#623, #617)

Session 5 of chain 1024-0010 (area:ground).

- `borderView.ts`: borders were 1-pixel lines, easy to lose against woods and rain. They are now flat ribbons (0.1 tile of team colour, 0.05 dark rim outside), still on the ground and only where explored. `seasonLook.ts` is logic only; `grazeView.ts` stubble (`#9c8458`) already reads against the ground in the `town` shot, so both are left as they are. `terrain.ts` not touched this pass.
- Shots before/after (`town` compared): the border holds its line over woods at default zoom. Ground L is still under the art.md band because of tone/weather (area:light's).
- Unseen: Low quality, snow, other epochs' borders at other zooms.
- Decision it gives the player: none: look.
