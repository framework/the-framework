The backend end-to-end stories: what the user sees between registering a project and reading a finished agent's [1] row, proven against a daemon whose business logic is wired as in production. Every fixture project's hooks file names a stand-in tool as its start and resume hooks [2], so a Start goes the whole production way — the RPC, the hook, a detached process writing the files the dashboard reads — offline, with a scripted fake in the coding agent's [3] seat. Every story acts through the same RPCs the dashboard calls and observes through the same reads and the same tail of the agent's diary [4].

## Context

**User story**: the stories are the product's own user stories end to end: register a repository, set preferences, start an agent, watch it, answer its question, write to it, stop it, remove its checkout, delete it, and queue a ticket.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[2] start hook / resume hook: the one shell line under `start`, and the one under `resume`, in a project's `.the-framework/hooks.yml`. The daemon runs the `start` line when the user presses Start and the `resume` line to continue an ended agent; each answers the agent's id as JSON on stdout.
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] card / diary: an agent's record in the `logs` skill's two shapes: the card `<id>.json` and the diary `<id>.jsonl`. While the agent has a checkout they sit under the checkout's `.the-framework/`, written by the tool that runs it; a finished agent's are on the `agent-data` branch.
[5] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[6] question: what an agent's turn ended on, asking the user to choose between options; the agent ends `waiting`, its checkout kept, and the answer resumes it.
[7] inbox: `.the-framework/inbox.jsonl` in an agent's checkout: one JSON line per message or answer, which the agent's session takes when a turn ends.
[8] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory.

## Business logic — TL;DR

- **The simulated world** (`harness.ts`, `fake-run-bin.ts`) - one daemon runtime per story on throwaway state, wired as in production, with real git repositories as projects (each with a bare `origin`, its tickets and agent queue seeded on the `agent-data` branch [5], and a hooks file naming the stand-in tool), and agents that are real detached processes writing a real card and diary [4], reading a real inbox [7], recorded through the `logs` skill and reclaimed by the branches rule.
- **Projects and settings** (`story-projects-and-settings.test.ts`) - registering a repository installs and lists it, unknown projects degrade quietly, the picks set in Settings read back, and the usage panel shows what the daemon reports.
- **The agent lifecycle** (`story-session-lifecycle.test.ts`) - what the user sees between Start and the recorded row: the hook handed the prompt and the picks, the live feed up to the end, the finished row, the checkout reclaimed and the branch on the remote, the replay and the cross-project surfaces; two agents at once each in its own checkout [8]; a project without a start hook, and a hook that fails, refusing in words.
- **Steering and questions** (`story-steering-and-gates.test.ts`) - answering a waiting agent's question [6] from the questions hub resumes the same agent; a message to a working agent becomes its next turn, and to an ended one resumes it; a stop ends the agent stopped, its checkout reclaimed, then a delete removes the row; a waiting agent's kept checkout is removed by hand.
- **Tickets and the queue** (`story-tickets-and-queue.test.ts`) - browsing the ticket backlog, and queueing a ticket so the boards show it queued.
