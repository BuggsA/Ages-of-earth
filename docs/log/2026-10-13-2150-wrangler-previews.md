# Fix Cloudflare preview builds (pitch, no issue), 2026-10-13 21:50 UTC

Chain 1013-1900, session 5. Lane tooling. The owner pasted a failed Workers Build log: build passed, then `npx wrangler preview` (what Cloudflare runs on non-production branches) errored "needs a `previews` block". Added an empty `[previews]` to `wrangler.toml`; `docs/status.md` item 4 corrected. `npm run build` and `wrangler deploy --dry-run` pass. Not tested against Cloudflare itself.
