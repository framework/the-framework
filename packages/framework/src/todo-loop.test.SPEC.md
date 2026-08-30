What the tests cover: how the agent queue is worked down by the backlog loop, against a real repository whose queue lives on the `tickets` branch.

- **The backlog loop** - it works the queue to empty one entry per turn, taking each entry off the queue itself — the entry is deleted from the branch, not marked — and reporting how many it completed and why it ended. It narrates the opening count, each entry it starts, and its finish. With no queue it does nothing and says nothing. An item cap stops it early and reports how many entries are left, with the untouched entries still on the branch. An abort ends it before starting another entry.
- **Loop interruptions** - when the user is present, each entry is gated first: proceeding works the entry, picking stop ends the loop with the remaining entries still open. When a removal cannot be written the loop stops rather than re-working the entry, and the queue is left untouched — an entry worked twice is worse than an entry left open.
- **Signals during backlog turns** - a backlog turn can still emit every signal a normal turn can: rendered views, errors, and ready for merge. Ready for merge is emitted once for the whole loop even when several entries signal it.
- **Naming the ticket being drained** - the ticket a drain will pick up is read off the queue's first open entry, and only when that entry links a ticket; a first entry that is plain text names no ticket. Only the drain preset gets a ticket named for it — any other prompt, or a queue that cannot be read, names none, and a failed read never takes the agent start down with it. The drain the Auto PM routine fires and the drain a user fires by hand are recognized as the same drain, and no queue-filling routine is mistaken for one.
- **Per-agent pending work** - whether an agent still has unfinished work of its own is read only from its own session-named TODO file; the shared agent queue never counts, so a non-empty queue cannot block an agent from being merged.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
