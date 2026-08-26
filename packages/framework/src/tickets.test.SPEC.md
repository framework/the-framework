What the tests cover: the ticket and queue conventions and the links between them.

- The locations are pinned: tickets in `tickets/`, the agent queue at the root `TODO_AGENTS.md`.
- The Ticketing format spec ships inside the package (not materialized into the repo) and teaches the ticket, plan, and lock file names plus the priority, topics, and GitHub header fields; the backlog format spec likewise ships in the package and teaches the numbered priority sections, that priority 10 is the rare exception, and that the file is priority-sorted.
- The priority mapping takes a 0–10 number at its word (padding tolerated), sends an unmarked ticket to the middle, and refuses to guess for word spellings, out-of-range, or fractional values — all land in the middle.
- Reading a queue entry's ticket accepts a markdown link into `tickets/` and treats plain text or a link elsewhere as no ticket; only a plain `tickets/<name>.md` counts as a ticket path — traversals, nested paths, dotfiles, non-markdown, absolute paths, and URLs are all rejected, including a traversal dressed as a link.
- The plan ask's exact sentence is pinned ("create the ticket's `.plan.md` sibling"), and as a queue entry it reads as plain text, never as a queued ticket.
- The plan's author is the newest agent whose ask names that plan — the exact sentence or a drain prompt carrying it — never an agent asked for another plan, an implementation run linking the ticket, or one with no ask; a plan nobody was asked for has none.
- The GitHub issue reference is read off the ticket's `GitHub:` header line with the URL as the identity (a disagreeing label loses), a hand-written `#N` as fallback, and nothing when the line is absent or names no number.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
