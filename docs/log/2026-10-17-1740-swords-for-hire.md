# Swords for hire: mercenary wages in the Age of Merchants

Own pitch (the age was a few percentages). Soldiers hired at a Market now carry `Unit.merc` (paydays missed) and draw `MERC.wage` = 2 gold every `MERC.every` = 15 s; at `MERC.patience` = 2 missed paydays they walk off (hp 0 in `merc.ts`). A `wages` event drives a toast; the unit panel shows 💰 Hired/Unpaid; the hire button and the age blurb say so. The computer (`ai.ts`) hires only with `AI_MERC.reserve` = 6 paydays per sword left in the purse.

Numbers added to `src/sim/data.ts`: `MERC`, `AI_MERC`. No existing number changed. No save bump (optional fields).

Tested: `tests/merc.test.ts`. Browser and win rates: not tried.
Next: bribing a rival's sword; a walk-off sound.
