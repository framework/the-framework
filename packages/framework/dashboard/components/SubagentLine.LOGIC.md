How one subagent [2] reads on its main agent's page, on one line: its task, which opens the subagent's own page, then how it stands. And the line above the message box that counts the subagents still working and opens to one such line per subagent.

## Context

**User story**: the user asked one agent for work it split across subagents [2] (the `orchestration` skill). On that agent's page the user reads, per subagent, what it was asked and what it is doing at this moment, or how it ended and how long it took, and opens any of them with a click. Once the subagents' rows have scrolled out of view, a line above the message box still says how many are working.

**Problem**: the main agent's transcript said nothing about its subagents while they worked: the main agent ends its turn after starting them, and its diary holds only the commands that started them.

**Business logic story**: the line is drawn from the subagent's card, which the dashboard reads again with the project's agents every 2 seconds, so it changes in place. The transcript shows it where the subagent was started and where it ended (`EventList.tsx`); the agent view shows the counting line between the feed and the composer and reads what the working subagents are doing (`AgentView.tsx`). What a subagent is called is `lib/subagents.ts`'s rule.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] subagent: an agent [1] started for another agent, its main agent, which split its task across subagents (the `orchestration` skill). The subagent's card names the main agent's id as its parent.
[3] task: what a subagent is called: the first line of what it was asked (`lib/subagents.ts`).

## Business logic — TL;DR

- **A subagent's line** - the task [3], then the status: while the subagent works, a pulsing dot, `running` and what it is doing now; with any other status, the status word and, once it has an end time, how long it took.
- **The line of a subagent's end** - given the end as the main agent was told it, the line says `ended <status>` and the reason, and never changes.
- **Opening a subagent** - a click on the task opens the subagent's own page.
- **The subagents line above the message box** - shown only while at least one subagent is `running`: "Subagents · N of M running"; folded until the user opens it, and then one line per subagent.

## Business logic

### A subagent's line

#### Context

See `## Context`.

#### Business logic

The line holds, left to right:

- the task [3], after a "↳" mark. A long task is cut with an ellipsis, and it is the task that gives way when the line is too narrow: the status and what follows it are never pushed off the line;
- how the subagent stands, read off its card: its status word, colored as every status is (`lib/status-tone.ts`: `running` in the accent color, `done` in the success color, `stopped` in the warning color, `failed` in the danger color), and muted for `waiting`. While the status is `running`, a pulsing dot comes before the word;
- then, muted, cut with an ellipsis when long and never wider than 45% of the line: while the status is `running`, what the subagent is doing now, when the caller knows it (nothing otherwise); with any other status, how long the subagent took, its end time minus the moment it started (the moment its id was made from, `lib/subagents.ts`) in the dashboard's short duration wording ("40s", "2m", "3h", "2d"; the rule in `lib/format-date.ts`), when its card has an end time.

What a working subagent is doing is never shown once its status is no longer `running`, even if the caller still holds an answer for it.

### The line of a subagent's end

#### Context

**User story**: the main agent's transcript has a row at the moment the main agent was told a subagent [2] ended (`EventList.tsx`). That row is history: a subagent that was resumed afterwards and is working again must not turn its earlier end into "running".

#### Business logic

When the line is given an end (the status the main agent was told, and the reason when there was one), it shows the task [3], then `ended <status>` in that status's color with no dot, then the reason when there is one. Nothing on it is read off the subagent's current status: no "doing now" and no duration.

### Opening a subagent

#### Context

See `## Context`.

#### Business logic

The task is a button whose accessible name is "Open the subagent: <task>". A click hands the subagent's id to the caller, which opens that subagent's own page. The rest of the line is not clickable.

### The subagents line above the message box

#### Context

**User story**: the main agent started three subagents an hour ago and the transcript has moved on; the user still sees, right above the message box, that two of them are working, and can open the line to see all three.

#### Business logic

Given an agent's subagents [2] and what each working one is doing now:

- While no subagent's status is `running`, nothing is shown: none at all, all ended, or only subagents that are `waiting`. A waiting subagent does not keep the line.
- Otherwise the line reads "Subagents · N of M running", N being the subagents whose status is `running` and M all of the agent's subagents. It is a toggle (`DisclosureToggle.tsx`), folded until the user opens it; the agent view keeps that choice per main agent, so the line of the next main agent the user opens is folded again (`AgentView.tsx`).
- Opened, it lists every subagent, working or not, in the order given (oldest first), each as a subagent's line as described above, with the same click to open it.

The rows about the subagents in the transcript stay when this line goes.
