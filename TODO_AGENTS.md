# TODO_AGENTS

## Priority 8

- [Reword stale auto-merge-disabled launcher warning](tickets/2026-07-31_ux-gh-auto-merge-disabled.md) — quick win (effort 1): the copy in `StartAgentForm.tsx:240-247` still claims "an auto-merged session lands its PR immediately — CI is not awaited", but the CI watch now merges on green. Apply Solution 1 of [the plan](tickets/2026-07-31_ux-gh-auto-merge-disabled.plan.md): reword to "merge on green, handled locally by the daemon; enable Allow auto-merge for the server-side version", update the two adjacent comments and `StartAgentForm.test.tsx`, then close #1417 and delete the ticket files.
- [Close "Unclear UX: what should I do now?"](tickets/2026-07-25_unclear-ux-what-now.md) — quick win (effort 1, no code expected): every follow-up from the #1173 thread is implemented (audit in [the plan](tickets/2026-07-25_unclear-ux-what-now.plan.md)). Close GitHub issue #1173 with a comment mapping each thread follow-up to what shipped, and delete the ticket + plan files.
- [Close "Useless history in new session page?"](tickets/2026-08-03_useless-history-new-session-page.md) — quick win (effort 1, bumped from ticket priority 7 because lowest effort): the questioned history panel was deleted by #1536 (commit `9aff651`). Per [the plan](tickets/2026-08-03_useless-history-new-session-page.plan.md): close GitHub issue #1495 referencing #1536, sweep the ~12 stale `LOGS.md` comments listed in the plan's Considerations, and delete the ticket + plan files. Leave the sidebar `STOPPED` badge alone (deliberate honest-status design).

## Priority 5


## Priority 4


## Priority 3


## Priority 2

