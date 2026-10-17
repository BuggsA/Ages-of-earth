# 2026-10-17 04:30 · successors: merged is no longer required

The owner asked (2026-10-17) to drop "the pull request is merged" as a condition for starting a successor. `docs/successors.md` now says pushed is enough, and the successor finishes any open pull request first. Guard added: no spawn when the chain's last two sessions each merged nothing. Prompted by #388, which sat behind a slow `ci` and then a conflict.
