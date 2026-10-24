# Idle builders get a one-click card (#344)

Citizens who last built and have stood idle for 5 s (3 or more) get a card: "Fell timber", which sends up to `AUTO_WORK.lay` of them to the nearest trees (`reassign` idle→wood). Same shape as the miners and hunters cards in `src/ui/hud.ts` (`idleBuildersCard`). HUD only: `scripts/sim.ts 3 medium 30` keeps checksum 1591387014.

Not tried in a browser. Ideas left: a rally on a farm that puts new citizens on free fields; idle shepherds/milkers cards.
