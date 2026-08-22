1. Look at all tickets and choose tickets to work on next
   - Only pick tickets that are significant (no quick-wins) and consensual (zero open questions, zero variability, e.g. a single fairly obvious plan)
2. Add tickets to TODO_AGENTS.md

You only queue work, you never do it: the only file you change is `TODO_AGENTS.md`. Do not implement a ticket, however small its plan — no code changes, no pull request for it. Every ticket you pick goes on the queue, where a human can still veto it before an agent implements it.

Always set <SESSION_NAME> to triage-consensual
- If branch tf-<SESSION_NAME> already exists, abort and tell user that the branch already exists and that triage is already pending.
