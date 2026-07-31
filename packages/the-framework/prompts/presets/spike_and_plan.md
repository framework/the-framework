For every ticket `tickets/<TICKET>.md` without `<TICKET>.plan.md` and `<TICKET>.lock.md`, add the following to TODO_AGENTS.md
- "Create tickets/<TICKET>.plan.md — if the plan concludes the ticket is an unambiguous quick win (low Effort, Uncertainty 0), also add \"Implement tickets/<TICKET>.md\" to TODO_AGENTS.md in the same commit"

Put the entries in the right `## Priority` following a mix of sensible criteria after reading `tickets/<TICKET>.md` (e.g. if ticket seems low effort => higher priority).
