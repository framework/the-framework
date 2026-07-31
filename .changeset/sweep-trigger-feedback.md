---
'@gemstack/the-framework': patch
'@gemstack/framework-dashboard': patch
---

"Trigger routine now" answers (#1433): the RPC was fire-and-forget, so the button flashed for milliseconds and a sweep that ran and refused showed nothing — the stand-down reason (e.g. #1432's "the queue has work waiting and its routine is switched off") was recoverable only from the source. The RPC now awaits the tick and returns the report's per-project outcome lines; the Routine work card shows them in its note slot (folder-prefixed when several projects answered) and holds "Triggering…" until the sweep resolves. The two previously silent stand-down paths (queue empty on a drain-only sweep, drain routine switched off) now also write daemon log lines like every other stand-down.
