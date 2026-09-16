Everything the daemon runs in the background beside serving the dashboard, wired as seven jobs on the daemon's one clock: the sweeps [1] that reclaim [2] checkouts [3], keep the `.branches/` links current, converge every project's `agent-data` branch [4] with the remote, watch the pull requests The Framework opened (the CI watch [5]), post notifications to Discord, delete the scratch refs of `web` agents [6] and adopt the branches cloud sessions [7] worked on. Each job says how many ticks [8] it waits between turns and re-reads the preference [9] that gates it on every turn, so a switch flipped in the dashboard takes effect without a restart. The one job that starts an agent on its own, the CI watch's fix agent, starts it unattended [10], with the project's own options, and only under the quota boundary [11] measured for the model the agent would run on. What each job does on its turn is its own file's logic: `merged-worktrees.ts`, `ci-watch.ts`, `cloud-scratch-refs.ts`, `cloud-work.ts`, `dashboard/keyed-watcher.ts`; the clock itself is `daemon-tick.ts`.

## Context

**User story**: a pull request The Framework opened is merged once its checks pass, and, when the user switched "Fix red pull requests" on, an agent is put on it when a check goes red, bounded by the account's quota week; a Discord message arrives when something needs the user or when an agent starts or finishes, even with no dashboard open; a finished agent's checkout is reclaimed once its work is on the remote; what other machines and cloud sessions pushed to the `agent-data` branch shows up within a minute. Ctrl-C stops all of it before the agents it runs are stopped.

**Problem**: background work that starts agents can spend the user's subscription on work nobody asked for, or collide with the user's own actions. The one job that starts an agent is therefore gated by a preference and measured against the quota.

## Glossary

[1] sweep: a background job the daemon runs on its clock: the CI watch, the notification watchers, the data sync, the sweep that reclaims checkouts (the daemon's log calls it the "worktree sweep"), the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[2] reclaim: removing a finished agent's checkout once its work is on the remote.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[5] CI watch: the sweep that merges the pull requests The Framework opened once their checks pass, and starts a fix agent when a check goes red.
[6] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[7] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[8] tick: one beat of the daemon's single background clock; each sweep says how many ticks it waits between turns.
[9] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[10] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[11] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[12] the repo file: `the-framework.yml` at a project's root: per-repo defaults that travel with the code.
[13] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[14] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[15] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.

## Business logic — TL;DR

- **Seven jobs on one clock, in a fixed order** - the "worktree sweep" and the branch links every ten minutes, the data sync, the CI watch [5] and the Discord watchers every minute, the cloud scratch sweep hourly, cloud work adoption every ten minutes; all take the start-up tick [8], in an order chosen so the sweep runs before any agent [6] exists.
- **How a daemon-started agent is started** - always unattended [10], with the project's own options (the preferences [9], then the repo file [12] on top, the launcher's own mapping) under whatever the job adds, through the daemon's ordinary start.
- **The quota boundary, measured for the project's model** - the fix agent stands down past the boundary [11] as measured for the model it would run on, and stands down when the quota [13] cannot be read at all.
- **The CI watch's fix agent** - merging is never gated; a fix agent starts only with "Fix red pull requests" switched on and quota headroom, works on the pull request's own branch with a `local` handoff [14], and a stand-down for lack of quota is said once per failing head.
- **The data sync** - every minute, every project's `agent-data` branch is converged with the remote in one pull through the shared branch library, and the project's "data-sync" error is set by the failure or cleared by the success.
- **The Discord watchers** - two watchers, interventions [15] and activity, exist only when a webhook is configured, post only when the preferences allow the category at posting time, seed their baseline on their first poll so nothing old is announced, and are rebuilt whenever a credential is saved from the dashboard.
- **What the daemon can ask of the services** - reload Discord, and quiesce: stop the clock after the turn in flight, then every job, before any agent is stopped.

## Business logic

### Seven jobs on one clock, in a fixed order

#### Context

