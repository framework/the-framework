Everything the daemon runs in the background beside serving the dashboard, wired as four jobs on the daemon's one clock: the sweeps [1] that converge every project's `agent-data` branch [2] with the remote, post notifications to Discord, delete the scratch refs of `web` agents and adopt the branches cloud sessions [3] worked on. Each job says how many ticks [5] it waits between turns and re-reads the preference [6] that gates it on every turn, so a switch flipped in the dashboard takes effect without a restart. None of the jobs starts an agent [4]. What each job does on its turn is its own module's.

## Context

**User story**: a Discord message arrives when something needs the user or when an agent [4] starts or finishes, even with no dashboard open; what other machines and cloud sessions pushed to the `agent-data` branch shows up within a minute. Ctrl-C stops all of it.

**Business logic story**: the daemon runs no agent, so nothing here starts one, reclaims an agent's checkout or watches an agent's pull request: an agent publishes its own work, and the tool that runs it reclaims its checkout.

## Glossary

[1] sweep: a background job the daemon runs on its clock: the data sync, the notification watchers, the cloud scratch sweep, cloud work adoption. None of them starts an agent.
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[3] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[4] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[5] tick: one beat of the daemon's single background clock; each sweep says how many ticks it waits between turns.
[6] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[7] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.

## Business logic — TL;DR

- **Four jobs on one clock** - the data sync and the Discord watchers every minute, the cloud scratch sweep hourly, cloud work adoption every ten minutes; all take the start-up tick [5].
- **The data sync** - every minute, every project's `agent-data` branch is converged with the remote in one pull through the shared branch library, and the project's "data-sync" error is set by the failure or cleared by the success; on the same turn the project's providers are checked, and its "provider" error set with one line per kind of data whose provider is unsettled (two packages declare it and the project's `package.json` names none, or names one that does not), or cleared.
- **The Discord watchers** - two watchers, interventions [7] and activity, exist only when a webhook is configured, post only when the preferences allow the category at posting time, seed their baseline on their first poll so nothing old is announced, and are rebuilt whenever a credential is saved from the dashboard.
- **What the daemon can ask of the services** - reload Discord, and quiesce: stop the clock after the turn in flight, then every job.

## Business logic

### Four jobs on one clock

#### Context

**Problem**: with one timer per job there is no single place to look when "why is nothing happening" has the answer "a sweep [1] is not running", and the timers drift apart.

#### Business logic

The jobs are declared on the daemon's one clock (`daemon-tick.ts`), one tick [5] every 30 seconds, in this order and with these cadences:

- "data sync", every 2 ticks (one minute): converges every project's `agent-data` branch [2] with the remote (see the data sync rule below); its start-up turn is also what creates the branch's checkout on a fresh clone.
- "Discord watchers", every 2 ticks: one poll of each notification watcher; their first turn seeds the baseline, which must happen at start-up or the whole open backlog would read as new.
- "cloud scratch sweep", every 120 ticks (hourly): deletes the scratch refs a `web` agent left on the remote when it handed its task to a cloud session, once they have sat for about a day and their work is provably on the default branch (`cloud-scratch-refs.ts`). Hourly because the refs must age a day first; its start-up turn starts that clock.
- "cloud work adoption", every 20 ticks (ten minutes): matches each settled `web` agent to the branch its cloud session [3] pushed, records the branch and pull request on the agent's run through the `logs` skill, and opens the pull request the session never did (`cloud-work.ts`).

Every job takes the start-up tick. Each job reads the preference [6] that gates it on every turn, so a switch flipped in the dashboard takes effect at the next turn without a restart.

### The data sync

#### Context

**User story**: tickets, queue entries and runs pushed by other machines and by cloud sessions [3] show up in the dashboard within a minute, and a remote the daemon cannot converge with is shown as a project error until it is fixed.

#### Business logic

Every minute, for every registered project in turn, the daemon converges the project's `agent-data` branch [2] with the remote in one pull through the shared branch library (`agent-data`'s), which creates the branch's checkout when there is none. Anything a failed cycle left local is carried out. The daemon knows nothing of what is on the branch: the `tickets` link at a project's root and the queue file's seed are each skill's own setup, no longer the daemon's. A success clears the project's "data-sync" error unconditionally, so the error lives exactly as long as the condition and is gone at the next tick after the user fixes the remote; a failure logs "[framework] data sync: <error>" and sets that error for the dashboard to show. On the same turn the project's providers are checked (`store/provided.ts`): for each kind of data The Framework reads through a provider, the shared library says whether the provider is unsettled; the project's "provider" error is set with one line per unsettled kind, in the library's words, or cleared when every kind is settled.

### The Discord watchers

#### Context

**User story**: with no dashboard open, the user gets a Discord message when something needs them (an open question, a pull request to review, unpushed commits) or when an agent [4] starts or finishes; pasting a webhook into Settings makes this work at once, and unticking a category silences it without a restart.

#### Business logic

Everything that needs the Discord credential is one group, started and stopped together. The credential is the webhook resolved as in `discord-credentials.ts`: the daemon's environment wins over the value saved from the dashboard. Without a webhook the group is empty and nothing is posted. With one, two watchers run on the daemon's clock every minute over every registered project: one over interventions [7], one over activity. Each is gated twice: the webhook says where to post, and the preferences [6] say whether, checked at posting time for the category (interventions or activity) and the Discord channel, so the switch takes effect without a restart. A watcher keeps observing while its category is off, so switching it on announces from now rather than the whole open backlog; its first poll seeds its baseline, per project, so whatever already existed at start-up is never announced. A batch that could not be posted is logged as "[framework] could not post a needs-you batch to the Discord webhook" or "[framework] could not post an activity batch to the Discord webhook". The watching itself (what is an item, per-project baselines) is `dashboard/keyed-watcher.ts`.

The group is rebuilt against the credentials as they are now whenever a credential is saved from the dashboard, and comes up through that same path at boot, so the daemon's start never blocks on a registry read; until it lands there is simply no Discord, which is what a daemon with no credential stays in anyway. Rebuilds are chained one after another, so two saves landing together cannot interleave a start with a stop; a rebuild after the services were quiesced does nothing; a failed rebuild is logged as "[framework] could not reload the Discord services: <error>".

### What the daemon can ask of the services

#### Context

**User story**: the user pastes a Discord webhook and the bot connects without a restart; Ctrl-C stops every background job.

#### Business logic

- Reload Discord: the rebuild described above.
- Quiesce, the first phase of the daemon's shutdown: the clock is stopped and its turn in flight waited out, since these jobs commit and push and stopping their clock does not stop their turn; then the Discord group, the cloud scratch sweep and cloud work adoption are stopped.
