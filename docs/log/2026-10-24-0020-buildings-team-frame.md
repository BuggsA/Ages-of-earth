# Buildings by trade and team (#625, step 1)

- Every building (not walls, gates, snares, saplings, farms) now carries a frame of its owner's colour round its pad and a tall pennant at the front corner (`teamMark` in `buildingModels.ts`). Team colour was a thin trim; it now reads from above at any zoom.
- Roofs are coloured by trade from the Bronze Age on (`TRADE_ROOFS`): soldiers' halls and towers slate-dark, stores and yards thatch-gold, markets ochre, faith teal, smithies charcoal. Houses and the Town Center keep the epoch's roof.
- Shots: `docs/screenshots/625-s1-before.png`, `625-s1-after.png` (`town` scene).
- Next: silhouettes (rooftop emblems per type), Stone Age huts, foundations and rubble in team colour, small prop views.
- Not seen: other epochs, Low quality, a real GPU.
