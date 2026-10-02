Everything the dashboard works out about subagents [2] from the list of agents [1] it already reads: which agents are a given agent's subagents, what a subagent is called, whether it is over, whether it still holds its main agent's job, how a list of agents becomes a tree with subagents under their main agent, which prompt of a main agent's transcript is really the line saying one of its subagents ended, when a subagent started, and where in that transcript each subagent's row goes. All of it is read off one fact, the parent on a subagent's card.

## Context

**User story**: the user asks one agent for work it splits across subagents [2] (the `orchestration` skill). In the "Recent agents" list the subagents sit under their main agent; on the main agent's page each subagent has a row where it was started and a row where it ended; and above the message box a line counts the ones still working.

**Problem**: without this every subagent was a row like any other in the "Recent agents" list, the main agent's transcript said nothing about its subagents while they worked, and the line telling the main agent that a subagent ended read as if the user had typed it.

**Business logic story**: the tool that runs agents writes, on the card of an agent it started for another agent, that other agent's id as the parent (`agent-runner`'s `records.ts`), and sends the main agent one line when the subagent ends (`agent-runner`'s `parent.ts`). The daemon hands each agent's card to the dashboard with the parent on it (`src/store/agent-store.ts`). Three views read the rules below: the "Recent agents" list (`components/AgentHistory.tsx`), the transcript (`components/EventList.tsx`) and the subagents' lines (`components/SubagentLine.tsx`).

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] subagent: an agent [1] started for another agent, its main agent, which split its task across subagents (the `orchestration` skill). The subagent's card names the main agent's id as its parent.
[3] agent id: an agent's stable id, derived from the moment it started, so ids sort in the order the agents started.
[4] the ended line: the message the tool that runs agents sends a main agent when one of its subagents [2] ends. Its first line is `The run <agent id>, started for this run, ended <status>.`, with `: <reason>` after the status when the subagent did not end well; the lines after it say where the subagent's work is and what it said last.
[5] event: one thing an agent did, read off one line of the agent's diary, with the time the line was written when the line says it.

## Business logic — TL;DR

- **An agent's subagents** - the agents whose card names it as their parent, oldest first.
- **What a subagent is called** - the first line of what it was asked; else what any agent is called.
- **Whether a subagent is over** - a subagent that is `running` or `waiting` is not over; any other is.
- **Whether a subagent holds its main agent's job** - while it is `running`, it is saving, or it ended less than 10 seconds ago, its main agent's job is not over.
- **A list as a tree** - an agent whose parent is in the list sits under it, oldest first; the tree is one level deep, every other agent keeps its place, and in a list pooling several projects the main agent is looked for in the same project.
- **A subagent's end among the prompts** - a prompt that opens with the ended line [4] and names one of this agent's subagents is that subagent's end: the subagent, the status, the reason and the rest of the message; any other prompt is the user's.
- **When a subagent started** - the moment its id [3] was made from, which never changes; the start time on its card only for an id that is no time.
- **Where a subagent's row goes** - before the first event [5] written after the subagent started; at the end when none was.

## Business logic

### An agent's subagents

#### Context

See `## Context`.

#### Business logic

Given a list of agents [1] and one agent's id [3], the agent's subagents [2] are the agents of the list whose parent is that id, sorted by their own id, so oldest first. An agent nobody names as parent has none.

### What a subagent is called

#### Context

**Problem**: a subagent's prompt is its task followed by an empty line and the lines every subagent is told ("You are a subagent: …"). Called by its whole prompt, every subagent's name would end in the same text.

#### Business logic

A subagent [2] is called by the first line of what any agent is called (`agent-label.ts`: what it was asked, else its branch, else when it started), with surrounding whitespace removed. For a subagent with a prompt that is the first line of its task.

### Whether a subagent is over

#### Context

See `## Context`. The "Recent agents" list keeps a main agent's subagents open while one of them is not over.

#### Business logic

A subagent [2] whose status is `running` (it is working) or `waiting` (it ended on a question, and the answer resumes it) is not over. With any other status it is over.

