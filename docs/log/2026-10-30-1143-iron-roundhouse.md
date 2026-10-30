# The Iron Age house becomes a roundhouse (#816)

Chunk: iron / building house. Before, an Iron Age house was the Bronze mudbrick box standing on a rust slab: the same shape as every tier-1 house. Now it is a roundhouse of the kind raised across Iron Age Europe (`ironHouse` in `src/render/buildingModels.ts`): a low drum of limewashed daub on a ring of wattle posts, under a tall, steep two-tone thatch cone bound part way up and capped at the peak, with spears racked by the door and a glowing lump of bog iron (the age's wealth) on the step. A town of them reads as a field of haystacks, not boxes.

To do it, `buildingGeometry` gained `AGE_SHAPES`: an age may give a building a whole shape of its own in place of the trunk's model; its palette (`st`) and touches still follow. The next building chunk on #816 adds a line there.

Seen in Chromium through the model gallery (`scripts/gallery`, `?t=house&e=1&a=iron`), before and after. Not seen in a live match or on the 26 px button picture.

Decision it gives the player: none: look.
