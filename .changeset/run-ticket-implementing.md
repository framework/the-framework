---
"@gemstack/the-framework": minor
---

feat(the-framework): record the ticket a run is implementing (#1117): a draining run is started with the ticket its queue entry links back to (#1164), which it emits once and folds onto `RunMeta.ticket` — so the Overview's hot-tickets card can mark a ticket as `implementing` because a run says so, instead of inferring it from the plan or spike the work left behind.
