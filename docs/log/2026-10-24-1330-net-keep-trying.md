# The line retries when the tab returns

Owner lost the connection in an online match and could not get back in.

- `src/net/client.ts`: when the tab becomes visible again while a retry is waiting, retry at once (browsers throttle timers in background tabs, so a returning player otherwise waited out the backoff).
- Not changed, and a conflict to settle: `tests/net-client.test.ts` pins six retries (about a minute) and the room's 30 s grace before the computer takes a dropped seat is pinned by `tests/room-connections.test.ts`. Longer limits would help a player who is offline for minutes, but the tests are read-only, so this needs the owner's ruling or a board issue.
- Also open: a rejoin from a different build is refused ("different version"), so a deploy during a match locks players out.

Unverified: not tried against a live room.