**Problem**: with one timer per job there is no single place to look when "why is nothing happening" has the answer "a sweep [1] is not running", and the timers drift apart. The order of the start-up turn matters: a reclaim [2] that lands in the middle of the first agent's [6] teardown races it for the same checkout [3].

#### Business logic

The jobs are declared on the daemon's one clock (`daemon-tick.ts`), one tick [8] every 30 seconds, in this order and with these cadences:

- "worktree sweep", every 20 ticks (ten minutes): reclaims the checkouts of finished agents whose work is on the remote (`merged-worktrees.ts`), leaving alone every agent the daemon is still responsible for. First, so its start-up turn lands while the daemon owns no agent at all; the case it exists for is a machine that was off while an agent's push could not land.
- "branch links", every 20 ticks: brings the `.branches/` links, one per checkout named as its branch, up to date in every project; quiet and idempotent. Right after the sweep, so links to checkouts just reclaimed drop in the same turn.
- "data sync", every 2 ticks (one minute): converges every project's `agent-data` branch [4] with the remote (see the data sync rule below); its start-up turn is also what creates the branch's checkout on a fresh clone.
- "CI watch", every 2 ticks: the CI watch [5] (`ci-watch.ts`).
- "Discord watchers", every 2 ticks: one poll of each notification watcher; their first turn seeds the baseline, which must happen at start-up or the whole open backlog would read as new.
- "cloud scratch sweep", every 120 ticks (hourly): deletes the scratch refs a `web` agent's handoff leaves on the remote, once they have sat for about a day and their work is provably on the default branch (`cloud-scratch-refs.ts`). Hourly because the refs must age a day first; its start-up turn starts that clock.
- "cloud work adoption", every 20 ticks: matches each settled `web` agent to the branch its cloud session [7] pushed, records the branch and pull request on the agent's run through the `logs` skill, and opens the pull request the session never did (`cloud-work.ts`).

Every job takes the start-up tick. Each job reads the preference [9] that gates it on every turn, so a switch flipped in the dashboard takes effect at the next turn without a restart.

### How a daemon-started agent is started

#### Context

**Problem**: an agent [6] nobody watches parks forever on its first gate if it is started as an attended one; and an agent the daemon starts must differ from one the user starts only in who asked for it.

#### Business logic

Every agent a job starts goes through the daemon's ordinary start (`daemon-runtime.ts`) as a prompt agent with its prompt verbatim, with options built in three layers: the project's own options as the base, whatever the job adds on top, and unattended [10] forced on last. The project's options are the user's preferences [9] with the project's repo file [12] on top, mapped exactly as the launcher maps them; a layer that cannot be read counts as empty rather than failing the start, since the defaults are what the agent would have used anyway. Unattended is forced rather than read from any setting because it is a property of there being nobody at the keyboard, not a preference.

### The quota boundary, measured for the project's model

#### Context

**User story**: the user's own starts are never refused for quota [13]; work nobody asked for stands down past the share of the week that may be spent by now, adjusted by the spend slider.

**Problem**: a gate that measured a different model than the one about to run would clear a window that is already spent, and the agent [6] would die at its first API call.

#### Business logic

The CI watch's [5] fix agent asks the daemon's one quota source where the account stands against the quota boundary [11] for the model the project's own options resolve to, the same resolution the start itself uses. A quota that cannot be read stands it down ("the quota could not be read, so there is no way to tell what is spare"): quietly burning a subscription on work nobody asked for is worse than skipping a turn. A boundary that is reached stands it down with the window named, its percentage used, the day of the week reached and the line it stopped at, the user's own limit when the slider is moved. The decision's wording is in `quota-boundary.ts`.

### The CI watch's fix agent

#### Context

**User story**: a pull request The Framework opened goes red; an agent [6] appears on it, pushes a fix onto the pull request's own branch, and the checks go green.

#### Business logic

