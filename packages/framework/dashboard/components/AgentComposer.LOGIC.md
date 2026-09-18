The box at the bottom of an agent view [1]: where the user says something to that agent [2], whether it is working or has ended, and where they stop it or resume it. A send is always the same thing — the user's words, the next prompt of the same conversation — and what becomes of them is the daemon's side: an agent that is working takes them when its turn ends, an ended agent is resumed with them through the project's resume hook [3].

## Context

**User story**: the user watches an agent work and types "also add a logout button": the agent does that next. Later the agent has ended; the user types "one more thing" into the same box, and the same agent — same row, same branch, same conversation — goes on. With the box empty, the button in its corner stops the agent while it works and resumes it once it was stopped.

**Problem**: the daemon runs no agent itself, so it can refuse: a project with no resume hook cannot continue an ended agent. The box must show that refusal in the daemon's words, keep the text the user typed, and never report a message as delivered that was not.

## Glossary

[1] agent view: one agent's page.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] resume hook: the one shell line under `resume:` in the project's `.the-framework/hooks.yml`. The daemon runs it with the agent's id and the user's text or answer in its environment, and the line continues that agent.
[4] inbox: the file in a working agent's checkout where what the user says waits; the agent takes it when its turn ends, as its next prompt.
[5] waiting: how an agent that ended on a question reads: not working, its checkout kept, resumed by the answer or by the user's next message.

## Business logic — TL;DR

- **One send, working or ended** - the text goes to the daemon addressed at this agent; while the agent works the box says the message is queued, and when the agent had ended the shell is told to follow the same agent as it goes on.
- **A refusal** - the daemon's reason is shown as an alert, the text stays in the box, and nothing is reported as queued or resumed.
- **The slot: Stop, Resume, or send** - the empty box's corner holds "Stop agent" while the agent works and "Resume" once it was stopped; typing swaps in the send arrow.
- **The line above the box** - what a send will do from here: queued, continues, resumes, or answer the question above.
- **What the box leaves out** - no coding agent and model select and no "Run on": an agent cannot change either.

## Business logic

### One send, working or ended

#### Context

See `## Context`.

#### Business logic

The editor and its controls are the shared composer (`Composer.tsx`); this box owns what a submit does. The submit button reads "Send"; while a send is in flight its busy label is "Sending…" for a working agent and "Resuming…" for an ended one. A second send while one is in flight does nothing.

A send hands the daemon the project, the text and this agent's id. It is the same call whatever the agent's state: while the agent works, the daemon puts the text in the agent's inbox [4]; once it has ended — done, stopped, failed or waiting [5] — the daemon resumes it through the project's resume hook [3].

When the send went through, the box is emptied and focused again. For a working agent it then shows, as a status, "Queued — the session reads it when its turn ends: "`<text>`"", because a line in the inbox is invisible until the agent takes it. The note goes when the user opens another agent or when this agent ends. For an agent that had ended, the box instead tells the shell that this same agent was continued with that text, so the shell keeps its page and its feed as the agent goes on under the same id.

The box does not remount when the agent ends, so a half-typed message survives the ending.

### A refusal

#### Context

See `## Context`.

#### Business logic

When the daemon refuses a send — the project has no resume hook, the resume hook's tool refused, the agent is unknown, the device could not be reached — the box shows the daemon's reason as an alert above the editor. A send that failed without a reason shows "Could not send. Your text is kept, try again.". Either way the text stays in the editor, no "Queued" note appears, and the shell is not told the agent was continued. A refused Resume behaves the same way: the button does not hold its busy state, and the reason is shown. A failed Stop shows "Could not stop the agent." in the same place.

### The slot: Stop, Resume, or send

#### Context

**User story**: the corner of the box is one button with three meanings, like a coding agent's own terminal: stop what is running, resume what was stopped, send what was typed.

#### Business logic

While the box is empty:

- a working agent shows "Stop agent". A press asks the daemon to stop this agent; once that landed the button reads "Stopping…" and stays disabled until the agent reads as ended, so a stop cannot be sent twice. The hold is released when the agent ends or when the user opens another agent, so an agent that is resumed later gets a working Stop again.
- an agent that was stopped shows "Resume" ("Resume the agent"). A press sends a stock message in place of typed text: "This session was stopped before it finished, not because the work was done. Look at what you had already done, then carry on from there." — the resumed agent has its whole conversation back, and the one thing it lacks is why it stopped. After a press that went through, the button stays a busy "Resuming…" until the agent reads as working, so the slot never flickers between Resume, nothing and Stop.
- an agent that ended any other way — done, failed, or waiting [5] on its question — shows nothing in the slot.

As soon as the box has text, the slot is the send arrow, in every state.

### The line above the box

#### Context

**Problem**: the same box does different things depending on the agent's state, and the user should not have to guess which.

#### Business logic

While the agent works the line is absent, except for the "Queued" status after a send. Once the agent has ended the line says what the next message will do:

- waiting [5]: "The agent asked a question — answer it above, or your next message continues the session."
- failed: "Session failed — your next message resumes it where it stopped."
- stopped: "Session stopped — your next message resumes it."
- otherwise: "Agent ended — your next message continues it."

The "Queued" status is hidden while an error is shown, so the box never says "queued" next to a refusal. The editor's placeholder reads "Message the agent…" while the agent works and "Message the agent to continue it…" once it has ended.

### What the box leaves out

#### Context

**Problem**: an agent is bound to the coding agent it started on and runs where it was started.

#### Business logic

The box shows no coding agent and model select and no "Run on" pick. The Commands button, the `/` list and the `@` and `#` mentions work as at the launcher: inside an agent a command is a message like any other.
