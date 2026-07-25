---
"@gemstack/the-framework": patch
---

Commit what a session left in its checkout when its work is handed off, so a settled agent that never committed no longer dead-ends at "No commits between main and the-framework/...". The finishing step also stops calling an empty branch a dead end while the work is sitting uncommitted next to it.
