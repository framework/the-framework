Topics: [skills, docs]
Issue: [#1757](https://github.com/framework/the-framework/issues/1757)

# Follow-ups from the DECISIONS.md and SKILL.md cold reads

## TLDR

A list of code and design items found by the cold reads (#1755, #1756); none of them blocks anything. Status as of 2026-09-09:

**Done or moot.** #1772 fixed four mechanical bugs: the git `branch` time budget, a failed forced worktree removal no longer swallowed, `branchesDeleted` naming only branches that really went, and `remove <name>` through a rename link. The dot-prefix name item went to #1761 (ticket `2026-09-05_ticket-name-forms-agree.md`). The `prune` item, the queue-edit `{ok:false}` item and the `--ticket` label item are moot (the queue moved to its own skill, with no `--ticket` flag).

**Kept as design questions, by decision:** `priority` returned as a string (`"10"` sorts below `"7"`), which is what the tickets DECISIONS.md says; the merged-branch rule counting any remote while "pushed" means `origin` only, which is what the branches DECISIONS.md says.

**Still open:**
- CI flake: the daemon test "a run loses its worktree once its work is on the remote" times out at 12s on markdown-only commits.
- Packaging: `npm pack` leaves `"@gemstack/agent-data": "workspace:*"` in the skill tarballs, and `npm install` refuses that. Publish with `pnpm pack`, or add a prepack rewrite.
- Undocumented: `tickets.ts` skips a leading `Source:` line when picking the summary; `release` prints the same shape as `claim`; `queue` prints a flat array with no priority although the skill says "in order of work".
- Design: an unranked queue entry added before any `## ` section outranks Priority 10 forever; the reclaim pushes whatever branch a checkout ended on, the user's own included; `close` leaves the ticket's queue entry in place; a scoped package an agent installs in its checkout still writes into the user's `node_modules`.

## Why it matters

Small correctness and packaging gaps in the published skills: the `workspace:*` tarball breaks `npm install` for anyone outside pnpm, and the design questions decide how the queue and reclaim behave for users.

## Source

Imported from GitHub issue [framework/the-framework#1757](https://github.com/framework/the-framework/issues/1757), created 2026-09-04, no labels, 2 comments (last folded: 2026-09-09T22:38Z).
