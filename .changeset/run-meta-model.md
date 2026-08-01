---
'@gemstack/the-framework': minor
'@gemstack/framework-dashboard': minor
---

Record the model on the run (#1438): each leg's `session` event carries the model id the driver was started with, folded onto `RunMeta.model` and `sessionInfo()` (latest leg wins — a continuation may run a different model), shown in the transcript's session line and the run page's session-details strip.
