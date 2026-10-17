# Forward Transfusion Station for the computer (#355 s5)

Branch `claude/cool-rubin-fnbsyw`. Lane `ai`.

- In Total War, once the wave's forward War Camp stands, the computer raises a Transfusion Station beside it (`pitchStation` in `ai.ts`), built by 3 of the wave's infantry, so grafted soldiers at the front stay within `HEMO.reach` of a feed. One at a time; not again for `AI_HEMO.again` seconds.
- New number: `AI_HEMO.forward` = 12 (tiles from the camp a Station counts as "beside" it).
- Tests: two in `tests/ai-hemo.test.ts` (raised beside the camp; not raised when one stands near).
- Not done: win-rate A/B (`scripts/ai-ab.ts`), grafting during an attack, walking the fork ages (needs s2), s4, s6. Unseen in a browser.
