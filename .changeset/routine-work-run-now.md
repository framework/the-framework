---
"@gemstack/the-framework": minor
---

Show the routine work on the Overview: the jobs the idle sweep fires (drain the queue, harvest quick-wins, triage, spike & plan, the maintenance sweep), each with a "Run now" button that starts it against a project immediately, plus the single auto-run checkbox that says when the next sweep is due. The list is the daemon's own job table rather than a copy, so the two cannot drift.
