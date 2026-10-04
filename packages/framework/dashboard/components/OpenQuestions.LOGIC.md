The "Waiting on you" section: the agents [3] that wait on an open question [1], across all projects, or only those of the project picked in the sidebar's project select when one is picked, longest-waiting first, one row per agent. A row says who waits and on what, and opens the agent; nothing is answered here.

## Context

**User story**: several agents in several projects have stopped at a question. The user sees them as a short list, like a list of sessions: which agent needs input, what it asks, in which project, since when. A click on a row opens that agent, where the question is answered in the panel above the message box (`QuestionPanel.tsx`).

**Problem**: a list that showed every question whole, with its options, took the page over and had the user answer without the agent's transcript in view.

## Glossary

[1] open question: a question nobody has answered yet, as the dashboard lists them across projects.
[2] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[3] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[4] agent view: one agent's page.

## Business logic — TL;DR

- **When the section exists** - the daemon's list of open questions [1] is re-read every 5 seconds, and narrowed to the picked project's when a project is picked; with nothing open, no section at all.
- **One row per agent** - "Needs input", the agent's [3] title, the question's title, the project's name, how long ago, an arrow; all on one line.
- **Opening the agent** - the whole row is one button that opens the agent's agent view [4]; the list sends no answer.
- **Order, count and changes** - the daemon's order, longest-waiting first; the heading counts the rows; a row keeps its place while its agent waits.

## Business logic

### When the section exists

#### Context

**Problem**: an empty "Waiting on you" on every visit is noise.

#### Business logic

The list of open questions [1] is re-read from the daemon every 5 seconds. With a project picked in the sidebar's project select, only that project's questions count. Until the first answer arrives from the daemon, and whenever no question is left to show, the section is not rendered at all: no heading, no empty state.

### One row per agent

#### Context

See `## Context`.

#### Business logic

The section is titled "Waiting on you · <count of rows>". Under it, one row per agent [3] that waits on an open question [1]. A row is one line that never wraps, and reads from left to right:

- an orange dot and the words "Needs input", in the warning color;
- the agent's title: the first line of its intent cut at 80 characters, else its agent id. It takes at most half the row and is cut with "…" past that;
- the title of the question the agent waits on (its gate [2]), muted, taking the room that is left and cut with "…" when it does not fit;
- the project's name, muted;
- how long ago the agent last spoke, muted: "just now", "12m ago", "3h ago", "2d ago", then the date past a week. Nothing is shown when the daemon gave no time, or one that cannot be read;
- an arrow pointing right.

The question's options are not shown. A list taller than 70% of the viewport's height scrolls inside the section.

### Opening the agent

#### Context

See `## Context`.

#### Business logic

The whole row is one button, named "Open <the agent's title>: needs input, <the question's title>" for assistive technology. A click opens that agent's agent view [4], switching project when the agent belongs to another project. The list has no other control: it sends no pick and no message, for a local agent and for a cloud session alike.

### Order, count and changes

#### Context

**Problem**: the list is re-read while the user looks at it; rows that jump under the cursor lead to a click on the wrong agent.

#### Business logic

- Rows are in the daemon's order: the agent that has waited longest comes first.
- The heading counts the rows shown, so only the picked project's when one is picked.
- A row belongs to its agent, not to its question: when the agent asks another question the same row stays in place and only its question's title changes. A row leaves the list when the daemon stops listing its agent's question (it was answered, or the agent went on), and the rows under it move up.
