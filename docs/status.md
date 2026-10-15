# Status

**Read this at the start of every session** (`AGENTS.md`), with `docs/team.md` and the board. Keep it short: where the build stands, what's in flight, what waits on the owner. Change only your own rows. Updated 2026-10-14.

## Standing rulings

The full list, with the owner's words, is `docs/rulings.md`.

- **Agents work as a team** (2026-10-13), as in Homeward Bound and fully autonomous (standing merge authorization reaffirmed 2026-10-14): they claim from the board, build, merge their own pull requests under the checklist (`docs/team.md`, "Merging"), and Claude Code sessions start their successors (`docs/successors.md`).
- **Agents are co-designers** (2026-10-13): real creative freedom and no approval for design calls, numbers, looks, sounds or words; they pitch and build their own ideas. Only the hard stops wait for the owner (`AGENTS.md` §2–3).
- **Seeds** (2026-10-14): ideas nobody is building yet are `seed` issues that agents and the Muse grow together; anyone may build one through a pitch, with no approval (`docs/team.md`, "Seeds").
- **Rich play, not a mechanical race** (2026-10-14): the owner finds the opening feels like "designated steps"; build choices, risks and surprises into play, starting with the Stone Age (`docs/design-notes.md`, "Richness").
- **The owner's "game vision" is inspiration, not a rule** (2026-10-13): `docs/vision.md`, for agents to glance at and build toward if it sparks something.
- **Any agent tool may work here:** the rules live once, in `AGENTS.md`.
- **The base branch is `main`.**
- **Tests:** agents run the quick tier; the slow tier runs on a schedule in CI, not after every change (`AGENTS.md` §5).

## The build

Everything in `README.md`'s "What's in it" was built on 2026-10-12 in one session (branch `claude/beautiful-franklin-6gj8tt`, now `main`): five epochs, six peoples, the economy, seventeen buildings, twenty-six technologies, counters, siege, priests, heroes, walls and the bell, ships, fishing and aircraft, the computer opponent, online rooms, saves, replays, synthesized sound and music.

