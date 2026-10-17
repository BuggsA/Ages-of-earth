# The Age of Merchants stables no horses (Goal 2, verbs audit #500)

**Decision it gives the player:** a merchant people can't raise a Stable, so cavalry is only hired at the Market (gold up front plus daily wages): bank the gold for horse, or field foot and bows, or settle down for Stables again.

- `AGES.merchant`: the door "levies cost more" gains a lost option, `noBuild: stable`. The levy number stays; the door line, blurb and README now name the Stable.
- `ai.ts`: the building plan skips any barred building (the chapter-goal loop already did, from #514).
- Test: `tests/age-of-sail.test.ts` (Stable barred, hired cavalry still allowed, lifts on `middle`).
- Numbers changed in `data.ts`: none; one `noBuild` added to `merchant`.
- Not tried: balance over many maps, nor a browser. Next: the Age of Fairs' door (still `buildingHp` 0.85) and Aeronauts.
