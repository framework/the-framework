Topics: [skills, docs]
Issue: [#1757](https://github.com/framework/the-framework/issues/1757)

# Follow-ups from the DECISIONS.md and SKILL.md cold reads

## TLDR

A list of code and design items found by the cold reads (#1755, #1756); none of them blocks anything. Status below.

**Status on main as of 2026-09-28:** most items were fixed (#1761, #1772), kept on purpose in DECISIONS.md, or went stale. Five are still open:
1. Packaging: `npm pack` keeps `workspace:*` dependencies in the skill tarballs, while `pnpm pack` rewrites them. It matters once a package is published.
2. Undocumented: the tickets SKILL.md does not say what `tickets release` prints.
3. Queue: an entry with no priority heading sorts first in the drain but last on the Queue page.
4. Reclaim: reclaiming a checkout pushes whatever branch it is on, the user's own included.
5. Installs: a scoped package installed in a checkout writes into the user's `node_modules`.

The CI flake and the other items from earlier lists are no longer open.

## Why it matters

Small correctness and packaging gaps in the published skills: the `workspace:*` tarball breaks `npm install` for anyone outside pnpm, and the design questions decide how the queue and reclaim behave for users.

## Source

Imported from GitHub issue [framework/the-framework#1757](https://github.com/framework/the-framework/issues/1757), created 2026-09-04, no labels, 3 comments (last folded: 2026-09-28T01:23Z).