Since then, all on 2026-10-13: **relics** (#4, merged in #5), **trade**: traders and trading posts (#6, merged in #10; the save `v` is 3), and **the campaign**, The Long Road (#9, merged in #11; from an earlier session's unmerged branch). The computer plays a chapter's goals, so all six chapters are shown winnable (#12, #24), Wings over the Steppe and Sea Lords only at Hard. The proof plays up to 16 maps a chapter, so one chaotic match no longer flips it (#43, merged in #51); Wings is still won on few maps (#36), fewer since every computer trades for real (#42).

| Check | State |
| --- | --- |
| Quick tier (`npm run check`) | 407 tests, 81 s on a 4-core cloud container (2026-10-15; 157 s under load before #234); `trade.test.ts` and `seed-atlas.test.ts` moved to `tests/slow/` (#110), `ai-winter`, `lords`, `relics`, `ai-forward-tower` and `ruins` (#234), `ai-rival-heirlooms` (14 s of a 15 s limit); `sim.test.ts` stays because it holds the determinism scan |
| Slow tier (`tests/slow/`) | `campaign-proof*.test.ts`: every chapter won by a computer on its own map or, at Hard, one of 15 more (#43); three files side by side, about 3½ minutes on a cloud container |
| Coverage (2026-10-14) | rules (`src/sim/`) 83–100% of lines; rendering, sound, HUD, lobby, minimap and `main.ts` 0%: checked only by hand in a browser |
| Browser checks | `tests/slow/browser-smoke.test.ts` (#87): title, Web of Ages, Campaign, a match and its hotkeys in headless Chromium, failing on any page or console error; daily in `periodic`, screenshots kept as an artifact |
| CI (`ci`, `periodic`) | added 2026-10-13; `periodic` starts once `main` is the default branch |

## In flight

- **Borders and supply** (#132, all steps built): borders shown, attrition, building only in your own land, the computer reading borders and raising a forward Tower (`AI_RAID.fort`, `.pop`). Browser unverified. The forward Tower vs none (`AI_LEVELS.fort`, `scripts/ai-ab.ts`): 24 matches, no difference seen (#149).

- [#113](https://github.com/BuggsA/Ages-of-earth/issues/113) (a beaten computer doesn't freeze) and [#80](https://github.com/BuggsA/Ages-of-earth/issues/80) (the Seed Atlas) are closed; their notes are in `docs/log/2026-10-14-1730-beaten-town.md` and the Designers' notes. [#150](https://github.com/BuggsA/Ages-of-earth/issues/150), a seeded wind that leans the smoke (lane look), is in review as #151.

Merged since the last update: **the seeds board** (#137, closes #131: ideas nobody is building yet are `seed` issues, `docs/team.md` "Seeds"), **tests for untested modules** (#130), **walking the web without losing strength** (#79): the computer surveys at 22 citizens, doubles its diggers while it holds for the iron deed and sends them back to work once it's dug, raises the merchants' early Market only when no soldiers are owed, and answers a barred counter with the best line its age keeps; over 144 duels against a trunk computer the walker went 25–38 → 27–30 and gives up about 5% of its gathering instead of 12%; after today's merges the issue's own 48 go 11–8 (new `main`: 7–7), though there the walker still gathers about 11% less (#113) (`docs/log/2026-10-14-1400-web-strength.md`; new number `AI_WEB.survey = 22`), **camera bookmarks** (#76, merged in #77: Ctrl+Shift+1–4 saves a view, Shift+1–4 returns to it), **the workforce ledger** (#73, merged in #74: the Workers panel counts and selects citizens by job), **weather** (#78), **the computer walks the web of ages** (#50, s4 of #37): Normal and Hard survey and dig into the Iron Age, take the merchants' road and hire at the Market, turn pilgrim and back, take the Fairs, mass archers against an Iron rival and waylay a merchant rival's traders by a trading post; numbers in `AI_WEB` (`src/sim/data.ts`); `npx tsx scripts/web-walk.ts` shows the roads computers take, and with `duel` how a web walker fares against one kept to the trunk (on Hard it lost more than it won, 3–10 over 48 matches with 35 undecided: `docs/log/2026-10-14-1100-computer-web.md`); no save bump. **The two-front war** (#36: the Tsar plays Easy in Wings, a chapter seat strikes a rival's wonder first; Wings maps won at Hard 4/16 → 8/16), **ancient ruins** (#64, also a fix to `Music.style()` recursing outside side ages), **health bar quarter marks** (#68, Codex); the web of ages and its map and looks (above); computer traders judging the road they walk (#53, which made Wings over the Steppe harder: 8/16 maps at Hard became 4/16, see #36); the campaign proof over 16 maps a chapter (#51); Wings in the proof (#45); repairs (#1) and Market recovery indicators (#32); one live connection per online player (#44); browser-free shipping (#33); idle citizens together (#62: Shift + . selects them all); **allied trade** (#60, #63, #66: allies with a Market take `TRADE.ally`, a quarter, of each teammate's trade trip; a Market-less player may set out from an ally's Market; own coin effect and `tradeShare` sound; browser unverified, the sound level wants an ear); standing merge authorization (#67).

**Weather** (own pitch, lane look): a seeded day per match (clear, rain, snow, mist; storms with lightning and thunder), look and sound only, no rules or save change. Seen in headless Chromium on the title screen only; the sound levels want an ear.

**Flags in the wind** (#150, own pitch, lane look): building banners and the airfield windsock stream downwind and ripple by the day's wind. Render only; shader compiles in headless Chromium (smoke passes), look in a match unseen.
**Billowing sails** (own pitch, lane look): ship sails belly out in the wind (render only). Shader compiles in headless Chromium; look in a match unseen. Dock masts billow too (off-centre sails packed with their centre x).
**Watch a live match** (seed #134, lane online): a watcher joins a started room, sees everything or any player's eyes, and cannot act; the Worker reads only their pings. Browser unverified.

**Signal beacons** (own pitch, lane rules): a Watch Tower can light a fire (F): +7 sight for 45 s, and rivals see the ground around it; the clever computer lights one when three soldiers close in. Browser unverified; sound wants an ear; no save bump.

**Beacon relay** (own pitch, lane rules): a lit beacon sets alight your other rested Watch Towers within 14 tiles, free, 25 s each, down a chain (`BEACON.relay`, `.relayDuration`). Tests only; browser unverified; no save bump.

**Answering the flame** (own pitch, lane ai): a clever computer lights a Tower's beacon when it sees a rival's burning within `AI_RAID.flame` tiles. Tests only; no win-rate sweep; no save bump.

**Rallying Cry** (own pitch, lane rules): the hero's R shout stirs soldiers within 8 tiles for 12 s (+30% blows, +1 armor, mended 6; 70 s rest); the clever computer calls it. `RALLY` in `data.ts`. Tests and a headless match only; browser, sound level and a visible effect unseen; no save bump.

**Rally ring** (own pitch, lane look): stirred soldiers wear a pulsing gold band that fades with the cry. Render only; smoke passes; look in a match unseen.
**Cry ripple** (own pitch, lane look): calling the Rallying Cry sends two gold rings out to its reach. Render only; reach vs. the ring mesh unseen in a browser.

**Standing to answer** (own pitch, lane rules): pilgrim priests right-clicked onto a chanted-over own building stand by it and sing back 1.5× (`CONSECRATE.counter.stand`, `.hold`). Tests only; browser and sound unseen; no save bump. The pilgrim computer orders it (`ai.ts` priestly), and the cursor shows gather over such a building; the building panel says how many priests are answering (HUD only, unseen).

**Waymarks** (#154, seed #152, lane look): the minimap remembers ruins (dug or standing, by whom) and relics as last seen. UI only; browser unverified.

**The wild** (#171, own pitch from the owner's chat, lane rules): mammoths (a feast that charges its hunters) and wolf packs by dens out between the towns, often by wild gold; bitten people fight back; soldiers can hunt beasts; the computer hunts its mammoth with five and clears near dens. New numbers `MAMMOTH`, `WOLF`, `AI_WILD`. No save bump (old saves hold only deer). Seen in headless Chromium; sound levels unheard; not played by hand.

**Boars** (own pitch, lane rules): a boar guards a berry patch out from each town; three citizens beat it, one loses; carcass 260 food; the computer sends three at six citizens. New numbers `BOAR`, `AI_WILD.boar*`. Tests and a headless match; browser and sound unseen; no save bump.

**Drifting herds** (own pitch, lane rules): deer herds migrate every 150 s away from borders; wolves hunt deer near dens and leave the carcass. New numbers `DEER.herd/every/min/max/range`, `WOLF.hunt`. Tests and a headless match; browser unseen; no save bump.

**Meat spoils** (own pitch, lane rules): carcasses rot after 40 s (a mammoth gone in ~3 min); Drying Racks (Stone Age tech) slow it on your land; the computer buys them after big game. New numbers `ROT`, tech `drying`, mod `rot`. Tests and a headless match; browser unseen; no save bump.

**Carrion** (own pitch, lane rules): wolves within 15 tiles of a den eat turning carcasses on unheld land and bite butchers; border meat is safe. New numbers `WOLF.scent`, `WOLF.gnaw`. Tests and a headless match; browser unseen; no save bump.

**Hunting Camp** (own pitch, lane rules): a 45-wood Stone Age food drop (N) that holds a 4-tile border, so a far kill or the herd's new ground can be worked and kept from wolves; the computer builds one by a far kill. New numbers `BORDERS.huntcamp`, `AI_WILD.camp*`. Tests and a headless match; browser unseen; no save bump.

**Hounds** (own pitch, lane rules): Hunting Camp tech (80 food 40 wood): hunt +25%, beast damage halved (`TECHS.hounds`, mod `beastWard`); the computer buys it after big game. Tests only; browser unseen; no save bump.

**Seasons** (own pitch, lane rules): four seasons of 150 s from spring; summer berries +25% but meat rots 1.5×, winter berries ×0.55, fields ×0.75, meat keeps 2×, wolves/boars notice +40%. New numbers `SEASON`, `SEASONS`. Tests only; browser unseen; no save bump.

**Planning for winter** (own pitch, lane ai): from autumn a clever computer adds fields, leans 30% more to food, hunts mammoths/boars with a smaller town, clears winter wolves with one fewer soldier. New numbers `AI_WINTER`. Tests only; browser and win-rate unseen; no save bump.

**Heirloom looks** (own pitch, lane look): Bell Foundry puts a bell cote on the Temple, Iron-Bound Hulls bands the Dock; a bell peal when an heirloom opens. Second marks: Joint-Stock counting-house board and coins at the Market, Masons' Lodge shear-legs and ashlar at the Temple (`HEIRLOOM_MORE`; a building may wear several). Render/sound only; model tests pass; browser and sound level unseen; no save bump.

**Old Ford** (own pitch, lane rules): a sixth landmark kind; its keeper's soldiers march 1.2× (`LANDMARKS.ford`). Tests only; browser and win-rate unseen; no save bump.

**Staging from the ford** (own pitch, lane ai): a clever computer keeping an Old Ford toward its rival (`AI_RAID.stage`, 36 tiles) musters waves there. Tests only; browser and win-rate unseen; no save bump.

**Contesting the ford** (own pitch, lane ai): Normal/Hard soldier bands weigh a rival's kept Old Ford 1.6× (`AI_MARK.worth.fordRival`) when picking a landmark to take. Tests only; browser and win-rate unseen; no save bump.

**Lords AI** (own pitch, lane ai): in Lords of the Land the computer ranges the whole map for landmarks and sends bands of two (`AI_MARK.lordsReach`, `.lordsParty`). Tests only; no win-rate sweep; no save bump.

**Contested landmarks** (#182, own pitch, lane rules): a Sacred Spring, Lookout Crag and Ancestors' Cairn between the towns (players + 1), claimed by standing on them alone; held ones are land. The computer claims with a citizen and retakes with soldiers. New numbers `LANDMARKS`, `AI_MARK`. Tests, headless matches and headless-Chromium screenshots; sounds unheard; no win-rate sweep; no save bump. Also: a people down to unarmed boats (fishing boats, merchant ships) is beaten (`checkVictory`).

**Escort lingers** (own pitch, lane ai): a walker's escort stays 20 s (`AI_MARK.linger`) after the claim is won; escort now keyed to its landmark. Unit test only; no sweep; no save bump.

**Kin landmarks for the computer** (own pitch, lane ai): the computer weighs its people's favoured landmark kind 1.4× (`AI_MARK.worth.kin`). Unit test only; no sweep; no save bump.

**Flint Scatter** (#187, own pitch, lane rules): a fourth landmark kind; its keeper's citizens chop and mine 20% faster (`LANDMARKS.flint.tools`). Unit and model tests only; browser, sound and win-rate unseen; no save bump. `tests/relics.test.ts` sits near its 15 s limit and timed out once under load.

**Sacred Grove** (own pitch, lane rules): a fifth landmark kind; its keeper's priests convert and heal 1.8x as fast within 10 tiles (`LANDMARKS.grove`). Unit and model tests only; browser, sound and win-rate unseen; the computer claims it but doesn't yet stage priests there; no save bump.

**Faith takes the walls** (#209, own pitch from the owner's note #197, lane rules): in the Age of Pilgrims, priests chant a rival's building over together (never a Town Center or Wonder), slower with soldiers inside, and a Temple brings its relics; a pilgrim computer sends priest bands with its army. New numbers `CONSECRATE`, `AI_FAITH`, mod `consecrate`. Tests, headless matches and headless-Chromium screenshots of a tower turning; the chant's gold motes and the bell chord unseen/unheard; no save bump.

**Raiding the Bell** (own pitch, lane ai): a bomber/raid target pick weighs a Bell Foundry rival's relic Temples like a pilgrim people's (`AI_WEB.bell`). Unit test only; no win-rate sweep; no save bump.

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
- Chains no longer end when the board is empty, since agents pitch their own work, so they run to their caps (10 sessions a chain, one chain per lane, no limit on chains at once and no daily cap: `docs/successors.md`). Lower the caps if the usage limits pinch.
- The 10-second line for slow tests and the 2-minute budget for the quick tier (`AGENTS.md` §5) are drafts.

**Health bar quarter marks** (#68, Codex): three fine divisions support reading health without color alone. 173 unit tests and TypeScript 5.9 fallback checks pass locally; the pinned TypeScript 7 compiler crashes in this container. Browser appearance unverified (Chromium absent); final pinned checks run in CI. No balance or save changes.



**Workforce ledger** (#73, GPT-6): a read-only Workers dropdown in the HUD groups citizens by current job and selects a group on click; no sim or save changes. Browser appearance unverified; CI verification in PR.

**Seed atlas** (#80, lane tooling): `scripts/seed-atlas.ts` finds seeds by what the map holds (bog iron, posts, relics, ruin finds); no sim, UI or save change. `--share` prints `?seed=` addresses; the title screen reads them.

**Scout Flags** (#85, GPT-6, lane look): up to six personal gold planning / red danger pennants on explored locations, shown in 3D and on the minimap with Ctrl(+Shift)+right-click. UI-only, absent from saves, replays and online commands; browser appearance unverified, CI tracked in PR.

**Atlas start distance** (#93, lane tooling): `scripts/seed-atlas.ts --apart N / --close N` filters worlds by the distance between the two nearest starts, and the table shows a `gap` column. Tooling only; no sim, UI or save change.

**The hours of the day** (#97, own pitch, lane look): the light drifts from morning to dusk and night over an hour of play, from the tick and seed alone (render only; no rules, save or `data.ts` change). `?hour=` pins it. Seen in headless Chromium on the title screen only; a match in play unverified.


**Age of Reclaimers** (#94, Codex, lane rules): finishing a ruin reveals a Middle Ages → alternative Gunpowder road. Construction/repairs 25% faster, research 20% cheaper, military training 25% slower; ordinary Industrial exit or Gunpowder settlement. Ruin ownership supplies discovery without a save bump. New road/AI/model tests; browser appearance and music unverified (Chromium unavailable).

**Moonlit nights** (own pitch, lane look): a moon phase per match changes how bright the night is; lakes glint with stars at night. Render only. Seen in headless Chromium in a night match; lake glints unverified.
**Age of Sail** (own pitch, lane rules): a side age off the Middle Ages for a coastal people (Dock + 500 fish landed): faster fishing, cheaper and sturdier ships, weaker farms; new roads to Gunpowder and back. Looks, music, minimap and tip included. The clever computer now takes it too (own pitch, lane ai; win rates not compared); browser unverified; no save bump.

**Lit windows** (own pitch, lane look): glowing parts (windows, torches) brighten after dusk via one shader uniform. Render only; browser unverified.

**Harbor trade** (own pitch, lane rules): in the Age of Sail a Market within 12 tiles of its owner's Dock pays 30% more per trade trip. Numbers in `TRADE.harbor`. Tests only; browser unverified; no save bump.

**Gulls** (own pitch, lane look): by day near water, a gull cries now and then. Audio only; level unheard; no save bump.

**Fireflies** (own pitch, lane look): clear nights get blinking green-gold sparks near the camera. Render only; no rules or save change. Browser: see the pull request.

**Sea trade** (own pitch, lane rules): a Dock trains merchant ships (`cog`) that sail to coastal trading posts (ports: water within `TRADE.sea.reach` of the post) and pay `TRADE.sea.mul` (1.2) over the land road; computer Normal/Hard keep 1–2. Tests in `tests/sea-trade.test.ts`; browser unverified; no save bump.

**Lighthouse** (own pitch, lane rules): a Dock technology (after Gillnets, Middle Ages; 200 wood, 120 gold) that adds 4 tiles to how far a trading post may lie from water and still be a port for its owner's merchant ships (`portReach` mod; `portSpot` takes the owner). Computers research it in tech order. Tests in `tests/lighthouse.test.ts`; browser unverified; no save bump.
**Flickering lights** (own pitch, lane look): warm glowing parts (windows, torches, braziers, lamps) flutter up to a third dimmer on their own beat, per building, in the shared material shader. Render only; no rules, save or `data.ts` change. Browser smoke test passes (shaders compile, no console errors); how it looks in a match is unseen.
**Ports on the Inland Sea** (#106, own pitch, lane rules): on the sea map trading posts stand on the shore, so every post is a port (24/24 over 12 seeds, was 0/24); other maps unchanged. Sea Lords proof passes; browser unverified; no save bump.

**Bats at dusk** (own pitch, lane look): dark wing-beating bats flit near the camera at dusk and dawn, clear weather only, off on Low. Render only; no rules or save change. Seen in headless Chromium (no errors); motion unverified by eye.

**Tactical Reach** (#101, Codex, lane look): Alt shows selected owned ranged weapons' reach and dashed siege dead zones; defense placement previews future reach. Terrain-following, clipped to current vision, capped at 24 guides in one draw. No rules, balance or save changes. Quick checks pass with the documented local TS5.9 fallback; pinned compiler checked by CI. Browser appearance unverified (Chromium missing).

**Owls** (own pitch, lane look): pale owls glide over the land on clear deep nights, with an occasional hoot (`owl` sound). Render and audio only; no rules or save change. Shader and hoot level unseen by eye (see PR).

**Bat roosts** (own pitch, lane look): bats wheel around standing ruins at dusk and dawn. Render only; browser unverified.

**Crickets** (own pitch, lane look): on clear nights away from water, crickets chirp. Audio only; level unheard; no save bump.


**Age of Aeronauts** (#121, Codex, lane rules): a future specialization off Industrial, discovered by a completed Airfield. Aircraft cost/train time 25% lower; foot, ranged, cavalry and siege prices 20% higher. Paid Industrial return, ordinary Step Back, AI adoption/recovery, town markings, music and tip. No state-shape or save-version change; older replays may diverge. Browser appearance and music unverified (Chromium unavailable); checks documented in PR.

**Frogs** (own pitch, lane look): on clear nights near open water, frogs croak (`frog` sound). Audio only; level unheard; no save bump.

**Ages reached** (own pitch, lane look): hovering a player's epoch in the end-of-match table lists when they reached each age ("Bronze 8m · Iron 17m"), read from the existing history. UI only; no rules, save or `data.ts` change. Browser unverified.

**Hushed nights** (own pitch, lane look): crickets and frogs go quiet when an army (5+ soldiers in sight) is near the view. Audio only; no rules or save change; unheard.

**Birdsong** (own pitch, lane look): by day, away from water and armies, a songbird now and then (`birdsong` sound). Audio only; level unheard; no save bump.

**Tests for untested modules** (#129, owner ask, lane tooling): direct tests for `rng`, `spatial`, `vision`, deer, the Worker's routes and room lists, and the creature voices (moved into `src/render/ambience.ts`, same behaviour). Quick tier now 276 tests in 53 files. No rules, save or `data.ts` change.

**Great works** (#133 seed, own pitch, lane rules): once per epoch from the Bronze Age a people calls its great work from the Town Center (W), free, 90 s: Nile Flood, Phalanx, Roman Road, Yam Relay, Grand Canal, Longbow Volley (`WORKS` in `data.ts`). Computer times its call. No save bump. Browser unverified; sound unheard.

**Great work glow** (#141, own pitch, lane look): motes in the people's colors rise from its Town Centers while a great work runs. Render only; no rules, save or `data.ts` change. Browser unverified.

**Yam Relay sight** (own pitch, lane rules): the Mongol great work also gives mounted soldiers +3 sight (`riderSight` in `Mods`, `WORKS.mongols`). No save bump. Browser unverified.

**Borders** (#132 step 1, own pitch, lane look): land drawn as coloured edge lines from finished Town Centers, Towers, Wonders, Docks and Airfields (`BORDERS`); **O** toggles. Display only; no save bump. Seen only via the headless smoke run.

**Attrition** (#132 s2, own build, lane rules): land soldiers deep in enemy land (no own-team border within 9 tiles) lose 2% health per 5 s, never during peace. Numbers in `ATTRITION`. Tests and campaign proof pass; browser/feel unverified; computer does not yet judge raid depth.

**Wind** (#150, own pitch, lane look): a seeded wind per match (`windFor`, stronger in a storm) leans chimney, forge and battle smoke the same way, and (part two) slants rain and snow. Render only; no rules, save or `data.ts` change. Quick check and browser smoke test pass; how the lean looks in a match is unseen by eye.

**The turning year on the land** (#183, own pitch, lane look): meadows, broadleaf trees and snow follow the season in the shared shader (`seasonLook.ts`); `?season=` holds one. Render only; no rules, save or `data.ts` change. Each season seen held in headless Chromium; the fades in motion are unseen.

**Holding landmarks** (#191, own pitch, lane ai): the computer weighs landmarks by kind (`AI_MARK.worth`: Cairn when houses are full, Spring when hurt, Flint) and sends soldiers to one of its own that rivals stand on alone. Unit test and a headless match; no win-rate sweep; browser unseen; no save bump.
**Weather follows the year** (own pitch, lane look): snow falls only in winter; a seeded snow day is rain in spring and autumn and thin mist in summer, winter rain falls as snow; the sky changes as the season turns (`seasonalDay`). Render and sound only; no rules, save or `data.ts` change. Smoke test passes; the change in motion unseen by eye.

**Minimap season** (#195, own pitch, lane look): the overview map's meadow and woods follow the season and winter snow whitens it. Render/UI only; seen in headless Chromium per season; no save bump.

**Kin landmarks** (own pitch, lane rules): each people's favourite landmark kind gives it half again the gift (`LANDMARKS.kin`, `.kinMul` 1.5). Unit tests only; browser and win-rate unseen; the computer doesn't yet prefer its kind; no save bump.

**Iron bars** (#197, own pitch, lane rules): Iron Age bog iron pays double gold (`bogGold`); the Iron Age computer keeps digging. Tests only; no save bump.
**Recalling the lone walker** (own pitch, lane ai): the landmark walker turns home when rival soldiers come within 7 tiles of it on the road. Test only; no sweep; no save bump.

**Iron wares** (own pitch, lane rules; #197): bog iron dug on any road lifts trade pay in the Merchants, Fairs and Sail ages, +8% per 75 bars to +40% (`IRON_TRADE`); Market panel shows it. Unit tests only; browser unseen; no sweep; the computer doesn't weigh it; no save bump.

**Walker waits** (own pitch, lane ai): the landmark walker halts when its escort trails by more than `AI_MARK.lead` (9) tiles. Unit test and a headless match; no sweep; no save bump.
**Bloomery** (own pitch, lane rules, #197): Forge tech, Iron Age only (`Tech.only`): foot +20% hp, +1 armor; lapses on leaving. Tests only; browser unseen; no sweep; no save bump.

**Escort replaced** (own pitch, lane ai): a walker whose escort has all fallen gets a fresh one if soldiers can be spared. Unit test only; no sweep; no save bump.

**Side-age crafts** (#197, #213, own pitch, lane rules): Ropewalk (Dock, Sail only: ships +15% hp, +1 range) and Letters of Credit (Market, Merchants only: techs 15% cheaper) beside the Bloomery. New `TECHS.ropewalk`, `.credit`. Unit test only; browser and sweep unseen; no save bump.

**Litany** (own pitch, lane rules): Temple craft, pilgrims' road only: chants 30% faster (`TECHS.litany`, mod `chant`); the pilgrim computer buys it. Tests only; browser unseen; no save bump.

**Chanting back** (own pitch, lane rules): a pilgrim keeper's priests within 7 tiles of a building being chanted over wear the rival's faith down (`CONSECRATE.counter.answer`). Tests only; browser, sound and win rates unseen; no save bump.

**Dust of the march** (own pitch, lane look): fast riders and siege engines raise dust (powder on snow, none in rain). Render only; browser unseen; no save bump.

**Heirlooms** (#224, own pitch from #197, lane rules): crafts only a people that walked two side ages can learn, kept for good: Bell Foundry, Iron-Bound Hulls, Joint-Stock Company, Masons' Lodge (`Tech.walked`, `Player.walked`). Tests and a headless match; browser and win rates unseen; no save bump.
**Lords of the Land** (own pitch, lane rules): the 'lords' game mode: keep every landmark 240 s to win; HUD countdown, banner, end line; the computer breaks a rival's hold with any soldiers. `LANDMARKS.lordsSeconds/.lordsMin`. Unit tests only; browser and win-rate unseen; no save bump.

**Age of Lightning** (#231, grows seed #136, lane rules): a side age off the Industrial. Watch Towers become Coil Towers whose field speeds training and research nearby (1.35×) and slows it outside every field (0.75×); their bolt leaps through crowds; no aircraft. Road: a Watch Tower and 6 beacons lit (`stats.beacons`, new). The computer lights beacons toward it, takes it with towers and no aircraft, and leaves when its coils fall. New numbers `LIGHTNING`, `AI_LIGHTNING`. Tests, 6 headless matches, and the tower and bolt seen in headless Chromium; sounds unheard; no win-rate sweep; no save bump.

**Coil fields shown** (#239, s2 of #231, lane look): blue-white rings on the ground for each finished Coil Tower (and for a Watch Tower being placed); lit/dark line in the panel of own training buildings. Render/UI only; unit test passes; seen in headless Chromium (rings, panel line; `docs/screenshots/coil-fields.png`, `docs/log/2026-10-16-0000-coil-fields-seen.md`); the dark-building line, bolt and sounds unseen; no save bump.


**The computer reaches for an heirloom** (#232, own pitch, lane ai): once it has walked a side age, the clever computer takes the second road that opens an heirloom (`AI_WEB.heir` 1, was `take` 0.6) and buys the heirloom first, queuing it even at a busy building. Tests and a headless match; no win-rate sweep; browser unseen; no save bump.

**Coil hum** (own pitch, lane look): a finished Coil Tower within 12 tiles of the view hums (60 Hz and its octave), louder the nearer; only towers you see. Audio only; level unheard; unit test of the distance; no save bump.
**Reading a rival's heirlooms** (#242, own pitch, lane ai): the clever computer watches a Joint-Stock rival's trading post on any road and keeps one more siege engine against a Masons' Lodge (`AI_WEB.lodge`) and one more warship against Iron-Bound Hulls (`AI_WEB.hulls`). Unit tests only; no win-rate sweep; no save bump.
