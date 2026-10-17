# The Warband carries its plunder home (#502)

- **Verb:** a Warband kill fills the killer's pack (`unit.spoils`, up to `SPOILS.cap` 90 gold); it banks only when that soldier walks within 5 tiles of a Town Center or Barracks (`src/sim/spoils.ts`, once a second). A rival who fells a laden soldier takes the pack. Leaving the age banks every pack where it stands. Kills with no soldier credited (towers, etc.) still pay at once. Later Blood ages pay at once as before.
- **Door/answer:** a host that never turns home banks nothing; hunting laden soldiers is the rival's answer.
- **Computer:** `haulHome` in `ai.ts`: a soldier with 45+ gold (not mid-blow) leaves the wave and walks to its home.
- Numbers: new `SPOILS` in `data.ts`; `AGES.warband.add.plunder` unchanged (0.25). HUD: 💰 chip in a soldier's panel; tip and README updated. `VERB_GAPS.ages.warband` struck.
- Unseen: the HUD chip and the AI's haul-home in a real match in a browser. Saves: optional `spoils` field on units, no version bump.
