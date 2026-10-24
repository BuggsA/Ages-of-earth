# Online rooms keep their match for 36 hours (owner's ask in chat)

- `worker/room.ts`: a started match (seats, setup, peoples, pause, which seats the computer took, every turn in 200-turn chunks) is written to the room's Durable Object storage at the start, every 10 s of play, and when anyone leaves, pauses or the line desyncs. A fresh object (evicted, or a deploy) loads it before it answers. An alarm 36 h (`ROOM_KEEP_HOURS`, `src/net/protocol.ts`) after the room last emptied clears it, unless someone is in.
- An empty room runs no turns and hands nobody to the computer (grace timers are cleared when the last player leaves, and armed again for those still away when someone returns). A paused match never hands a seat over. Leaving a paused match from the menu doesn't send `leave`.
- A seat the computer took is given back when its player returns: the room sends `leave` with `back` (only the room may; a browser's `back` is dropped). The rules keep `Player.left`. Not a new command type, since `tests/command-ownership.test.ts` (read-only) lists every one.
- A browser with no seat in a match under way is offered the away players' seats (`open` / `claim`), and turned away if every seat is connected. Owner's ruling in `docs/rulings.md`.
- A newer build arriving at an empty room is adopted, so a deploy no longer locks the room; everyone replays the match on the new rules, which may differ a little from where they left it.
- The disconnect banner now says to reload or rejoin the code.
- Decision added for the player: when to stop for the night, and whether to pause first; none in play.
- Verified: `npm run check`; `tests/room-keep.test.ts`; end to end on `wrangler dev` with storage persisted: two browsers started, played and paused; the Worker was stopped and restarted on a different build; Alice's browser came back to her seat, still paused; a new browser was offered Bob's seat, took it, and the match ran on after unpausing.
- Not verified: a real Cloudflare deploy, the 36-hour alarm firing (only its time was checked), long matches near storage value limits.
