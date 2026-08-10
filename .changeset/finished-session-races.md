---
'@gemstack/the-framework': patch
---

Two races in the finished-session seam are closed. Everything that mutates one run's checkout — teardown's archive-commit-retire, the Push/Open-PR commit step, Remove/Delete of the worktree, and a Resume's checkout reuse — now serializes on a per-run lock, so an action clicked the instant a session flips done waits a beat instead of failing with "could not commit the work this session left uncommitted" (and teardown no longer strands a worktree it lost that race to). And the live event feed follows the run's journal across its relocation into the archive: a fixed-path tail whose fs.watch missed the final appends used to go silent without the run's `end`; the tail now re-resolves the journal's home and carries its read offset, so exactly the missed lines arrive, once — in the dashboard's live channel and the device relay alike.
