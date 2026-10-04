Draws the line of an agent's [1] transcript that says what was set up for the agent before it began: one folded grey line, "Session set up", which opens to the agent's checkout, its branch, and the coding agent [2] that was started.

## Context

**User story**: the user opens an agent's page and, under their first message, reads one grey line saying the session was set up, as Claude Code on the web opens a session with "Initialized session". The user opens it to see where the agent works (the folder of its checkout), on which branch, and which coding agent and model were started. Nothing the tool did before the agent's first step is hidden.

**Business logic story**: the facts are read off the agent's card [3], which the dashboard reads again with the project's agents, so the line fills in and changes in place: the branch's name when the agent renames its branch, the model once the coding agent says which one it runs.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] card: the small file the tool that runs an agent keeps beside the agent's diary, saying how the agent stands: its status, its branch, the folder of its checkout, the coding agent and the model it runs.

## Business logic — TL;DR

- **One folded line** - "Session set up" with a chevron; a click opens a bordered box, a click again folds it.
- **What the box says** - the checkout's folder, the branch, the coding agent and its model; a fact the card [3] does not say is no line.
- **Nothing known, nothing drawn** - a card that says none of the three draws no line at all.

## Business logic

### One folded line

#### Context

See `## Context`.

#### Business logic

The line is grey, in the page's own font, drawn like the folded line of the coding agent's tool calls (`ToolCalls.tsx`): the words "Session set up" and a chevron pointing down. It starts folded. A click opens a box with a border and round corners under it and turns the chevron to point up; a click again folds the box away. Where the line sits in the transcript is the transcript's rule (`EventList.tsx`).

### What the box says

#### Context

See `## Context`.

#### Business logic

The box holds up to three lines, in this order, each a grey label then its value in the dark text color, cut with an ellipsis when it does not fit and whole in a tooltip:

- "Checkout made" and the folder of the agent's checkout, when the card [3] says it;
- "Branch" and the branch's name, when the card says it;
- "Coding agent started" and the coding agent's [2] name ("Claude Code", "Codex"; a coding agent the dashboard has no name for reads as the card names it), followed by " · " and the model when the card says one. The model reads by the name its coding agent lists it under ("Opus 5.5"), and by its id while that list is not known or does not hold it (the naming rule in `lib/models.ts`).

### Nothing known, nothing drawn

#### Context

**Problem**: a card just listed may say nothing yet, and an agent whose card is not listed has no facts at all. A line that opens to an empty box would say something was set up and show nothing.

#### Business logic

When the card says neither a checkout, nor a branch, nor a coding agent, the component draws nothing.
