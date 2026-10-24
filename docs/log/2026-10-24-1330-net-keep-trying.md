# The line keeps trying

Owner lost the connection in an online match and could not get back in.

- `src/net/client.ts`: up to 60 retries (about ten minutes; delay capped at 10 s) instead of 6 (about a minute), and a retry at once when the tab becomes visible again.
- Not changed: the room's 30 s grace before the computer takes a dropped seat (`worker/room.ts` `GRACE_MS`, pinned by `tests/room-connections.test.ts`), and the refusal of a rejoin from a different build. Both are open questions for the owner.

Unverified: not tried against a live room; `tests/room-connections.test.ts` and typecheck only.
