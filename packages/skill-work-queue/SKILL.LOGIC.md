The `work-queue` command skill: the prompt of the agent a runner starts on the queued work, as a skill file the coding agent's harness expands from `/work-queue`. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a runner, the scheduler or a person, starts an agent with `/work-queue`. The agent reads the skills in its checkout, takes one queued task, works it in its own branch, commits, marks the queue entry done, publishes the work as a pull request set to merge on green that names the ticket, writes the pull request on the ticket, releases its claim, and stops; the ticket closes when the pull request merges. An agent that finds nothing queued says so and stops.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the `tickets` and `queue` skills tracked in the project on its own; what this file carries is the rules of the job, which an unattended agent cannot infer from the skills alone. Where the job is broken without a capability, the skill says so in capability words and stops.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **One task** - it takes one queued task and no other.
- **Commit, then publish** - it commits on its own branch; once the work is committed it marks the queue entry done and publishes the work: its branch pushed and a pull request opened, set to merge on its own once its checks pass, whose body names the ticket it closes (`Closes tickets/<file>`) and the issue the ticket tracks (`Closes #<number>`) when it has one. Said in capability words: which command publishes is the branches skill's to say.
- **The ticket goes into review, not closed** - the pull request is written on the ticket as its `PR:` line and the claim released; the ticket closes when the pull request merges, never here.
- **A task without a pull request** - a plan to write, for instance, ends when what it writes is committed where it belongs, and any claim still held is released.
- **Nothing queued** - it says so and stops.
- **No ticketing system, no AI queue** - it shows an error to the user and stops; the note is in capability words and names no skill.
