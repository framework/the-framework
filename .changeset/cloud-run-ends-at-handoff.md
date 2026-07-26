---
'@gemstack/the-framework': patch
---

A run on Claude Code on the web now ends at the hand-off, instead of carrying on locally as if the agent had answered. It had not: a cloud session's replies stay in the cloud, so every phase after the first prompt was reading the driver's own "handed off to <url>" note as the agent's reply. The production-grade checklist found no verdict in it and reported the app un-reviewable, and the backlog gate then asked "Start the next backlog item?" about work that was no longer on this machine, which is why the same question turned up on every cloud run before the session had even replied. The review passes, the backlog loop and the stay-open composer are dropped for this target, and the run view says the session asks its questions and opens its pull request over there.
