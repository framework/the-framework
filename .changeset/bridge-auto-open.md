---
'@gemstack/the-framework': minor
---

The browser bridge now publishes which cloud sessions are worth watching, at `GET /_bridge/sessions`, so the extension can open a pinned background tab for each instead of only working while somebody happens to be looking at claude.ai. Recency is the whole filter and has to be: a web run ends at its hand-off, so every one of them reads `done` whether its session is parked on a question or finished an hour ago, and there is no read-back that would say which. Capped at three, twelve hours back, newest first.
