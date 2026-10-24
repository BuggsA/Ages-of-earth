# Light: night under the grade (#622, session 6)

- `post.ts`: the grade's contrast now fades out in the darks (`smoothstep(0.03, 0.2, l)`), so Medium's night no longer crushes brown units and siege to black.
- `scripts/look/shots.mjs`: `SHOT_QUALITY=low|medium|high` sets the quality (localStorage `ages-quality`); `SHOT_QUERY` was documented but never read, now it is.
- Seen: `battle` at `&hour=22` on Medium and Low. Low reads best at night; Medium after the fix is closer, siege still dark. Haze (fog near/far) looked fine on Medium and Low; snow and mist not checked.
- Next: night lift for units on Medium (hemi at night), snow/mist shots.
