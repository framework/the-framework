Every read of a project's agents [1], and of its agent queue [6]. The Framework runs no agent and writes no agent's record: the tool that runs an agent keeps the agent's card and diary [2] in the agent's checkout [3] while it works, and a finished agent is whatever the project's runs provider [4] answers, when one of its packages provides one; the queue, likewise, is whatever the project's queue provider [7] answers. This directory reads all of it, owns the shape of the card, the diary and a queue entry and maps the card and diary onto what the dashboard draws, and owns the rule that resolves an agent id [5] to the checkout and the diary it addresses.

## Context

**User story**: the user watches an agent live, restarts the daemon or reopens the dashboard and finds the same agent, answers a waiting agent's question and sees it go on as one row, and sees every agent of a project — including those other machines and other people recorded — once in the history.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[2] card / diary: an agent's record in two shapes, whose definition is The Framework's (`runs.ts`): the card `<id>.json` (what was asked, the branch, the pull request, how it ended, what it cost) and the diary `<id>.jsonl` (what the agent said, one line per event). While the agent has a checkout they sit under the checkout's `.the-framework/`, written by the tool that runs it; a finished agent's are what the runs provider [4] answers.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, in a directory named `agent-<agent id>`. The user's own working copy is "the project's checkout".
[4] runs provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's finished agents, in its own package.json under `"framework": { "runs": "<command>" }` (the `logs` skill's package declares its `logs` command).
[5] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its card and diary.
[6] the agent queue: every task agents will work next, in the order they will be taken, kept by a project package (the `queue` skill keeps it as `TODO_AGENTS.md` on the `agent-data` branch, in priority sections).
[7] queue provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's agent queue [6], in its own package.json under `"framework": { "queue": "<command>" }` (the `queue` skill's package declares its `queue` command).

## Business logic — TL;DR

- **An agent's record, in two places** - while an agent has a checkout [3] its card and diary [2] are there; once it is finished the runs provider [4] answers them; every list joins both, the checkout's copy winning; a project with no provider shows only the agents that have a checkout.
- **The runs provider** (`runs.ts`) - which of the project's packages provides, the command line it answers, the shape of the card and the diary, and five seconds of shared reads.
- **The queue provider** (`queue.ts`) - which of the project's packages provides the agent queue [6], the one command line it answers (`--local`, the open entries as strings), and five seconds of shared reads; The Framework never writes the queue.
- **Forgetting after a widget acts** (`provided.ts`) - a package's command having run in a project through the dashboard, both providers forget what they read of it, so the next read sees what the command may have written.
- **The reads** (`agent-store.ts`) - the finished agents, the agent in a checkout, every agent with a checkout, all agents and one by id, one agent's events for replay, a finished agent's diary, and whether a process is alive. Nothing is ever written or repaired here.
- **The two shapes, mapped** (`run-record.ts`) - a card [2] becomes the dashboard's record of an agent [1], and each diary line the event the dashboard draws.
- **Addressing an agent's checkout and diary** (`agent-checkout.ts`) - an agent id [5] resolves to the checkout whose card names it, else the checkout directory named for it, else the project root; a tail follows the diary file in the checkout, then the finished agent's diary from the runs provider, and waits where the diary will appear for an agent started a moment ago.
- **The entry point** (`index.ts`) - what the rest of the product imports from this directory; no logic of its own.
- **What the tests prove** (`agent-store.test.ts`, `run-record.test.ts`, `agent-checkout.test.ts`, `runs.test.ts`, `queue.test.ts`) - every rule above, pinned against an in-memory file system, a throwaway project directory, a provider held in memory (`test-runs.ts`) or a real provider command.

## Business logic

### An agent's record, in two places

#### Context

See `## Context`.

#### Business logic

While an agent [1] works, the tool that runs it writes the agent's card and diary [2] under the `.the-framework/` of the agent's checkout [3]. When the agent ends, that tool records both (with the `logs` skill, it does so on the project's `agent-data` branch) and reclaims the checkout, unless the agent ended waiting on a question, in which case the checkout is kept for the answer. The Framework takes no part in either write. Its reads join the checkout with what the runs provider [4] answers: an agent found in both is shown once, as its checkout says, because an agent the user continued is working again while its first leg is already recorded.
