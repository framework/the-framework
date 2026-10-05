Draws, in an agent's [1] transcript, the files a turn's edits changed: one bordered row per file, with the file's name, the lines added and removed, and an arrow. A click on a row asks to show that file's change.

## Context

**User story**: under the agent's answer the user reads what the turn changed, one row per file, as Claude Code on the web lists it at the end of a turn: "DESCRIPTION.md +11 −0 ›". The user clicks a row to read that file's diff in the side panel.

**Business logic story**: which files a turn changed, and their lines, is `lib/turn-changes.ts`'s rule. Where the rows sit in the transcript and when they are drawn is the transcript's (`EventList.tsx`). What a click opens is the agent's page's (`AgentView.tsx`).

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.

## Business logic — TL;DR

- **One row per file** - a list named "Files changed"; each row has a border and round corners and holds a file icon, the file's name, the lines added in green and the lines removed in red ("+11 −0"), and, when the row opens something, an arrow pointing right.
- **A click shows the file's change** - given a way to show a change, each row is a button named "Show the change to <name>"; a click asks for the file by its path.
- **Nothing to open it in: no button** - given no way to show a change, the rows are plain, with no arrow.

## Business logic

### One row per file

#### Context

See `## Context`.

#### Business logic

The component is given the files of one turn, in order, and draws a list named "Files changed" for assistive technology, in the page's own font, one row per file under the other, each as wide as the transcript's column. A row has a border and round corners and holds, in order:

- a file icon, grey;
- the file's name, the last part of its path, in the regular text color, cut with an ellipsis when it does not fit, with the file's path on hover;
- the lines added and the lines removed, as "+11 −0": "+" and the lines added in green, a space, "−" and the lines removed in red, in digits of one width. Both are always said, a zero too;
- an arrow pointing right, grey, only when the row is a button.

### A click shows the file's change

#### Context

See `## Context`.

#### Business logic

When the component is given a way to show a change, each row is a button whose accessible name is "Show the change to <name>", washed grey while the pointer is on it. A click asks for that row's file by its path, as the component was given it (its path in the agent's checkout).

### Nothing to open it in: no button

#### Context

**Problem**: the tab that shows a file's change is a module's, which a project may not have. A row that looks like a button and opens nothing reads as broken.

#### Business logic

When the component is given no way to show a change, each row is drawn the same but is no button: it has no arrow, no wash under the pointer, and a click does nothing.
