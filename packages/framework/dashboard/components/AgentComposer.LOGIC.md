The composer [1] at the bottom of an agent's [2] page, one editor for the agent's whole life: while the agent runs, a send is a live chat [3] message the agent reads between turns; once the agent has ended with a known driver session [4] id, a send continues the same agent by resuming that driver session; once it has ended without one, a send starts a new agent with the text. The empty box's submit slot holds the agent's control, Stop while it runs and Resume once it was stopped, and typing swaps the send arrow back in.

## Context

**User story**: the user types the next thing to an agent without caring whether it is still running, has settled, or has stopped: the box stays where it is with the half-typed text in it, and one line above it says what a send will do from here.

**Problem**: three different sends look the same to the user. A running agent takes a message through its control file [5], which the agent drains between turns, so the send is invisible until then. A finished agent has no process left to message; what it has is a driver session that the driver can resume, provided the agent reported its session id before it ended.

## Glossary

[1] composer: the prompt editor, also used for live chat.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] live chat: the user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[4] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[5] control file: `.the-framework/control.jsonl`: the file the daemon appends steering to (stops, picks, chat messages) and the agent's process tails.
[6] prompt agent: an agent that runs one prompt and stops there (as opposed to a build agent, which works the agent queue after its opening exchange).
[7] driver: a coding agent wrapped as a black box. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[8] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[9] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[10] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **What a send does** - a message to a running agent; a continuation of an ended agent that has a session id, on the driver it ran under; a brand-new agent when there is nothing to resume; and a preset marked to open its own agent always starts one.
- **The line above the box** - "Queued — …" after a message to a running agent, or, for an ended agent, whether the next message resumes it after a failure, resumes it after a stop, or continues it; an agent that cannot be continued says so in the box's own placeholder instead.
- **The submit slot** - Stop while the agent runs, Resume once it was stopped with a session id, nothing after any other ending; typing brings back the send arrow.
- **Failures** - a refused send, start, continuation or stop is said in one red line above the box, and the typed text is kept.

## Business logic

### What a send does

#### Context

See `## Context`.

#### Business logic

A send is ignored while another send or start is in flight. Otherwise, by the agent's [2] state:

- A preset the composer [1] flags as opening its own agent (a "new agent" preset, the rule in `Composer.tsx`) always starts a new prompt agent [6] with the text: no resume seed and no link to this agent, so it gets its own checkout [10], branch and driver session [4]. On success the box is cleared and the page jumps to the agent just started.
- While the agent runs: the text is sent as a live chat [3] message to the agent by its id (or, when no id is known, into the project's own control file [5]). On success the box is cleared and the message is remembered as queued (next section). The send button reads "Send", and "Sending…" while in flight.
- Once the agent has ended and its driver session id is known: the text starts a continuation, a prompt agent that resumes that driver session and is written into this same agent, so it stays one row on one branch rather than opening a new one. It resumes on the driver [7] the agent ran under, never on the preferences' driver: an agent that ran under Codex resumes on Codex; Claude is the default and needs no choice. No model and no system-prompt options are sent, because the resumed conversation keeps the ones it had, and the composer offers no driver or model selector here for the same reason. The button reads "Resuming…" while in flight. On success the box is cleared and the page jumps to the agent.
- Once the agent has ended without a session id: nothing can resume it, so the text starts a new prompt agent, with "Starting…" while in flight; on success the box is cleared and the page jumps to the new agent.

The options gear with the "Resume options" is offered only once the agent has ended: a running agent has nothing adjustable, so the gear is dropped rather than opened empty. The agent's session name is handed to the composer so a preset launched here targets this agent by default.

### The line above the box

#### Context

**Problem**: a queued message is invisible until the agent [2] drains it between turns, so without a note the send looks like nothing happened. And an agent that crashed must not be described as having "ended".

#### Business logic

- While the agent runs: after a successful send, "Queued — the session reads it between turns: “<the message>”", on one truncated line. The note is hidden while an error is shown, and it is dropped when the agent ends or another agent is selected, since it is about this agent's live session only.
- Once the agent has ended with a session id: "Session failed — your next message resumes it where it stopped." when it ended with an error, "Session stopped — your next message resumes it." when it was stopped [8], and "Agent ended — your next message continues it." when it finished on its own.
- Once the agent has ended without a session id: no note. The box's placeholder says it instead, where the typing happens: "This agent can’t be continued — it ended before reporting a session id. Your next message starts a new one."

The placeholder otherwise reads "Message the agent…  ( / commands · < tags · @ projects · # files )" while the agent runs, and "Message the agent to continue it…  ( / commands · < tags · @ projects · # files )" once it has ended with a session id.

### The submit slot

#### Context

**User story**: the one control the user reaches for on an agent's page, Stop while it works and Resume after a stop [8], sits in the box's submit slot, where the send arrow appears the moment the user types. A stopped agent resumed from here has its whole conversation back and only lacks the reason it stopped, so the resume tells it that "the user pressed Stop" does not mean "the work was done".

#### Business logic

With the box empty:

- While the agent [2] runs: a square "Stop agent" button (hover "Stop agent"). Pressing it sends a stop to the agent by its id (or to the project's control file [5] without one). From the press until the agent is no longer running, the button shows a spinner, its hover reads "Stopping…", and it is disabled, so a landed stop cannot be fired twice. The latch is released the moment the agent stops being live, not only on an agent switch: a resumed agent is the same agent, and it must get a working Stop again. Failure: "Could not stop the agent.".
- Once the agent was stopped and its driver session [4] id is known: a "Resume" button (hover "Resume the agent"). Pressing it starts a continuation as above (same driver session, same agent, same driver [7]) carrying the stock message: "This session was stopped before it finished, not because the work was done. Look at what you had already done, then carry on from there. The session lifecycle still applies: once the work is genuinely finished with nothing left to do, call setReadyForMerge() — without it the finished work is never merged." (its last sentence points at the ready for merge [9] signal). From the press until the resumed agent reads as running, the button shows a spinner, reads "Resuming…" and is disabled, so the slot never flickers between Resume, empty and Stop while the daemon's list catches up. On success the page jumps to the agent. Failure: "Failed to resume the agent.", or the daemon's refusal.
- After any other ending (finished on its own, failed, or stopped without a session id): no control; the slot collapses as it does in the launcher.

Typing anything replaces the control with the send arrow.

### Failures

#### Context

**Problem**: the daemon refuses a second agent on a project whose checkout [10] is busy, and a message can miss an agent that has just ended.

#### Business logic

One red line above the box shows the first of: the message send's error, the start or continuation's error, the stop's error. A message that could not be sent reads "Could not send — the agent may have just ended. Your text is kept, try again.", and the text stays in the box. A start the daemon refused because an agent is already active reads "An agent is already active for this project." (the wording in `lib/use-start-agent.ts`); other refusals read "Failed to continue the agent.", "Failed to resume the agent." or "Failed to start the agent." by what was attempted, or the daemon's own reason. A refused start never navigates away.
