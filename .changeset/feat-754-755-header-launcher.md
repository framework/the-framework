---
"@gemstack/framework": minor
---

Surface the theme control and give the navbar launcher its run controls (#754, #755).

The theme has been switchable since #725, but it lived inside the per-run options gear: an app-wide appearance setting filed under one run's options, and absent entirely on a screen showing only the navbar, so it was effectively unreachable. It is now a control in the header, reading and writing the same `preferences.theme` as before. The gear drops its copy, so there is one home for it rather than two.

The navbar quick launcher rendered an editor and a Start button and nothing else, so a run started there used the stored agent, model and options with nothing on screen saying which. It now carries the same agent/model select and options gear as the full composer, sharing one definition rather than a compact-only duplicate, and stays a single row so the header does not grow.

The `dashboard` badge beside the wordmark is gone.
