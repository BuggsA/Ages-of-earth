# Reclaimer foundation fade (#410)

Codex extended #397: each own, unexpired footprint fades independently across `RECLAIM.window`, from full strength to 20% vertex alpha. The material's existing 0.6 opacity still applies. The faint floor keeps a nearly expired site readable until the rule removes it. Match ticks drive the fade, so it pauses with the game. One LineSegments draw, capped at 32 sites, uses reused position and RGBA buffers. Simulation, save state and balance numbers are unchanged.

Checks:
- Focused foundation fade + existing foundation-view tests: 4 passed, 885 ms. Covers independent ages, no state mutation, pause/expiry and buffer reuse; existing ownership/visibility/cap tests unchanged.
- `npm run check`: 146 files, 692 tests passed, unit phase 31.70 s. Same temporary TypeScript 5.9.3 fallback as #396 because the native compiler requires missing `/proc/self/exe`; original symlink restored, dependencies untouched. GitHub CI will check the installed compiler.
- `npx vitest run tests/models.test.ts`: 2 passed, 3.75 s.
- Headless `scripts/sim.ts 3 small 1` via Node's tsx loader: reached 1.0 minutes, checksum 4256325993.
- Browser launch attempted with Playwright and writable TMPDIR: Chromium executable missing. Visual appearance unverified; browser slow smoke could not run.
- Installed Three.js source grounding: WebGLPrograms selects vertex alpha for four-component vertex colors; color_fragment multiplies alpha into diffuseColor.

Next: placement preview naming the matching foundation's salvage discount. Claim ends with the PR.
