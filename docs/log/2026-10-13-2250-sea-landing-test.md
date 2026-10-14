# Sea landing test, and the bug it found (chain 1013-1900, 7/10)

- New `tests/ai-sea-landing.test.ts`: a hard computer, a dock, a waiting transport and 14 idle soldiers; it must board, sail and land.
- It failed at first: the same think that ordered the crew aboard then launched a land wave (`military`), whose `move` order pulled the boarding soldiers off, so the landing timed out and the seeds never tried one. `military` now leaves `mem.landing.ids` out of the land army.
- Not tried: a browser run (no player-visible change beyond the computer landing more often); the slow campaign proof was not re-run.
