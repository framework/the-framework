The hover card over a file in the Files tab's tree and in a working agent's list of changed files: pointing at a file opens a card that shows what is in it — the diff for a file the selected agent [1] changed, the contents for an unchanged one — read from the selected agent's checkout [2] and kept current while the card stays open. Nothing is read for a file the user never points at.

## Context

**User story**: the user hovers a file in the tree and sees, without leaving the dashboard for `git diff`, what the agent [1] changed in it, or what the file contains when it is untouched. Clicking is already taken, since a click toggles the file as context for the next prompt, so hover is the free gesture.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".

## Business logic — TL;DR

- **Opening on hover** - the card opens after the pointer rests on a file row for 350 ms, stays open while the pointer travels into it, and closes 150 ms after the pointer leaves; it sits to the left of the row, bounded to 70% of the viewport's height, and scrolls.
- **Diff or contents** - a file the tree marks as changed shows its diff, with a "+added −removed" count in the header; an unchanged file shows its contents; the header always leads with the file's full path.
- **Read lazily, kept fresh** - the read happens only when the card opens, reads wherever the selected agent's files are now, and is repeated every 5 seconds while the card is open so a file the agent is still editing keeps up.
- **Waiting and empty states** - "Reading the diff…" or "Reading the file…" while the first read is out; "No change to show." or "Nothing to show." when the server part has nothing for the file.

## Business logic

### Opening on hover

#### Context

See `## Context`.

#### Business logic

The card opens after the pointer has rested on a file row for 350 milliseconds, holds open while the pointer travels into the card so a long body can be scrolled, and closes 150 milliseconds after the pointer leaves both. It is placed to the left of the row, is about 42 rem wide but never wider than 80% of the viewport, and is capped at 70% of the viewport's height, scrolling inside. A card that is closed does not exist, so nothing is read for a file the user never points at.

### Diff or contents

#### Context

See `## Context`.

#### Business logic

Which read the card makes is decided by the tree: a file the tree saw a git status for is read as a diff, any other file as plain contents, so the status is never looked up a second time. The header shows the file's full path in a monospaced line and, for a diff, the count of added and removed lines at the right (the count is the dashboard's own "+added −removed" pair; the body's rendering rules are in `DiffView.tsx`; what a diff contains, how it is capped, and when a file counts as binary are the server part's rules in `src/diff.ts` and `src/read.ts`). The body renders the diff or the contents accordingly.

The card's body is also what the Changes tab shows beside its list (`ChangesPanel.tsx`). There it may be given one commit of the agent's work: the diff read is then what that commit alone changed in the file.

### Read lazily, kept fresh

#### Context

**Problem**: the card is open over an agent [1] that may still be editing; a body read once would freeze at whatever the file was when the pointer arrived.

#### Business logic

The read is made through the module's own server part, scoped to wherever the selected agent's files are now (its checkout [2] while it has one), or the project's own checkout when no agent is selected, and is repeated every 5 seconds while the card is open. Changing the project, the agent, the file or its changed state starts a fresh read.

### Waiting and empty states

#### Context

See `## Context`.

#### Business logic

Until the first read answers, the body reads "Reading the diff…" for a changed file and "Reading the file…" for an unchanged one. When the server part answers that there is nothing for the file (a path it refuses, a file it cannot read, or a changed file with no diff to show), the body reads "No change to show." for a changed file and "Nothing to show." for an unchanged one.
