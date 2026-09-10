The right rail's Docs tab body: the documents an agent [1] writes for the user as it works — the PLAN and TODO markdown files the daemon surfaces from the checkout [2] — rendered as Markdown one at a time, with a row of buttons, one per document labeled by its file name, to switch between them. Which files qualify, their order and the size cap per document are the read's rules in `src/dashboard/docs.ts`; whether the tab is offered at all is the rail's decision (`RightRail.tsx`), which owns the read and hands the panel what it found.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **Loading and empty are different facts** - until the first read has answered the panel says "Loading…"; once it has answered with no document it says "No PLAN/TODO docs yet.", so a project that has documents never flashes the empty message while the read is out.
- **One document at a time** - the first document shows by default, the active document's button is highlighted, clicking another button switches to it, and the body scrolls on its own; if the active document disappears from the list, the last one shows.
