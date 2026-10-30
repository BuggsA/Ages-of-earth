# Missile playtest, second pass (#787, #773), chain 1029-2312 session 7

No rules or numbers changed (`INTERCEPT`, `SILO`, `SALVO`, `AI_SILO` as on `main`). The 2026-10-24 notes and `scripts/reserve-probe.ts` (PR #791) are rebased onto current `main`.

**Browser (Chromium, software GL, vite dev, Low quality, 800x450, `window.ages` + `import('/src/sim/game.ts')` to issue commands, `ages.fast(32)` to skip the 30 s arming):** a Romans-vs-Britons match set to Atomic, both sides with a silo, the rival with Interceptors and a battery and its silo held in Reserve; I launched at the rival's Town Center.
- Seen by eye: the launch's rings over the target (an amber ring and a thinner teal one, plus a tan arc), the same ring on the minimap; the interceptor's grey trail climbing from the battery; the white burst with two grey puffs and no blast; the toast "Your warhead was intercepted: no blast".
- Read well: the rings and the trail. Read badly: nothing in the effects. Not new, but it bit the playtest: at 560x360 the HUD panels cover the whole view; at 800x450 with panels hidden it is fine.
- Not seen: whether the battery or the Reserve silo made the stop (the rival's land was fog, so the silo and its answering warhead were never drawn); sound; a miss flying on (the 0.6 draw hit this run). The headless Reserve answer (45.05 s fire, 46.05 miss, 47.05 strike) is in the first log entry.
- Software GL runs the game at ~2 ticks a second, so a launch's 45 s fuse takes minutes of real time: a person's playtest of the whole flight is still the owner's to do on a real GPU.

**Numbers:** left. No evidence from play to move `chance` 0.6, `reach` 12, `reload` 90, `arm` 30, `think` 10; the one computer sweep (previous entry) says the computer rarely meets missile defence in a match, so win rates would not move.

**Next, if someone wants it:** a viewer who has a unit beside a rival silo to see a Reserve answer; teach the computer Interceptors earlier in an Atomic start, then sweep.
