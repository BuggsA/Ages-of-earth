# Roofs held to the 0.15 L bar in every epoch (#617)

- Citizens (CITIZEN_BOOST 1.15) beside fighters in the `battle` and `citizens` shots: they read fine, team ring under each. No change.
- Low quality (`&quality=low`, `battle`, `town`): rings, trees and buildings still read. No change.
- Roof luminance vs grass `#6f8a4c` (L 0.221) computed for every roof in `STYLES` and `ROOFS`; those under 0.15 apart moved:
  Stone Age roof2 0.32 → 0.41; Bronze terracotta 0.19/0.13 → 0.054/0.036 (darker, still red-brown); Medieval slate and military roofs → L 0.04–0.07; storehouse/huntcamp/prospector gold 0.355/0.233 → 0.51/0.42.
- Teal trade roofs: PR #662.
- Unverified: snow/mist haze, palms (#631), other epochs' roofs in a browser (only Bronze `bronze-town` seen).
