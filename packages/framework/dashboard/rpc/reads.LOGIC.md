The browser's typed stubs for every read the dashboard makes: one stub per read the daemon answers about a project, an agent [1] or the Claude web bridge [2], each addressed by the read's name over the dashboard's transport (`lib/rpc.ts`) and declared with the daemon's own signature for that read, taken from `src/dashboard-rpc/reads.ts`. A read the daemon renames, or whose arguments or answer change shape, therefore fails the dashboard's type check instead of breaking a page at runtime. The stubs add no rule of their own: what each read answers, and that every read answers its empty shape rather than failing, is the daemon's logic, described beside `src/dashboard-rpc/reads.ts`; only the reads' names and types cross into the dashboard, and none of the daemon's code reaches the browser bundle.

## Glossary

[1] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] the Claude web bridge: The daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge token is the secret the extension presents; the bridge browser is the Chrome for Testing the daemon runs for it.
[3] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] event: Everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[5] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[6] the Overview: The dashboard's cross-project page at `/`.
[7] intervention: Something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[8] open question: A gate nobody has answered yet, as the dashboard lists them across projects.
[9] handoff: What happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[10] cloud session: A Claude Code cloud session on claude.ai, the far end of a `web` agent.
[11] pick: The answer to a gate: the option or options chosen, by the user or automatically.

## Business logic — TL;DR

- **Typed against the daemon** - each stub's arguments and answer are the daemon's own for that read, so a read renamed or re-shaped on the daemon's side is a type error in the dashboard's build, never a call that fails in the browser; the daemon's implementation is imported for its types only and stays out of the bundle.
- **The agent history and one agent** - a project's agents [1] newest first, the ids of ended agents whose checkout [3] is still on disk, where one agent is working (its checkout, branch, uncommitted changes, size and pull request), and one agent's replay: its recorded events [4].
- **Documents and tickets** - the project's surfaced documents, its tickets, one ticket's full text, the agent that wrote a ticket's plan, and when the tickets last caught up with GitHub.
- **Cross-project rollups** - every registered project's tickets, the aggregated agent queue [5], the Overview [6], the recent agents, the Overview's "hot tickets", the interventions [7], the open questions [8], the activity feed, and the dashboard page's totals, agents going right now, projects and queues, each read across every registered project.
- **A checkout's files and changes** - every file of the project's or of one agent's checkout, each changed file's git status, one file's diff or content, and every file the agent changed with its line counts.
- **Git and the handoff** - the project's GitHub URL, the git status (branch, uncommitted changes, linked pull request) of the project or of one agent's checkout, and what an agent's handoff [9] left behind: its branch, commits, changes, pull request and uncommitted work.
- **The project's own instructions** - the text of the project's `SYSTEM.md`, so the prompt preview can show the whole system prompt an agent starts with.
- **The bridge's state** - the question a cloud session [10] is parked on, where the pick [11] the user made stands, what the session has said so far, whether the extension has reached the daemon and how it went, the bridge token, and the bridge browser's state.
