---
'@gemstack/the-framework': patch
---

A web run's meta now records the cloud session's real URL instead of the generic claude.ai/code entry point (#1317): the cloud hand-off's result event carries the session link, and the session-update prefers a driver-supplied URL over the --session-link template
