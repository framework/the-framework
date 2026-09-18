Every read of a project's agents [1]. The Framework runs no agent and writes no agent's record: the tool that runs an agent keeps the agent's card and diary [2] in the agent's checkout [3] while it works, and the `logs` skill's copy of both on the `agent-data` branch [4] is the one place a finished agent lives. This directory reads both places, maps the skill's shapes onto what the dashboard draws, and owns the rule that resolves an agent id [5] to the checkout and the diary it addresses.

## Context

**User story**: the user watches an agent live, restarts the daemon or reopens the dashboard and finds the same agent, answers a waiting agent's question and sees it go on as one row, and sees every agent of a project — including those other machines and other people recorded — once in the history.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[2] card / diary: an agent's record in the `logs` skill's two shapes: the card `<id>.json` (what was asked, the branch, the pull request, how it ended, what it cost) and the diary `<id>.jsonl` (what the agent said, one line per event). While the agent has a checkout they sit under the checkout's `.the-framework/`, written by the tool that runs it; a finished agent's are on the `agent-data` branch.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, in a directory named `agent-<agent id>`. The user's own working copy is "the project's checkout".
[4] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the recorded agents.
[5] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its card and diary.

## Business logic — TL;DR

- **An agent's record, in two places** - while an agent has a checkout [3] its card and diary [2] are there; once it is recorded they are on the `agent-data` branch [4]; every list joins both, the checkout's copy winning.
- **The reads** (`agent-store.ts`) - the recorded agents, the agent in a checkout, every agent with a checkout, all agents and one by id, one agent's events for replay, where a recorded agent's files are, and whether a process is alive. Nothing is ever written or repaired.
- **The two shapes, mapped** (`run-record.ts`) - a card [2] becomes the dashboard's record of an agent [1], and each diary line the event the dashboard draws.
- **Addressing an agent's checkout and diary** (`agent-checkout.ts`) - an agent id [5] resolves to the checkout whose card names it, else the checkout directory named for it, else the project root; a tail follows the diary in the checkout, then the recorded one, and waits where the diary will appear for an agent started a moment ago.
- **The entry point** (`index.ts`) - what the rest of the product imports from this directory; no logic of its own.
- **What the tests prove** (`agent-store.test.ts`, `run-record.test.ts`, `agent-checkout.test.ts`) - every rule above, pinned against an in-memory file system or a throwaway project directory.

## Business logic

### An agent's record, in two places

#### Context

See `## Context`.

#### Business logic

While an agent [1] works, the tool that runs it writes the agent's card and diary [2] under the `.the-framework/` of the agent's checkout [3]. When the agent ends, that tool records both on the `agent-data` branch [4] through the `logs` skill and reclaims the checkout, unless the agent ended waiting on a question, in which case the checkout is kept for the answer. The Framework takes no part in either write. Its reads join the two places: an agent found in both is shown once, as its checkout says, because an agent the user continued is working again while its first leg is already recorded.
