# 2026-10-24 03:00 UTC: citizens stand off the ground, ships fly a team ensign (#624, step 3)

- Citizen clothing now follows the measured palette (`docs/art.md`): torsos lighter (L 0.4–0.7: hide `#c9a47a`, linen, `#cdb98a`, `#c8b898`), legs near-black from the Bronze Age on, instead of mid-brown on mid-green. Soldiers keep their team capes, so lines still differ.
- Warships, transports and cogs fly a team ensign from a stern staff (`lineMark`): about 20 triangles on a hull of hundreds, no new draw calls. Aircraft already carry team wings and tail.
- Seen: `stone-start` scene, citizens read lighter than the grass. Unseen: Bronze-to-Industrial citizens in a browser, ships (no sea scene), frame rate on Low (cost is a few triangles per ship, none per citizen).
- Not done: rim/outline. It lives in `materials.ts`/`post.ts` (`area:light`); next step if that area hasn't, add a fresnel rim to `unitMaterial`.
