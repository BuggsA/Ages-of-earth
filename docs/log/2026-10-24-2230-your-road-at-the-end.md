# Your road at the end (#743, s3 of #724)

`Player.journey` (optional, `src/sim/types.ts`): one `JourneyLeg` per change of age, pushed in `enterAge`; `removeDead` adds to the last leg's `lost` while a step back's weak window (`STEP_BACK.time`) is open. Older saves have none: the end screen then starts the road where the people stands. Pure `src/ui/journeyReport.ts` draws the web cut to the ages walked (and the untaken roads the viewer knew, by `roadKnown`), one coloured line a leg, offset to its own right so there-and-back shows twice, steps back dashed, arcs between side-by-side ages. "Play this seed again" reuses `restart` (`lastSetup`) outside the campaign and online rooms.

`lost` counts every loss in the window, from any cause, not only a rival's blows; good enough to read "was it struck", and named so on the screen.

No numbers in `data.ts` changed; no save bump (the field is optional). Seen in headless Chromium at 1280 wide (a forced end with planted journeys): the drawing, the lines and the buttons, no page errors. Not seen: phone width, a real match's journey, a hover title.

Split off: Rematch in online rooms, for a later step.
