# Copy world link (own pitch, lane look)

Title screen: a 🔗 button beside the map seed copies `?seed=&size=&map=&foes=` for the current setup (the address the title screen already reads, #80). If the clipboard is blocked the link shows in a toast. No sim, save or online change.

Verified: `npm run check` passes (221 tests). Browser behaviour unverified (clipboard not exercised).
Next: an atlas start-to-start distance filter; the smoke test could train a unit.
