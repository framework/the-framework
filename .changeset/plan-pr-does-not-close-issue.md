---
'@gemstack/the-framework': patch
---

A fanned-out [Spike & plan] run's PR no longer closes its ticket's GitHub issue. The #1334 lane puts the ticket's issue on the PR title as `(fix #42)` so an implementing run's squash-merge closes the issue — but the fan-out planners (#1327) carry a pinned ticket too, so their plan-only PRs inherited the closing keyword and auto-closed issues whose work had merely been planned. The daemon now marks those starts `planRun` (`--plan-run`), and the title derivation skips the suffix for them; the ticket still rides `--ticket` onto the run's meta, so the dashboard keeps naming what the run is about.
