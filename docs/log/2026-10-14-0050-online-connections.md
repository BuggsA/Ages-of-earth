# One live connection per player (#41)

Codex, branch `codex/41-online-connections`, 2026-10-14 UTC.

- Browser reconnects cancel the previous retry and socket. Stale open, message and close events cannot affect the current connection or its heartbeat.
- Normal replacement (`1000`, Opened elsewhere) and policy refusal (`1008`) stop retrying. Recoverable lobby validation errors do not prevent reconnecting after an abnormal network drop. The six-attempt backoff remains bounded.
- The room unregisters replaced connections before closing them and ignores messages from any removed connection. This covers departed hosts whose old seat index now belongs to another player as well as replaced sockets during a match.
- Nine new tests exercise fake socket events and timers. On the original networking code, eight fail and one passes; with the fix, all nine pass. Existing tests are unchanged.
- Synced the Age of Merchants merge from main (`fb1be830470557dcf299735bfc051ab0422ebfe6`); only the networking code, new tests and our documentation entries are included in this task.
- Local environment: installed TypeScript 7 crashes before checking even unchanged main (`vfs: failed to get executable path`, missing `/proc/self/exe`). Used a separate TypeScript 6.0.2 installation for browser and Worker typechecks; no dependency/config/lockfile changes. Default unit-test runs time out on existing map/model sweeps under this container; reran with a 30-second CLI test timeout. Exact final results and GitHub CI evidence are in the PR's Verification section.
- Browser unverified: `/opt/pw-browsers` is absent and Playwright reports its Chromium executable missing. Headless match via Node's tsx loader: seed 3, medium, 1 minute, no winner yet, checksum 1395043734. The ordinary tsx CLI could not create its IPC socket, so the loader bypassed that CLI limitation.
- No balance numbers, simulation rules, save format, protocol shape or deployment configuration changed. No applicable slow tests: existing slow coverage is for campaign outcomes.
- Next: an end-to-end two-browser Worker test for replacement, disconnect and catchup; player playtest of opening the same room in two tabs.
