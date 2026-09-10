The backend end-to-end stories: what the user sees between registering a project and reading a finished agent's [1] row, proven against a daemon whose business logic is wired as in production and whose agents are real spawned processes running the complete agent lifecycle offline, with a scripted fake in the coding agent's [2] seat. Every story acts through the same RPCs the dashboard calls and observes through the same reads and the same event stream [3] tail, so what is proven is the product's behavior, not a test double's. The `*.BUG-ANALYSIS.md` files are review bookkeeping and carry no business logic.

## Context

**User story**: the stories are the product's own user stories end to end: register a repository, set preferences, start an agent, watch it, answer it, chat with it, stop it, publish its work, queue a ticket and have an agent work it.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[4] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[5] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[6] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[7] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[8] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[9] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[10] sweep: a background job the daemon runs on its clock.
[11] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[12] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request, the default), `merge` (also merge it).
[13] open question: a gate nobody has answered yet, as the dashboard lists them across projects.
[14] live chat: the user's own messages to a running agent, each continuing the same driver session.
[15] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[16] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[17] reclaim: removing a finished agent's checkout once its work is on the remote.
[18] drain: starting an agent on the agent queue's first open entry.

## Business logic — TL;DR

- **The simulated world** (`harness.ts`, `fake-agent-bin.ts`) - one daemon per story on throwaway state, wired as in production, with real git repositories as projects (each with a bare `origin`, and its tickets and agent queue [4] seeded on the `agent-data` branch [5]), agents spawned as real processes that run the complete lifecycle with the scripted fake driver [6] in the coding agent's seat, and a scripted gate [7] when a story needs an agent parked.
- **Projects and settings** (`story-projects-and-settings.test.ts`) - registering a repository installs and lists it, unknown projects degrade quietly, preferences [8] set in Settings reach the next continued agent, and the usage panel and the Auto PM [9] line show what the daemon reports and fire a sweep [10] on demand.
- **The agent lifecycle** (`story-session-lifecycle.test.ts`) - what the user sees between Start and the archived row: the live event stream in order, the finished row, a publish-nothing agent keeping its checkout [11], the archived replay and the cross-project surfaces, two agents at once each in its own checkout, and a finished agent pushed from the handoff [12] panel.
- **Steering and gates** (`story-steering-and-gates.test.ts`) - answering a parked agent's question from the open questions [13] list, live chat [14] becoming the next turn [15] and surviving into the agent's record, rearming the handoff mid-run, and a stop [16] whose checkout is reclaimed [17] once its work is on the remote, then a delete that removes the row.
- **Tickets and the queue** (`story-tickets-and-queue.test.ts`) - browsing the ticket backlog, queueing a ticket and having a drain [18] claim it so the boards show it in progress, and any other prompt claiming nothing.
