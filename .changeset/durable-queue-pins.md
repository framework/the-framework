---
"@gemstack/the-framework": patch
---

Fix a pinned queue entry being handed out to a second agent (#1253). The routine's drain pins lived only in the daemon's memory, so a hands-off web run (whose local process ends at the hand-off while the cloud session still works the entry) and a daemon restart both put the entry back on the market, fanning it out again and opening duplicate PRs. The pinned entry now travels to the run's meta (`--queue-entry`, like `--ticket`), and the sweep derives durable claims from the metas: a live run holds its entry, a finished one holds it while its PR is open, and failed/stopped runs release it.
