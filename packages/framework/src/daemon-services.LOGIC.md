Everything the daemon runs in the background beside serving the dashboard, wired as three jobs on the daemon's one clock: the sweeps [1] that converge every project's `agent-data` branch [2] with the remote, delete the scratch refs of `web` agents and adopt the branches cloud sessions [3] worked on. Each job says how many ticks [5] it waits between turns. None of the jobs starts an agent [4]. What each job does on its turn is its own module's.

## Context

**User story**: what other machines and cloud sessions pushed to the `agent-data` branch shows up within a minute. Ctrl-C stops all of it.

**Business logic story**: the daemon runs no agent, so nothing here starts one, reclaims an agent's checkout or watches an agent's pull request: an agent publishes its own work, and the tool that runs it reclaims its checkout.

## Glossary

[1] sweep: a background job the daemon runs on its clock: the data sync, the cloud scratch sweep, cloud work adoption. None of them starts an agent.
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[3] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[4] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[5] tick: one beat of the daemon's single background clock; each sweep says how many ticks it waits between turns.

## Business logic — TL;DR

- **Three jobs on one clock** - the data sync every minute, the cloud scratch sweep hourly, cloud work adoption every ten minutes; all take the start-up tick [5].
- **The data sync** - every minute, every project's `agent-data` branch is converged with the remote in one pull through the shared branch library, and the project's "data-sync" error is set by the failure or cleared by the success; on the same turn the project's providers are checked, and its "provider" error set with one line per kind of data whose provider is unsettled (two packages declare it and the project's `package.json` names none, or names one that does not), or cleared.
- **What the daemon can ask of the services** - quiesce: stop the clock after the turn in flight, then every job.

## Business logic

### Three jobs on one clock

#### Context

**Problem**: with one timer per job there is no single place to look when "why is nothing happening" has the answer "a sweep [1] is not running", and the timers drift apart.

#### Business logic

The jobs are declared on the daemon's one clock (`daemon-tick.ts`), one tick [5] every 30 seconds, in this order and with these cadences:

- "data sync", every 2 ticks (one minute): converges every project's `agent-data` branch [2] with the remote (see the data sync rule below); its start-up turn is also what creates the branch's checkout on a fresh clone.
- "cloud scratch sweep", every 120 ticks (hourly): deletes the scratch refs a `web` agent left on the remote when it handed its task to a cloud session, once they have sat for about a day and their work is provably on the default branch (`cloud-scratch-refs.ts`). Hourly because the refs must age a day first; its start-up turn starts that clock.
- "cloud work adoption", every 20 ticks (ten minutes): matches each settled `web` agent to the branch its cloud session [3] pushed, records the branch and pull request on the agent's run through the `logs` skill, and opens the pull request the session never did (`cloud-work.ts`).

Every job takes the start-up tick.

### The data sync

#### Context

**User story**: tickets, queue entries and runs pushed by other machines and by cloud sessions [3] show up in the dashboard within a minute, and a remote the daemon cannot converge with is shown as a project error until it is fixed.

#### Business logic

Every minute, for every registered project in turn, the daemon converges the project's `agent-data` branch [2] with the remote in one pull through the shared branch library (`agent-data`'s), which creates the branch's checkout when there is none. Anything a failed cycle left local is carried out. The daemon knows nothing of what is on the branch: the `tickets` link at a project's root and the queue file's seed are each skill's own setup, no longer the daemon's. A success clears the project's "data-sync" error unconditionally, so the error lives exactly as long as the condition and is gone at the next tick after the user fixes the remote; a failure logs "[framework] data sync: <error>" and sets that error for the dashboard to show. On the same turn the project's providers are checked (`store/provided.ts`): for each kind of data The Framework reads through a provider, the shared library says whether the provider is unsettled; the project's "provider" error is set with one line per unsettled kind, in the library's words, or cleared when every kind is settled.

### What the daemon can ask of the services

#### Context

**User story**: Ctrl-C stops every background job.

#### Business logic

Quiesce, the first phase of the daemon's shutdown: the clock is stopped and its turn in flight waited out, since these jobs commit and push and stopping their clock does not stop their turn; then the cloud scratch sweep and cloud work adoption are stopped.
