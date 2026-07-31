---
'@gemstack/the-framework': minor
---

`planned-quick-wins.ts` is removed (#1420 discussion): it parsed the pre-#1420 `Effort: quick-win` / `Consensus: consensual` plan keys, which the 0-10 format never produces, so it promoted nothing. Its job moves to the planning agent itself — the [Spike & plan] preset's queued entries (and the fan-out's pinned prompt) now tell it to queue "Implement tickets/<TICKET>.md" in the same commit as a plan that concludes an unambiguous quick win, the same carry-it-in-your-own-PR pattern as the `.lock.md` release. The `promotePlans` auto-PM seam is gone with it.
