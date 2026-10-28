# Town Center: fewer shut roads

The Town Center listed every shut side road (🔒) the player knew of, however far its opening age lay. It now lists one only when a window is within a step: the age Step back leads to, or a sibling age at the player's tier. Farther ones return once near. UI only (`src/ui/hud.ts`); `shutRoads` and its tests are unchanged. Decision added for the player: none (look/fix). Typecheck passes; not seen in a browser.
