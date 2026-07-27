---
"@gemstack/the-framework": patch
---

A daemon restart no longer risks double-assigning a queue entry (#1268): the drain's pin now rides the suspended-run record and is handed back on resume, so the resumed run re-emits its claim whether or not the meta replay kept it.
