# Reading the rival's road (#726, s2 of #724)

`src/ui/rivalRoad.ts`: a `RivalLedger` fed by the public `epoch` events (the road walked, the step-back window from `STEP_BACK.time`), a scan of rival buildings with `keep` that the viewer's eyes are on now (`view.sees`), `halfCrossings`, and the Rivals panel. The age-change toast is clickable and opens it; the minimap rings a seen keepsake. `Hud.toast` and `Minimap.draw` each gained an optional trailing argument.

Reads only what every client was already told and what the viewer sees; a match joined late seeds the road from the rival's record, which the events had announced anyway. No numbers in `data.ts` changed; no saves touched.

Decision added for the player: read a rival's road and punish its weak window, or race it to a crossing.

Seen in headless Chromium: the Rivals panel opens and shows the rival's card, no page errors. Not seen: a live step back (countdown), a keepsake ring on the minimap, the clickable toast. Those are covered by `tests/rival-road.test.ts` for the rules, not for the drawing.

The window counts `STEP_BACK.time` seconds from the age-change event, as the issue says; if the step back's own journey time should not also be the window, a `data.ts` number can split them.