### Whether a subagent holds its main agent's job

#### Context

**Problem**: a main agent never waits in a process: it ends its turn after starting its subagents [2] and is continued each time one of them ends. So its own record says `done` while the job it was given is still going. And the continuation comes a few seconds after the subagent's card says it ended: for that moment the main agent and all its subagents read as ended, and everything that says "the job is over" (the main agent's row, its status word, its "Publish & Open PR" button) appeared and went away again between the main agent's turns.

#### Business logic

A subagent holds its main agent's job at a given moment when any of these is true: its status is `running`; its card is marked saving (it ended clean and the tool that runs it is still saving its record); or its card has an end time less than 10 seconds before that moment, whatever status it ended with. A subagent that only waits on a question, with no recent end, does not hold it. While at least one subagent holds the job, the "Recent agents" list shows a main agent that is `done` as running (`components/AgentHistory.tsx`), and the main agent's page counts the holding subagents for its status word and its composer's note, offers no next step, and does not show the main agent's last clean end as the end (`components/AgentView.tsx`).

### A list as a tree

#### Context

**Problem**: the "Recent agents" list is given a flat list, newest first, and on the Overview that list pools every project's agents, where two projects can each hold an agent with the same id.

#### Business logic

Each row of the list is an agent [1] with a key that ends in the agent's id [3]: the id alone in a project's own list, `<project id>:<agent id>` in a pooled one. A row's main agent is the row whose key is the row's own key with the parent's id in place of the agent's id, so in a pooled list it is looked for among the rows of the same project.

- A row whose main agent is in the list, and whose main agent has no main agent of its own in the list, sits under that main agent. Under one main agent the subagents [2] are sorted by id, oldest first, whatever the list's order.
- Every other row is a row of the tree's first level, in the list's order: an agent with no parent, an agent whose parent is not in the list, and an agent whose main agent itself sits under another row. So the tree is one level deep and no row is lost.

### A subagent's end among the prompts

#### Context

**Problem**: the ended line [4] reaches the main agent as a prompt, the same way a message of the user's does, so the transcript cannot tell the two apart by kind. Recognising it by its words alone would turn a message of the user's that quotes those words into a subagent's row.

#### Business logic

A prompt is a subagent's end when both hold:

- its first line, with surrounding whitespace removed, is exactly `The run <id>, started for this run, ended <status>`, optionally followed by `: <reason>`, optionally followed by a final period, where `<id>` holds no whitespace and `<status>` is one word; a prompt with any words before that reads as the user's;
- `<id>` is the id [3] of one of the subagents [2] the caller gives, the agent's own.

The answer is then that subagent, the status, the reason when the line gives one (without the final period), and the rest of the message: every line after the first, with surrounding whitespace removed. Any other prompt, including the same words about an agent that is not one of these subagents, is no subagent's end.

### When a subagent started

#### Context

**Problem**: a subagent's [2] card carries a start time, but that time moves. The first card, written when the main agent starts the subagent, carries the moment the subagent's id [3] was made; once the subagent's own process writes the card in its checkout, the card carries the moment that process started, a few seconds later. A row placed in the transcript by the card's start time would move down past whatever the main agent wrote in between.

#### Business logic

A subagent started at the moment its id was made from: an id is a start time with its `:` and `.` written as `-`, and is read back as that time. An id that is not such a time falls back to the start time on the card. The transcript places a subagent's row by this moment and shows it as the row's time (`components/EventList.tsx`), and a subagent's line measures how long the subagent took from it (`components/SubagentLine.tsx`).

### Where a subagent's row goes

#### Context

**Problem**: the transcript is a list of events [5], and a subagent's start is not one of them: the main agent's diary only holds the command that started it.

#### Business logic

For each subagent [2], the place of its row is the position of the first event whose time is later than the moment the subagent started (see "When a subagent started"): the row goes before that event. An event with no time is passed over. When no event is later, the place is the end of the list. Subagents with the same place keep the order they were given in.
