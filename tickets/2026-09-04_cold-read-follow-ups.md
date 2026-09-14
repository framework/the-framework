Priority: 4
Topics: [skills, skill-branches, skill-tickets, skill-queue]
GitHub: [#1757](https://github.com/framework/the-framework/issues/1757)

# Follow-ups from the DECISIONS.md and SKILL.md cold reads

## TLDR

What the cold reads of the skills' DECISIONS.md and SKILL.md (#1755, #1756) found in the code that no file decides. Several items are already resolved; this ticket keeps only what is still open.

**Still open**
- CI flake: the daemon test "a run loses its worktree once its work is on the remote" timed out twice at 12 s on markdown-only commits, green on rerun.
- Packaging: `npm pack` leaves `"@gemstack/agent-data": "workspace:*"` in the skill tarballs, which `npm install` refuses (`EUNSUPPORTEDPROTOCOL`); `pnpm pack` rewrites it. Publish with pnpm, or add a prepack rewrite.
- Undocumented: `tickets.ts` skips a leading `Source:` line when picking a ticket's summary — document or remove.
- Undocumented: `release` prints the same shape as `claim`, so a caller cannot tell a lock was lifted.
- Undocumented: `queue` prints a flat array with no priority, while the skill says "in order of work".

**Design questions**
- Queue file: an unranked entry added before any `## ` section exists outranks Priority 10 forever once a `--priority` add creates its section below it (same family: a title-only queue file getting sections appended).
- The reclaim pushes whatever branch an agent's checkout ended on, the user's own included; only deletion is limited to `agent-*`.
- `close` does not touch the queue: an entry linking the closed ticket stays until `queue done`.
- A scoped package (`@acme/x`) installed in an agent's checkout still writes into the user's `node_modules` (dependency links go one entry deep, a scope is one entry).
- Kept as design by decision, not bugs: the merged-branch rule counts any remote (skill-branches DECISIONS.md), and `priority` is a string (tickets DECISIONS.md).

**Resolved** (for reference): #1772 fixed the git `branch` time budget, the swallowed forced-removal failure, `branchesDeleted` naming failed deletions, and `remove <name>` birth-branch derivation. The dot-prefix name item went with #1761. The `prune` item is moot. The queue-edit `{ok:false}` and `--ticket` label items are moot since the queue became its own skill.

## Why it matters

None blocks anything, but each is a small correctness or documentation gap in the standalone skills that strangers will read and run.

## Source

Imported from GitHub issue [framework/the-framework#1757](https://github.com/framework/the-framework/issues/1757), created 2026-09-04. Comments folded through 2026-09-09T22:38Z.
