# Ground step 4: a `wood` shot, crown thinning seen (#623, #617)

- `scripts/look/shots.mjs`: new `wood` scene, four citizens standing in the thickest wood nearest the start.
- Seen in it (software GL): crowns near the citizens draw in and all four read among the trees; the rest of the wood stays full. Closes the "unseen in a browser" note of step 3.
- Measured on the screenshots (WCAG L, rain in the wood shot): open grass 0.11-0.13, canopies 0.05-0.08, pines 0.08. Order is right (woods darker than ground, a clearing reads) but all sit under the `docs/art.md` bands because tone mapping and weather (`area:light`) darken the shot; no ground colours changed here.
- Not done: other epochs, snow, Low quality unseen; `seasonLook.ts`, `grazeView.ts`, `borderView.ts` untouched.
