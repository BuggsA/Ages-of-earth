# 2026-10-17 · foundation ghosts

Picked from the #356 leftovers (the claim was released, no `ci-periodic` issues, #355 has other hands on it). The aircraft range ring I first meant to do already exists (`sortieRings`).

A Reclaimer's fallen footprint now draws as a dashed outline (`src/render/foundationView.ts`, wired in `view.ts`), own buildings only, within what the viewer can see. Pure render: no rules change, no save change. `tests/foundation-view.test.ts` covers the list (own, live only, state untouched), hidden/seen drawing and the cap.

Browser unseen. Left: fade-out over the memory window, convoy pennants, fairground banners.
