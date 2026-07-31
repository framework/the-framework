---
'@gemstack/the-framework': minor
---

`planned-quick-wins.ts` is removed (#1420 discussion): it parsed the pre-#1420 `Effort: quick-win` / `Consensus: consensual` plan keys, which the 0-10 format never produces, so it promoted nothing. Quick-win promotion stays a separate task, as the catalog already has it: the [Triage quick] rotation preset picks and queues quick wins, now informed by plans' `Effort`/`Uncertainty`. The `promotePlans` auto-PM seam is gone with it.
