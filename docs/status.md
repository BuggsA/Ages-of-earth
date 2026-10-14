# Status

**Read this at the start of every session** (`AGENTS.md`), with `docs/team.md` and the board. Keep it short: where the build stands, what's in flight, what waits on the owner. Change only your own rows. Updated 2026-10-14.

## Standing rulings

The full list, with the owner's words, is `docs/rulings.md`.

- **Agents work as a team** (2026-10-13), as in Homeward Bound and fully autonomous (standing merge authorization reaffirmed 2026-10-14): they claim from the board, build, merge their own pull requests under the checklist (`docs/team.md`, "Merging"), and Claude Code sessions start their successors (`docs/successors.md`).
- **Agents are co-designers** (2026-10-13): real creative freedom and no approval for design calls, numbers, looks, sounds or words; they pitch and build their own ideas. Only the hard stops wait for the owner (`AGENTS.md` §2–3).
- **The owner's "game vision" is inspiration, not a rule** (2026-10-13): `docs/vision.md`, for agents to glance at and build toward if it sparks something.
- **Any agent tool may work here:** the rules live once, in `AGENTS.md`.
- **The base branch is `main`.**
- **Tests:** agents run the quick tier; the slow tier runs on a schedule in CI, not after every change (`AGENTS.md` §5).

## The build

Everything in `README.md`'s "What's in it" was built on 2026-10-12 in one session (branch `claude/beautiful-franklin-6gj8tt`, now `main`): five epochs, six peoples, the economy, seventeen buildings, twenty-six technologies, counters, siege, priests, heroes, walls and the bell, ships, fishing and aircraft, the computer opponent, online rooms, saves, replays, synthesized sound and music.

Since then, all on 2026-10-13: **relics** (#4, merged in #5), **trade**: traders and trading posts (#6, merged in #10; the save `v` is 3), and **the campaign**, The Long Road (#9, merged in #11; from an earlier session's unmerged branch). The computer plays a chapter's goals, so all six chapters are shown winnable (#12, #24), Wings over the Steppe and Sea Lords only at Hard. The proof plays up to 16 maps a chapter, so one chaotic match no longer flips it (#43, merged in #51); Wings is still won on few maps (#36), fewer since every computer trades for real (#42).

| Check | State |
| --- | --- |
| Quick tier (`npm run check`) | about 170 tests, about 20 s |
| Slow tier (`tests/slow/`) | `campaign-proof*.test.ts`: every chapter won by a computer on its own map or, at Hard, one of 15 more (#43); three files side by side, about 3½ minutes on a cloud container |
| Browser checks | none automated; the first session tested by hand in headless Chromium |
| CI (`ci`, `periodic`) | added 2026-10-13; `periodic` starts once `main` is the default branch |

## In flight

- [#79](https://github.com/BuggsA/Ages-of-earth/issues/79), the computer walks the web well (claimed, lane ai), and [#80](https://github.com/BuggsA/Ages-of-earth/issues/80), the Seed Atlas (in review, lane tooling).

Merged since the last update: **camera bookmarks** (#76, merged in #77: Ctrl+Shift+1–4 saves a view, Shift+1–4 returns to it), **the workforce ledger** (#73, merged in #74: the Workers panel counts and selects citizens by job), **weather** (#78), **the computer walks the web of ages** (#50, s4 of #37): Normal and Hard survey and dig into the Iron Age, take the merchants' road and hire at the Market, turn pilgrim and back, take the Fairs, mass archers against an Iron rival and waylay a merchant rival's traders by a trading post; numbers in `AI_WEB` (`src/sim/data.ts`); `npx tsx scripts/web-walk.ts` shows the roads computers take, and with `duel` how a web walker fares against one kept to the trunk (on Hard it lost more than it won, 3–10 over 48 matches with 35 undecided: `docs/log/2026-10-14-1100-computer-web.md`); no save bump. **The two-front war** (#36: the Tsar plays Easy in Wings, a chapter seat strikes a rival's wonder first; Wings maps won at Hard 4/16 → 8/16), **ancient ruins** (#64, also a fix to `Music.style()` recursing outside side ages), **health bar quarter marks** (#68, Codex); the web of ages and its map and looks (above); computer traders judging the road they walk (#53, which made Wings over the Steppe harder: 8/16 maps at Hard became 4/16, see #36); the campaign proof over 16 maps a chapter (#51); Wings in the proof (#45); repairs (#1) and Market recovery indicators (#32); one live connection per online player (#44); browser-free shipping (#33); idle citizens together (#62: Shift + . selects them all); **allied trade** (#60, #63, #66: allies with a Market take `TRADE.ally`, a quarter, of each teammate's trade trip; a Market-less player may set out from an ally's Market; own coin effect and `tradeShare` sound; browser unverified, the sound level wants an ear); standing merge authorization (#67).

**Weather** (own pitch, lane look): a seeded day per match (clear, rain, snow, mist; storms with lightning and thunder), look and sound only, no rules or save change. Seen in headless Chromium on the title screen only; the sound levels want an ear.

## Waiting on the owner

**Setup only the owner can do:**
1. ~~Default branch → `main`~~: done (2026-10-13). But the daily `periodic` run has never fired on its schedule (no runs at all by 2026-10-14 11:40 UTC); it was started by hand once. If it still never runs on its own, check Settings → Actions that scheduled workflows are allowed.
2. Optional: Settings → General → "Automatically delete head branches", so merged branches tidy themselves.
3. If Cloudflare Workers Builds is connected, set its production branch to `main`.
4. ~~Workers Builds failing on every pull request~~: fixed by `[previews]` in `wrangler.toml` (#23); it has passed on every pull request and on `main` since.
5. Other agent tools (Codex and the like): give their environments `npm install` as a setup step.
6. Nothing else is needed for agents to start: with an empty board they pitch their own work. To steer them, open issues labelled `owner-ask` (they go before pitches).

**Defaults in force, flagged:**
- Saves and replays aren't tied to a build; a change may break older ones, as long as it bumps the save's `v` (`docs/team.md`, "Saves and replays").
- CI uses GitHub Actions, about 2 minutes a run: ten pull-request pushes a day comes to roughly 600–700 of the 2,000 free minutes a month.
- Chains no longer end when the board is empty, since agents pitch their own work, so they run to their caps (10 sessions a chain, 20 a day, `docs/successors.md`). Lower the caps if the usage limits pinch.
- The 10-second line for slow tests and the 2-minute budget for the quick tier (`AGENTS.md` §5) are drafts.

**Health bar quarter marks** (#68, Codex): three fine divisions support reading health without color alone. 173 unit tests and TypeScript 5.9 fallback checks pass locally; the pinned TypeScript 7 compiler crashes in this container. Browser appearance unverified (Chromium absent); final pinned checks run in CI. No balance or save changes.



**Workforce ledger** (#73, GPT-6): a read-only Workers dropdown in the HUD groups citizens by current job and selects a group on click; no sim or save changes. Browser appearance unverified; CI verification in PR.

**Seed atlas** (#80, lane tooling): `scripts/seed-atlas.ts` finds seeds by what the map holds (bog iron, posts, relics, ruin finds); no sim, UI or save change. `--share` prints `?seed=` addresses; the title screen reads them.
