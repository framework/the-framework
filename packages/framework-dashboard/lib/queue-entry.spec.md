Splits a queue entry line (markdown out of `TODO_AGENTS.md`) into display text and link target for the Overview card (#1164) — the card used to print the line verbatim, so the reader got truncated markdown source and the queue looked broken because it was unreadable.

## TLDR

- Only a `[title](target)` link at the START of the line counts as the title — that is where `sendQueueTicket` writes it; a link mid-sentence is part of the sentence, and the line passes through untouched.
- Anything after the leading link (the agent's own appended note) is dropped from the label: detail belongs in the tooltip, not in a one-line list that would truncate the title away to show it.
- Target classification mirrors the Overview's `queuedTicketFile` (overview.ts): `tickets/…` → `ticket` as the bare filename (the `WorkspaceTicket.file` key, so the consumer can open the ticket's page); absolute http(s) → `url`; any other target (a bare repo path like `README.md`) keeps the title but points nowhere rather than at a dead destination.
