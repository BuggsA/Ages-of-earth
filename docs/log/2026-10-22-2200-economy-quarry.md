# The economy seat's stalled quarry (AI)

**Found.** The economy route (merchant, fair, lightning) reached Lightning in 1 of 96 matches. Tracing a seat per minute (seed 403): in Industrial its food and wood piled up while stone sat at 123 for six minutes against Lightning's 450. Stone got ~6% of hands, the home stone was gone, the nearest tile was 37 tiles off, and the AI had already used its 5 Storehouses on wood, so no drop site was ever raised there. It never bought stone at the Market either.

**Built** (all behind `AI_LEVELS.*.quarry`, numbers in `AI_QUARRY`, `src/sim/data.ts`): while a road's stone is short, stone hands weigh ×4 (also while bound for Lightning, before the road is due); stone and gold sites may have 2 Storehouses beyond the 5; a clever town buys stone with gold above the road's own gold, selling food/wood above 900 to get there.

**Evidence.** `route-ab.ts economy 401 12 25` ×4: Lightning reached in 4 of 96 (was 1); wins 15–10, ahead 29 / behind 42, ages ahead ≈ 0. `ai-ab.ts 1 12 25 '{"quarry":false}'` ×4 (48 seeds): new 11–12, ahead 37 / behind 36, ages +0.05: neutral for ordinary play.

**Still stalls on** gold: the road asks 1,300 gold and the seat has ~1,340 only at minute 24. Next: the economy seat's gold (traders earlier? fewer gold hands lost to towers?). Not seen in a browser.
