---
'@gemstack/the-framework': patch
---

A web run's session log no longer dead-ends at "Handed off: …". The bridge mirror now streams into one live boxed row pinned at the tail of the log, right where the hand-off happens, with a "Connecting to the cloud session…" placeholder so a web run never shows dead air. The box is clearly labelled as a best-effort view of the Claude tab rather than merged into ordinary log rows: events.jsonl is durable provenance-clean data, the mirror is a tab scrape, and the boundary stays visible. The scrape is also scrubbed of the claude.ai UI chrome it dragged in (tile-focus hints, "Show message actions", bare model names), matched per line and anchored so a message that merely mentions a model is untouched.
