# Orders look past your own people

Owner reported: "The sheep and the stone don't always work."

Cause: `View.pick` checks units before animals and resources, and a unit's pick circle is larger than a sheep's. A right-click on a sheep or a stone with a citizen beside it (a milker by the sheep, a quarrier at the stone, often the very citizen selected) picked that citizen, so the order became a walk to them instead of milk or quarry.

- `src/render/view.ts` `pick`: takes an optional `through` filter for units to look past.
- `src/main.ts` `orderPick`: right-click orders, the order cursor and the double-click order look past friendly units (your own transport aside, which still takes boarders) to what they stand at; on open ground the unit still counts.

Left-click selection is unchanged: clicking a citizen at a stone still selects the citizen.

Tried in Chromium (swiftshader, scratch Playwright script): a citizen beside a sheep, right-click the sheep. Before, `view.pick` returned the citizen; with the fix the citizen's order is `milk`. A citizen next to a stone, right-click the stone: order `gather` stone. No number changes.
