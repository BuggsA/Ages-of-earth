# Rematch in online rooms (#746, s3b of #724)

- **Decision added:** take back the road your friend beat you on, at once, on the same land.
- **Built:**
  - `ClientMsg` `rematch {on}` and `ServerMsg` `rematch {voted, need, mine}` (`src/net/protocol.ts`).
  - `Room.tallyRematch` / `Room.rematch` (`worker/room.ts`): a vote counts per seat; the room starts over when every person *connected* has voted. A player who left or dropped is not waited for, and their vote is forgotten. The restart keeps seats, setup (seed) and resolved peoples, wipes the turns, hashes and `gone`, re-sends `start` to players and watchers, and saves.
  - End screen (`showEnd` in `src/main.ts`): a Rematch button online (not for watchers) that reads "Rematch (1 of 2 ready)" / "Waiting for the others (1 of 2)" and toggles the vote.
- **Security:** a vote acts only on the room whose seat sent it, never on another's seat; one player cannot restart a room with other people connected.
- **Known gap:** the room can't tell a match is over (it never runs the rules), so people who all press Rematch mid-match restart it by consent. Watchers can't vote.
- **No save change;** the room's stored shape (`Kept`) is unchanged, so no `v` bump and no Durable Object migration.
- **Checks:** see the pull request's `## Verification`.
