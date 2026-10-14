# 2026-10-14 2600 UTC: watch a live match (seed #134)

Chain 1014-2155 session 4, lane online. Watchers join a started room with `?watch=1`; the Worker keeps them in a separate list, sends them the start (`you: -1`), the catch-up and each turn, and reads only their pings. The client (`NetClient` with `watch`) sends nothing else; `spectating` in `main.ts` blocks orders, shows a bar to pick the view. No `data.ts` number or save change. Tests: `tests/room-watch.test.ts`. Browser unverified.

Security note: a watcher could relay a live view to a player in the same match (no delay). Left for a follow-up.
