The message box on one agent — the same box whether the agent is running or has ended. What a send does changes with the agent's state: it messages the running agent, continues a finished one, or starts a new agent when there is nothing left to continue. Its submit slot doubles as the agent's own control: Stop while it runs, Resume once it was stopped.

## Business logic — TL;DR

- **One box, three sends** - running: the text is queued as live chat for the agent to read between turns; ended and resumable: the text continues the same agent, on the same branch, in the same driver session; ended with nothing to resume: the text starts a new agent.
- **A continuation stays one agent** - continuing writes into the same agent entry and the same branch on the same driver, so one thing the user asked for stays one entry in the list.
- **The empty box is the agent's control** - with nothing typed, the submit slot shows Stop while the agent runs and Resume once it was stopped; typing turns it back into send.
- **Resume says why it is resuming** - the Resume press sends a stock message telling the agent it was stopped before finishing rather than because the work was done, to look at what it already did and carry on, and that it must still signal ready for merge.
- **A queued message is echoed back** - the agent only reads it between turns, so the dashboard repeats it until then rather than looking like nothing happened.
- **The box says what the next send will do** - a line above it, and the placeholder, name the outcome for the current state; a failed send keeps the user's text.
- **A preset that starts a new agent always does** - launching one from here opens its own agent regardless of the current agent's state.

## Business logic

### One box, three sends

#### User story

The user watches an agent, wants to add an instruction while it works, and — once it is done — wants to ask for one more thing without losing the conversation.

#### Business logic

While the agent runs, a send is queued for that agent to pick up between its turns. Once the agent has ended and reported a driver session id, a send starts a continuation of it: a fresh leg seeded with that session id, attributed to the same agent entry and the same branch, and running on the same driver as before. An agent that ended without ever reporting a session id cannot be continued by anything, so a send there starts a new agent carrying the typed text; the box says so in its own placeholder, since the message is about what typing there does. A preset that explicitly starts a new agent always opens its own agent — with its own worktree, branch and transcript — no matter which state the current agent is in.

#### Rationale

A continuation does not re-choose the model or the system-prompt options: the resumed conversation keeps the framing and model it already had, so offering those choices would be meaningless.

### The empty box is the agent's control

#### User story

The user wants to pause a running agent, or pick a stopped one back up, without hunting through a menu.

#### Business logic

With nothing typed, the submit slot holds Stop while the agent is live, and Resume once the agent was stopped and has a session id to resume from. An agent that ended any other way, or with no session id, leaves the slot empty. Typing swaps the slot back to send. A landed Stop reads "Stopping…" and cannot be fired again until the agent actually ends; a landed Resume reads "Resuming…" until the resumed agent reports its first event, so the control never flickers between the two.

### Resume says why it is resuming

#### User story

A resumed agent gets its whole conversation back — the one thing it does not know is why it stopped, and "the user pressed Stop" must not read to it as "the work was done".

#### Business logic

Resume sends a fixed message stating that the agent was stopped before it finished rather than because the work was done, telling it to look at what it had already done and carry on from there, and restating that the lifecycle still applies: once the work is genuinely finished it must signal ready for merge, without which the finished work is never merged. It is otherwise an ordinary continuation — same agent, same branch, same driver session.

### Telling the user what a send did

#### User story

A message to a running agent lands in a queue the agent only drains between turns, so it can look like nothing happened.

#### Business logic

After a successful send to a running agent, the box repeats the text back as queued and says the agent reads it between turns. When the agent has ended, a line above the box names what the next message will do, worded for how the agent ended — failed, stopped, or simply ended — so a crash is never described as "ended". A send that fails is reported in place, and the user's text is kept so they can try again.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
