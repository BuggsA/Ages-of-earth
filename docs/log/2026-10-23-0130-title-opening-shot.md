# The title as an opening shot (#421)

The owner reopened #421: the #424 left column "reads worse"; research first, then pixels.

**Research** (web search plus what well-known title screens do). A title page sets the mood before play through art, logo, music and motion, and promises what's coming: BioShock's lighthouse over the sea, Mega Man X telling a story in one screen. The logo is the focal point. A dark fade at the edges centres the eye. Navigation stays simple. Sources: gamedeveloper.com "Setting the tone: main menus are the game" and "Memorable main menu sound design"; the Falmouth "Redesigning Rapture" journal.

**What was wrong with ours** (screenshots at 1280×800 and 800×900, before): a high camera at noon looking at flat grass, no sky or horizon; a 94% black slab over the left third with a stray 1 px rule; select boxes and a number field on the first page; every element at the same weight. The unscoped wide-screen rules also stripped the background from the Campaign and Online cards.

**Built:**
- A low camera (`CameraRig.cinematic`) aimed from the town toward the map centre with a slow sway. It stays clear of hills and lifts its gaze to show the sky.
- The world's edge tinted with the horizon, borders hidden, and the fog pushed back on the title.
- The name large on one line, the ages as a line of coloured names, and five ways in as words with a gold mark and a one-line promise on hover. Everything rises in on arrival.
- Under Play, a summary of the match it will start; it opens a **Your match** sheet with crest tiles for the peoples. How to play has its own sheet. Esc closes either.
- A new `menuHover` sound: a soft lute-like pluck.
- All title styles scoped to `#title`, so the Campaign and Online cards are back to their own centred cards.

**Seen:** headless Chromium at 1280×800, 1920×1080, 800×900 and 390×800: the title, a hover, both sheets, and the Campaign and Online screens. Not heard: the hover sound's level. Not seen: a real GPU, or how the motion looks at full frame rate.
