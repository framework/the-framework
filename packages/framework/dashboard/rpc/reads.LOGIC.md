The browser's typed stubs for every read the dashboard makes: one stub per read the daemon answers about a project, an agent [1] or the Claude web bridge [2], each addressed by the read's name over the dashboard's transport (`lib/rpc.ts`) and declared with the daemon's own signature for that read, taken from `src/dashboard-rpc/reads.ts`. A read the daemon renames, or whose arguments or answer change shape, therefore fails the dashboard's type check instead of breaking a page at runtime. The stubs add no rule of their own: what each read answers, and that every read answers its empty shape rather than failing, is the daemon's logic, described beside `src/dashboard-rpc/reads.ts`; only the reads' names and types cross into the dashboard, and none of the daemon's code reaches the browser bundle.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge token is the secret the extension presents; the bridge browser is the Chrome for Testing the daemon runs for it.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] event: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded.
[5] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[6] the Overview: the dashboard's cross-project page at `/`.
[7] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[8] open question: a question an agent ended on and still waits for, as the dashboard lists them across projects.
[9] next step: what a person can do with an ended agent's work from the dashboard: open a pull request for its branch, or merge the pull request it has.
[10] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[11] pick: the answer to a question: the option or options the user chose.

## Business logic — TL;DR

- **Typed against the daemon** - each stub's arguments and answer are the daemon's own for that read, so a read renamed or re-shaped on the daemon's side is a type error in the dashboard's build, never a call that fails in the browser; the daemon's implementation is imported for its types only and stays out of the bundle.
- **The agent history and one agent** - a project's agents [1] newest first, the ids of ended agents whose checkout [3] is still on disk, where one agent is working (its checkout, branch, uncommitted changes, size and pull request), and one agent's replay: its recorded events [4].
- **Documents** - the project's surfaced documents. (The tickets are the tickets package's widget's reads, through its own command, `widgets.ts`.)
- **Cross-project rollups** - the aggregated agent queue [5], the Overview [6], the recent agents, the interventions [7], the open questions [8], the activity feed, the dashboard page's totals, agents going right now, projects and queues, and every project's scheduler state, each read across every registered project.
- **A checkout's files and changes** - every file of the project's or of one agent's checkout, each changed file's git status, one file's diff or content, and every file the agent changed with its line counts.
- **Git and what an agent left** - the project's page on its git host with the git host's name, the git status (branch, uncommitted changes, linked pull request) of the project or of one agent's checkout, and what an agent left behind, which decides its next step [9]: its branch, commits, changes, pull request and uncommitted work.
- **The bridge's state** - the question a cloud session [10] is parked on, where the pick [11] the user made stands, what the session has said so far, whether the extension has reached the daemon and how it went, the bridge token, and the bridge browser's state.
