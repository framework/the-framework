---
'@gemstack/the-framework': minor
'@gemstack/framework-dashboard': minor
---

Sessions end themselves, and Stop becomes a pause (#1390/#1391).

A finished session no longer parks on the human. Once the work and the backlog gate settle, the chat phase drains any message that already arrived and then the run ends at its own natural end — handoff included, so an armed merge fires there (still gated on the agent's ready-for-merge signal, #1363). The "waiting" limbo (`settled` event) is no longer emitted; the pill flips to done when the session actually ends. A follow-up message reopens the conversation via `--resume`, exactly like Claude Code web — the composer already did this for ended runs (#762). A run whose own terminal dashboard is the only surface keeps the old stay-open park (`stayOpenChat`), since it has no daemon to resume through.

Stop keeps its name and icon but is now a pause: it kills the current turn, publishes nothing, and the session stays resumable from the composer — cancel is just a pause never resumed.

Merge is the second session action (#1391). On a live run, the ⋮ menu's "Merge when finished" appends a `merge` control entry: the run arms the full publish ladder and records the *human* authorization, which the merge gate honors instead of demanding the agent's signal — the session still merges at its own end, and a parked backlog offer resolves to "stop" so one click suffices. On an ended run with an open unmerged PR — the withheld-merge ending, where the agent never signalled and a draft PR was left behind — the action bar's "Merge PR" button merges it directly (`sendMerge` → `mergeSessionPr`), marking the draft ready on the way.
