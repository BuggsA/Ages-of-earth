# The Interceptor Battery (#777, s2 of #759)

Chain 1024-1610, session 6. Branch `claude/777-missile-battery`.

**Built:** the Interceptors technology (Siege Workshop, Industrial Age, every people), the Interceptor Battery (military menu, I), and the last seconds of a launch: at 2 s left the nearest charged battery covering each warhead's ring (as its team is shown it) fires and the roll is drawn and stored on the launch (`Launch.icpt`); at 1 s left it meets the missile on its arc, and a hit takes that warhead out of the sky, blast and fallout both. A salvo's three warheads draw one attempt each. The computer learns the tech once a rival stands in the Industrial Age, raises up to two batteries over its Town Centers, and aims its own launches outside a rival's charged cover when a target as good lies there.

**Look and sound:** a battery model (pad, rail with its interceptor, radar dish, bunker); teal cover circles drawn through the fog while a warhead is in the air, while placing a battery, or with a silo or battery selected; the interceptor climbs from the rail onto where the missile will be; a white burst overhead on a hit, a dark puff on a miss; three synthesized sounds.

**Numbers:** `INTERCEPT = { chance: 0.6, reach: 12, fire: 2, meet: 1, reload: 90, most: 2, gap: 40 }`; battery 1400 hp, 150 wood 250 stone 300 gold, 50 s; Interceptors 500 food 700 gold 250 stone, 60 s.

**Not done:** s3, the silo Reserve toggle (#759). The computer defender still clears covered rings as before (a 60% stop is no shelter).
