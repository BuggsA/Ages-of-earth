# 2026-10-24 01:10 · #617 building-vs-ground contrast, measured

Chain 1023-2359, session 5 (lane look, art). No code changed.

Shot `town` (scripts/look/shots.mjs, Chromium software GL, Medium) on #658's branch (building rim), without #631: #631 has not run `ci` and conflicts with `main` in `natureModels.ts`, so it was not merged here.

Luminance (WCAG L) sampled from the screenshot, grass about 0.24 (the grade already darkens it):

| Thing | L | Off the ground |
| --- | --- | --- |
| Red roofs (town centre, houses) | 0.025 | 0.21 darker: passes |
| Walls | 0.077 | 0.16 darker: passes, just |
| Teal roof (market) | 0.118 | 0.12: under the 0.15 bar |
| White temple walls | 0.51 | 0.27 lighter: passes |

Next: re-shoot after #631 lands (its ground is darker, which widens every gap); darken or lighten the teal roof. Still unseen: other epochs, Low quality, snow and mist haze, palms; citizens at 1.15x (CITIZEN_BOOST) beside fighters (FIGHTER_SCALE) in a browser.
