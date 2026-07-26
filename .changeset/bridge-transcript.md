---
'@gemstack/the-framework': minor
---

The browser bridge now mirrors what a Claude web session is saying, not just the question it is parked on. The extension reads the transcript from the session page and posts what changed to `POST /_bridge/events`, keyed by each message's position so the same message arriving on every DOM change replaces rather than repeats. The run view renders it under the cloud notice. It is a mirror of another product's page rather than a run log of our own: no tool calls, no timings, and nothing arrives while the tab is closed.
