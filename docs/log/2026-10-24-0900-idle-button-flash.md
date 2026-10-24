# Idle button flashes when more hands fall idle (#344)

The Idle button already pulses while anyone is idle. It now also flashes once, brightly, each time the count climbs (a dry bush, a spent seam), so the rise is noticed. `src/ui/hud.ts` (`idleSeen`), `src/ui/style.css` (`idle-rise`). Look only: no sim change, `scripts/sim.ts 3 medium 30` checksum still 1591387014. Unseen in a browser.

Ideas left for #344: a rally on a farm putting new citizens on free fields; idle builders/shepherds/milkers cards.