The CI watch [5] walks every registered project every minute (`ci-watch.ts`). Its merge half is never gated here: it finishes a merge the agent was already armed and authorized for. Its fix half starts agents on its own, so it takes consent first: the "Fix red pull requests" preference [9], read at every attempt, and headroom under the quota boundary [11] for the project's model, resolved before the quota [13] is read. With the preference off, nothing is started and nothing is said. When there is no headroom, the stand-down is logged once per failing head as "[framework] CI watch: not starting a fix for PR #<number> — <reason>", and said again only for a new head, since a line every tick [8] would drown the log for as long as the pull request stayed red while saying nothing is what makes the stand-down invisible; the "said" set is in memory, so a restart says it once more. The fix agent is started unattended [10] with the fix prompt from `ci-watch.ts` and a `local` handoff [14]: it lands its fix on the red pull request's own branch, so it must push or open nothing of its own.

### The data sync

#### Context

**User story**: tickets, queue entries and runs pushed by other machines and by cloud sessions [7] show up in the dashboard within a minute, and a remote the daemon cannot converge with is shown as a project error until it is fixed.

#### Business logic

Every minute, for every registered project in turn, the daemon converges the project's `agent-data` branch [4] with the remote in one pull through the shared branch library (`agent-data`'s), which creates the branch's checkout when there is none. Anything a failed cycle left local is carried out. The daemon knows nothing of what is on the branch: the `tickets` link at a project's root and the queue file's seed are each skill's own setup, no longer the daemon's. A success clears the project's "data-sync" error unconditionally, so the error lives exactly as long as the condition and is gone at the next tick after the user fixes the remote; a failure logs "[framework] data sync: <error>" and sets that error for the dashboard to show.

### The Discord watchers

#### Context

**User story**: with no dashboard open, the user gets a Discord message when something needs them (an open question, a pull request to review, unpushed commits) or when an agent [6] starts or finishes; pasting a webhook into Settings makes this work at once, and unticking a category silences it without a restart.

#### Business logic

Everything that needs the Discord credential is one group, started and stopped together. The credential is the webhook resolved as in `discord-credentials.ts`: the daemon's environment wins over the value saved from the dashboard. Without a webhook the group is empty and nothing is posted. With one, two watchers run on the daemon's clock every minute over every registered project: one over interventions [15], one over activity. Each is gated twice: the webhook says where to post, and the preferences [9] say whether, checked at posting time for the category (interventions or activity) and the Discord channel, so the switch takes effect without a restart. A watcher keeps observing while its category is off, so switching it on announces from now rather than the whole open backlog; its first poll seeds its baseline, per project, so whatever already existed at start-up is never announced. A batch that could not be posted is logged as "[framework] could not post a needs-you batch to the Discord webhook" or "[framework] could not post an activity batch to the Discord webhook". The watching itself (what is an item, per-project baselines) is `dashboard/keyed-watcher.ts`.

The group is rebuilt against the credentials as they are now whenever a credential is saved from the dashboard, and comes up through that same path at boot, so the daemon's start never blocks on a registry read; until it lands there is simply no Discord, which is what a daemon with no credential stays in anyway. Rebuilds are chained one after another, so two saves landing together cannot interleave a start with a stop; a rebuild after the services were quiesced does nothing; a failed rebuild is logged as "[framework] could not reload the Discord services: <error>".

### What the daemon can ask of the services

#### Context

**User story**: the user pastes a Discord webhook and the bot connects without a restart; Ctrl-C stops every background job before the agents [6].

#### Business logic

- Reload Discord: the rebuild described above.
- Quiesce, the first phase of the daemon's shutdown: the clock is stopped and its turn in flight waited out, so the sweeps [1] are off the repository before any agent is stopped, since these jobs commit and push and stopping their clock does not stop their turn; then the Discord group, the CI watch [5], the reclaim [2] sweep, the branch links, the cloud scratch sweep and cloud work adoption are stopped, the agent-starting one with the rest, so nothing can start or steer an agent while the daemon stops the ones it owns.
