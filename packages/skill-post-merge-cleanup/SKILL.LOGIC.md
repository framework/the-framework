The `post-merge-cleanup` command skill: a skill file the coding agent's harness expands from `/post-merge-cleanup`, the prompt of the agent that cleans up after merged work: it puts a maintainability refactor and a security audit of the changes that need one on the agent queue, and brings the project's knowledge files up to date in a pull request a person reviews. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a person types `/post-merge-cleanup` and, after it, the numbers of the merged pull requests to clean up after; or a project's schedule fires it once a day with nothing after it, for every pull request merged since its last run. For each pull request whose changes need one, the agent puts a maintainability refactor, a security audit, or both on the agent queue, and agents that work the queue do them later. It writes what the merged work decided and taught into the knowledge files, `knowledge-base/DECISIONS.md`, `FACTS.md` and `INSIGHTS.md`, and opens a pull request with them; a person reviews it and merges it.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, which an agent nobody answers cannot infer from the skills alone.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **The work** - what follows the slash command, one or more pull request numbers. When nothing follows it: every pull request merged since the start of the last run of this same command that ended done, as the project's record of agent runs shows; every pull request merged in the last 24 hours when there is no such record or no such run.
- **Pull requests unreadable** - it shows an error to the user saying why and stops.
- **Skipped pull requests** - a pull request that is itself a maintainability refactor, a security audit, or only an update of the knowledge files gets no cleanup, so the cleanup never starts the same work again.
- **Two kinds of entry** - a maintainability refactor of the changes a pull request introduced, when they are not trivial and have refactor potential; an exhaustive security audit of them, when they can potentially lead to security issues. Each entry at a low priority, naming the pull request by its number and title and saying the whole job in words, since the agent that works it reads only the entry.
- **Already queued** - an entry whose work is already on the queue is skipped; a write to the queue rejected because someone else wrote first is tried once more after reading again.
- **No AI queue** - it shows an error to the user saying the queue work was skipped, queues nothing, and still updates the knowledge files; in capability words, naming no skill.
- **Knowledge files** - `knowledge-base/DECISIONS.md` (decisions taken and why), `knowledge-base/FACTS.md` (non-obvious facts), `knowledge-base/INSIGHTS.md` (insights), each created when missing; only what a future agent would need and cannot get from the code, and nothing already there.
- **Publishing** - the change committed on the agent's branch, the branch pushed and its pull request opened, its body naming the pull requests it covers; the merge is left to a person. Nothing worth writing: nothing published.
- **Last message** - each pull request covered and what was queued for it; when no pull request was merged, it says so and stops.
