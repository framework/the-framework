---
'@gemstack/framework': patch
---

Fail closed when a checklist reply omits the required `{ blockers }` verdict. A verdict-less reply was scored as empty-blockers (production-grade) and stopped the loop; it now surfaces a blocker so the loop re-prompts instead of declaring the app done off an unverifiable reply.
