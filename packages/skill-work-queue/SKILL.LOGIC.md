The `work-queue` command skill: the prompt of the agent a runner starts on the queued work, as a skill file the coding agent's harness expands from `/work-queue`. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a runner, the scheduler or a person, starts an agent with `/work-queue`. The agent reads the skills in its checkout, takes one queued task, works it in its own branch, commits, closes the task's ticket, marks the queue entry done, publishes the work as a pull request set to merge on green, and stops. An agent that finds nothing queued says so and stops.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the `tickets` and `queue` skills tracked in the project on its own; what this file carries is the rules of the job, which an unattended agent cannot infer from the skills alone. Where the job is broken without a capability, the skill says so in capability words and stops.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **One task** - it takes one queued task and no other.
- **Commit, then close and publish** - it commits on its own branch; once the work is committed it closes the task's ticket, marks the queue entry done, and publishes the work: its branch pushed and a pull request opened, set to merge on its own once its checks pass. Said in capability words: which command publishes is the branches skill's to say.
- **Release before stopping** - any claim it still holds is released unless it closed the ticket.
- **Nothing queued** - it says so and stops.
- **No ticketing system, no AI queue** - it shows an error to the user and stops; the note is in capability words and names no skill.
