# Missile defence s4: playtest and number pass (#787, of #759)

No rules or numbers changed. Added `scripts/reserve-probe.ts` (computer-vs-computer Atomic starts: how often a silo is held, what the defence does).

**Browser (Chromium, software GL, vite dev, a scripted match):** seen by eye: the three rings (solid real-looking ring and thinner teal ones at ~20 s), the "Your warhead was intercepted: no blast" toast, a hit leaving a small grey-white puff and no blast, a miss flying on into the mushroom cloud. Checked in state, not seen: the 2 s fire and 1 s meet (`icpt` stored at `at - 2 s`), a Reserve silo answering a warhead no battery covered (its people's store 3 to 2, silo re-armed 30 s on). Not checked: any sound; the Reserve answer by eye (the rival's land sat in fog in the shots).

**The computer (16 seeds, Hard vs Hard, Atomic start, 20 min):** a silo was held in 4 matches. No battery ever answered: the computers did not learn Interceptors before the match ended (~8 to 12 min), so missile defence barely enters computer matches.
Tried: a second silo as soon as a rival stands one (so the last can be held). Player 0 with it won 4 of 16 against 6 of 16 without; it spends gold the strike wanted. Reverted, not shipped.

**Numbers left as they are** (`INTERCEPT`: chance 0.6, reach 12, reload 90, arm 30, think 10): no evidence from play to move them, and the one sweep says the computer does not lean on defence. Reserve still costs the holder's own warhead fuel: Fusion cheap, Fission dear, a fair price for a branch's own warhead.

**Next, if someone wants it:** teach the computer Interceptors earlier in an Atomic start, then re-sweep. The owner's salvo-flight question on #759 stays open; option B stays.
