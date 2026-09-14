The `work-queue` routine skill: the prompt of the agent the daemon starts on the queued work, as a skill file the coding agent's harness expands from `/work-queue`. Marked so that only a person or the daemon invokes it; the agent never chooses it by itself.

## Context

**User story**: the daemon starts an agent with `/work-queue`. The agent reads the skills in its checkout, takes one queued task, works it in its own branch, commits, closes the task's ticket, marks the queue entry done, and stops; the run that started it publishes the branch. An agent that finds nothing queued says so and stops.

**Business logic story**: the skill names no skill and no command. The agent composes the `tickets` and `queue` skills tracked in the project on its own; what this file carries is the rules of the job, which an unattended agent cannot infer from the skills alone.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **One task** - it takes one queued task and no other.
- **Commit, do not push** - it commits on its own branch and leaves publishing to the run that started it.
- **Committed counts as published** - once the work is committed it closes the task's ticket and marks the queue entry done, so a ticket whose skill says "close once published" is closed rather than left open.
- **Release before stopping** - any claim it still holds is released unless it closed the ticket.
- **Nothing queued** - it says so and stops.
- **No ticketing system, no AI queue** - it shows an error to the user and stops; the note is in capability words and names no skill.
