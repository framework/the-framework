---
'@gemstack/the-framework': patch
'@gemstack/framework-dashboard': patch
---

The armed-handoff line now owns the merge half (#1382). A run launched with auto-merge advertised "when this ends: push the branch and open a draft PR" and then opened a ready PR and merged it to main unattended — the most consequential thing a run can do was the one thing the line didn't say. The `handoff-armed` event and the run record's `handoff` mirror now carry the merge arming (display-only; the merge itself still fires off the run's own config, #1216), the transcript line says "push the branch, open a PR, and merge it", and the dashboard's checkbox relabels to "Open PR & merge". Older journals lack the field and keep their old reading: merge off.
