The dashboard's right rail for an agent's [1] views [2]: the markdown documents an agent pushes while it works — a plan, a summary, a writeup — each shown as its own document, with a row of tabs to move between them and a button to copy the one on screen as markdown.

## Context

**User story**: while an agent [1] works, it hands the user documents to read: what it intends to do, what it found, what it changed. They arrive as they are written, without interrupting the agent, and the user reads them beside the agent's activity rather than digging them out of its messages. A view [2] is usually the thing the user then pastes somewhere else.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[3] gate: a question with options at which an agent stops and waits for an answer.

## Business logic — TL;DR

- **Views never block the agent** - a view is something to read, not something to answer, so the agent keeps working while it is on screen.
- **A new view selects itself** - the rail jumps to a view the user has not seen, while a view being re-pushed updates where it is without stealing the selection.
- **One tab per view** - with more than one view, a tab row stays in reach at the top; a single view has no tabs.
- **Copying a view** - the view on screen can be copied as markdown in one click.
- **Nothing pushed yet** - the rail says so instead of showing an empty document.

## Business logic

### Views never block the agent

#### Context

**Problem**: the other thing an agent [1] puts in front of the user, a gate [3], stops the agent until it is answered. A view [2] must not be mistaken for one.

#### Business logic

A view is a document, not a question: it appears in the rail and the agent [1] carries on working. Views arrive as the agent writes them, one at a time, over the same live stream as everything else the agent does.

### A new view selects itself

#### Context

**Problem**: an agent [1] that pushes a fourth view while the user is reading the first would otherwise change nothing on screen, and the tabs alone would not say which one is new.

#### Business logic

When a view [2] the user has not been shown before arrives, the rail switches to it. A view the agent pushes again under the same identity replaces its content where it is and does not steal the selection, so an agent revising the document the user is reading updates it in place.

When the views are replaced wholesale — starting to watch another agent, whose stream is a different one — the selection is kept within the new set rather than pointing past its end.

### One tab per view

#### Context

See `## Context`.

#### Business logic

With two or more views [2], a row of tabs sits at the top of the rail and stays there while the document scrolls, one tab per view showing that view's title, the current one highlighted. A long title is shortened on its tab, with the full title on hover. With a single view there is no tab row: there is nowhere to move to.

The view on screen is headed by its own title.

### Copying a view

#### Context

**User story**: a view [2] is typically the plan or the summary the user pastes into a ticket, a pull request or a message to someone else.

#### Business logic

Beside the view's title sits a copy button, "Copy this view as markdown", which puts the view's markdown on the clipboard exactly as the agent [1] wrote it.

### Nothing pushed yet

#### Context

See `## Context`.

#### Business logic

An agent [1] that has pushed no view [2] leaves the rail reading "No views yet.".
