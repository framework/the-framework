Everything the daemon runs in the background beside serving the dashboard, wired as eight jobs on the daemon's one clock: the sweeps [1] that reclaim [2] checkouts [3], keep the `.branches/` links current, converge every project's `agent-data` branch [4] with the remote, watch the pull requests The Framework opened (the CI watch [5]), post notifications to Discord, run Auto PM [6], delete the scratch refs of `web` agents [7] and adopt the branches cloud sessions [8] worked on. Each job says how many ticks [9] it waits between turns and re-reads the preference [10] that gates it on every turn, so a switch flipped in the dashboard takes effect without a restart. The two jobs that start agents on their own, Auto PM and the CI watch's fix agent, start them the same way: unattended [11], with the project's own options, and only under the quota boundary [12] measured for the model the agent would run on. Auto PM's claims [13] and routine locks [14] are taken by the daemon before an agent starts and freed by it after. Every write the daemon makes on its own — a run's record, a lock, a claim — is signed with a trailer naming the machine (`daemon-writes.ts`), so the sweep that starts work when the branch moves never reads the daemon's own commits as work. What each job does on its turn is its own file's logic: `merged-worktrees.ts`, `auto-pm.ts`, `ci-watch.ts`, `cloud-scratch-refs.ts`, `cloud-work.ts`, `dashboard/keyed-watcher.ts`; the clock itself is `daemon-tick.ts`.

## Context

**User story**: the user switches "Spend what's left on the roadmap" on; when someone queues work the daemon starts an agent on the agent queue [15] within a minute, and once a run finds nothing queued it refills the queue by triaging and planning tickets, bounded by the account's quota week; a pull request The Framework opened is merged once its checks pass, and an agent is put on it when a check goes red; a Discord message arrives when something needs the user or when an agent starts or finishes, even with no dashboard open; a finished agent's checkout is reclaimed once its work is on the remote; a ticket claimed on this machine is seen as claimed on every machine sharing the repository. Ctrl-C stops all of it before the agents it runs are stopped.

**Problem**: background work that starts agents can spend the user's subscription on work nobody asked for, collide with the user's own actions, or run twice across machines. Every job here is therefore gated by a preference, measured against the quota, and coordinated through files on the `agent-data` branch [4].

## Glossary

[1] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts (the daemon's log calls it the "worktree sweep"), the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[2] reclaim: removing a finished agent's checkout once its work is on the remote.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[5] CI watch: the sweep that merges the pull requests The Framework opened once their checks pass, and starts a fix agent when a check goes red.
[6] Auto PM: the daemon's unattended product management: work the agent queue when the `agent-data` branch moves, and refill it by running the routines.
[7] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[8] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[9] tick: one beat of the daemon's single background clock; each sweep says how many ticks it waits between turns.
[10] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[11] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[12] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[13] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[14] routine lock: a file on the `agent-data` branch (`routines/<name>.lock.md`) a daemon takes before running a routine so the routine runs once across machines.
[15] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[16] the repo file: `the-framework.yml` at a project's root: per-repo defaults that travel with the code.
[17] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[18] routine: a job the daemon fires on its own — the queued work, update tickets, triage quick, triage consensual, plan tickets, maintenance — each switchable off and runnable on demand.
[19] fan-out: starting several agents at once, one per queue entry or one per ticket to plan.
[20] the queued work: the routine that spends existing work: one agent started with `/work-queue` when the `agent-data` branch moved, which takes one task off the agent queue by composing the skills in its checkout.
[21] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[22] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[23] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[24] holder: who a claim names: the agent's id when the daemon started the agent, else the branch the `tickets` command ran on.

## Business logic — TL;DR

- **Eight jobs on one clock, in a fixed order** - the "worktree sweep" and the branch links every ten minutes, the data sync, the CI watch [5], the Discord watchers and Auto PM [6] every minute, the cloud scratch sweep hourly, cloud work adoption every ten minutes; all take the start-up tick [9], in an order chosen so the sweep runs before any agent [7] exists and Auto PM looks at the branch the sync just pulled.
- **How a daemon-started agent is started** - always unattended [11], with the project's own options (the preferences [10], then the repo file [16] on top, the launcher's own mapping) under whatever the job adds, through the daemon's ordinary start.
- **The quota boundary, measured for the project's model** - both self-starting jobs stand down past the boundary [12] as measured for the model their agent would run on, and stand down when the quota [17] cannot be read at all.
- **What Auto PM is told** - its switch and the routines [18] the user unticked (both machine-wide), the head of each project's `agent-data` branch and how many commits since its last look no daemon wrote, the held slots by name, the concurrency cap, the maintenance schedule, the routine list, and the tickets a plan fan-out [19] may take: unplanned, unclaimed, most important first.
- **Claims before a start, freed after** - the daemon writes and pushes a claim [13] for every ticket a plan fan-out is about to start an agent on, under the agent id [21] the agent is then born with, skipping a ticket already planned or claimed; the one claim the daemon frees itself is one whose agent ended with nothing to hand off. The queued work [20] claims nothing: its agent claims for itself.
- **Routine locks** - a routine lock [14] is taken before a routine's agent starts and dropped when that agent ends, and the locks a previous daemon of this machine left behind are freed unless an agent of this machine started since is still running.
- **What a started agent carries** - its prompt verbatim (`/work-queue` for the queued work), the plan-agent mark for a fan-out so its pull request never closes the ticket's issue, and the `merge` handoff [22] when the job says its pull requests may land themselves.
- **Whether a run has ended** - the daemon answers Auto PM from the run's own record: still going, or ended, and how its handoff reported; the daemon touches no queue entry at the run's end, the agent marked its own entry done.
- **The CI watch's fix agent** - merging is never gated; a fix agent starts only with Auto PM switched on and quota headroom, works on the pull request's own branch with a `local` handoff, and a stand-down for lack of quota is said once per failing head.
- **The data sync** - every minute, every project's `agent-data` branch is converged with the remote in one pull through the shared branch library, and the project's "data-sync" error is set by the failure or cleared by the success.
- **The Discord watchers** - two watchers, interventions [23] and activity, exist only when a webhook is configured, post only when the preferences allow the category at posting time, seed their baseline on their first poll so nothing old is announced, and are rebuilt whenever a credential is saved from the dashboard.
- **What the daemon can ask of the services** - wake Auto PM now (plainly, when its preference was just switched on; on demand, from the dashboard's button, even while it is off), read Auto PM's last report, reload Discord, and quiesce: stop the clock after the turn in flight, then every job, before any agent is stopped.

## Business logic

### Eight jobs on one clock, in a fixed order

#### Context

**Problem**: with one timer per job there is no single place to look when "why is nothing happening" has the answer "a sweep [1] is not running", and the timers drift apart. The order of the start-up turn matters: a reclaim [2] that lands in the middle of the first agent's [7] teardown races it for the same checkout [3].

#### Business logic

The jobs are declared on the daemon's one clock (`daemon-tick.ts`), one tick [9] every 30 seconds, in this order and with these cadences:

- "worktree sweep", every 20 ticks (ten minutes): reclaims the checkouts of finished agents whose work is on the remote (`merged-worktrees.ts`), leaving alone every agent the daemon is still responsible for. First, so its start-up turn lands while the daemon owns no agent at all; the case it exists for is a machine that was off while an agent's push could not land.
- "branch links", every 20 ticks: brings the `.branches/` links, one per checkout named as its branch, up to date in every project; quiet and idempotent. Right after the sweep, so links to checkouts just reclaimed drop in the same turn.
- "data sync", every 2 ticks (one minute): converges every project's `agent-data` branch [4] with the remote (see the data sync rule below). Before Auto PM [6], so a look of the same tick sees the head the sync just brought in; its start-up turn is also what creates the branch's checkout on a fresh clone.
- "CI watch", every 2 ticks: the CI watch [5] (`ci-watch.ts`).
- "Discord watchers", every 2 ticks: one poll of each notification watcher; their first turn seeds the baseline, which must happen at start-up or the whole open backlog would read as new.
- "auto PM", every 2 ticks, behind the pull: Auto PM (`auto-pm.ts`). A look costs one git read; a run only ever starts when the branch moved. Its start-up turn matters: it remembers where the branch stands, and takes the rotation's first turn for a daemon started with the switch already on, which would otherwise sit idle with quota [17] going spare.
- "cloud scratch sweep", every 120 ticks (hourly): deletes the scratch refs a `web` agent's handoff leaves on the remote, once they have sat for about a day and their work is provably on the default branch (`cloud-scratch-refs.ts`). Hourly because the refs must age a day first; its start-up turn starts that clock.
- "cloud work adoption", every 20 ticks: matches each settled `web` agent to the branch its cloud session [8] pushed, records the branch and pull request on the agent, and opens the pull request the session never did (`cloud-work.ts`).

Every job takes the start-up tick. Each job reads the preference [10] that gates it on every turn, so a switch flipped in the dashboard takes effect at the next turn without a restart.

### How a daemon-started agent is started

#### Context

**Problem**: an agent [7] nobody watches parks forever on its first gate if it is started as an attended one; and an agent the daemon starts must differ from one the user starts only in who asked for it.

#### Business logic

Every agent a job starts goes through the daemon's ordinary start (`daemon-runtime.ts`) as a prompt agent with its prompt verbatim, with options built in three layers: the project's own options as the base, whatever the job adds on top, and unattended [11] forced on last. The project's options are the user's preferences [10] with the project's repo file [16] on top, mapped exactly as the launcher maps them; a layer that cannot be read counts as empty rather than failing the start, since the defaults are what the agent would have used anyway. Unattended is forced rather than read from any setting because it is a property of there being nobody at the keyboard, not a preference.

### The quota boundary, measured for the project's model

#### Context

**User story**: the user's own starts are never refused for quota [17]; work nobody asked for stands down past the share of the week that may be spent by now, adjusted by the spend slider.

**Problem**: a gate that measured a different model than the one about to run would clear a window that is already spent, and the agent [7] would die at its first API call.

#### Business logic

Both self-starting jobs, Auto PM [6] and the CI watch's [5] fix agent, ask the daemon's one quota source where the account stands against the quota boundary [12] for the model the project's own options resolve to, the same resolution the start itself uses. A quota that cannot be read stands the job down ("the quota could not be read, so there is no way to tell what is spare"): quietly burning a subscription on work nobody asked for is worse than skipping a turn. A boundary that is reached stands it down with the window named, its percentage used, the day of the week reached and the line it stopped at, the user's own limit when the slider is moved. The decision's wording is in `auto-pm.ts`.

### What Auto PM is told

#### Context

**Business logic story**: Auto PM [6] decides per project whether to start the queued work [20], run a routine [18] or fan out [19]; the decision rules are in `auto-pm.ts`. This file supplies what it decides on.

#### Business logic

Auto PM is told: whether it is switched on (the "Spend what's left on the roadmap" preference [10]); which routines the user unticked, kept machine-wide like the switch itself, since the rotation is one schedule for the machine and not one per repository; the local head of each project's `agent-data` branch, and, between two heads, how many commits carry no `Daemon:` trailer (both git reads on the project's repository, the rules in `daemon-writes.ts`); the slots each project holds, each named as "<agent id> (pid <process id>)", "<agent id> (starting)", or "a run in the project checkout" for an agent that got no checkout [3] of its own, so its stand-down and fan-out lines say what they were measured against instead of a bare number; how many agents [7] a routine may keep going per project, from the preferences, machine-wide; whether the maintenance routine is due, read from the project's own schedule file so a daily reboot cannot reset it (`maintenance.ts`), and how to record a sweep; the four scheduled routines in rotation order, update tickets, triage quick, triage consensual, plan tickets, the two triages each holding a routine lock [14] and plan tickets fanning out; and the tickets a plan fan-out may take: every ticket that is unplanned and unclaimed, most important first by its numeric priority, a ticket without one last. No stale-claim sweep runs: a claim stands until the agent's pull request deletes it or the user releases it from the dashboard.

### Claims before a start, freed after

#### Context

**User story**: a ticket a plan agent [7] is working shows as held on every machine that shares the repository, and `tickets show` names the agent holding it.

**Problem**: a plan agent pushes only at the end of its work, onto its own branch, so a claim [13] the agent wrote itself would not reach the machines it exists for. And a claim whose agent ended with nothing to hand off would stand forever, since the pull request that would delete it is never coming. The queued work [20] is different: its agent claims its ticket itself, through the `tickets` skill, as one of the commits that move the branch; the plan fan-out is the one place the daemon still claims, and its own design is a follow-up.

#### Business logic

Before Auto PM [6] starts the agents of a plan fan-out [19], the daemon claims their tickets through the `tickets` skill, as one commit pushed to the `agent-data` branch [4] and signed with the daemon's trailer, each claim naming as holder [24] the agent id [21] the agent is then born with, so the claim and the agent are one. A plan claim skips a ticket that already has a plan or that is already claimed. A ticket already claimed by the same holder counts as claimed. Only the tickets actually claimed are started on. A batch that committed but could not push still counts as claimed, and the gap is logged.

When a plan agent settles with nothing to hand off, the one dead claim the daemon can know is dead, the daemon frees that exact claim, logging "[framework] auto PM: released the lock on <ticket> — its agent ended with nothing to hand off"; a release that cannot be committed is logged as "[framework] auto PM: the release of the lock on <ticket> could not be committed; it will be retried" and tried again.

### Routine locks

#### Context

**Problem**: several machines share a project's `agent-data` branch [4], and a routine [18] such as a triage must run once across all of them.

#### Business logic

Before a routine that holds a lock starts its agent [7], the daemon takes the routine lock [14] (`routine-locks.ts`), a pushed file on the `agent-data` branch, signed with the daemon's trailer; a live lock, anyone's, stands the routine down. When that agent ends, however it ended, the daemon that took the lock removes it, logging "[framework] auto PM: released the <routine> lock — its run ended", or "[framework] auto PM: the release of the <routine> lock could not be committed; it will be retried". On boot, the locks a previous daemon of this same machine left behind are freed, each logged as "[framework] auto PM: released the <routine> lock a previous daemon left behind", unless an agent of this machine started since the lock was taken is still running, which means the lock is that agent's.

### What a started agent carries

#### Context

**Business logic story**: the daemon knows nothing about what an agent is going to do beyond the prompt it starts it with; what it records on the agent is only what the handoff needs.

#### Business logic

An agent started on the queued work [20] carries the prompt `/work-queue` and nothing about which entry or ticket it will take: the agent reads the queue itself. An agent started by a plan fan-out [19] is marked as planning rather than implementing, so a closing phrase in its pull request cannot close an issue whose work is still undone. When the sweep minted a claim [13] for the agent, the agent is started under that claim's agent id [21]. When the job says its pull requests may land themselves, the agent's handoff [22] is `merge`, the top of the ladder: a drain implements work whose review already happened on the queue. The started agent's id is handed back to Auto PM; a start that failed hands back nothing.

### Whether a run has ended

#### Context

**Problem**: Auto PM [6] needs to know when a run it started is over, to release what the daemon took for it and to judge whether the queue wants refilling; and the daemon must not touch the queue at a run's end, since the agent marked its own entry done and the daemon reads no queue.

#### Business logic

For each run it started, Auto PM [6] asks the daemon each look whether the agent has settled, and the daemon answers from the run's own record: an agent that is unknown or still running is not settled and is asked about again next look. A settled agent's answer carries how its handoff [22] ended: a handoff skipped for lack of commits is the one case that frees a plan claim [13] (see above), and a clean end whose handoff has not reported yet is said to be still publishing rather than never going to.

### The CI watch's fix agent

#### Context

**User story**: a pull request The Framework opened goes red; an agent [7] appears on it, pushes a fix onto the pull request's own branch, and the checks go green.

#### Business logic

The CI watch [5] walks every registered project every minute (`ci-watch.ts`). Its merge half is never gated here: it finishes a merge the agent was already armed and authorized for. Its fix half starts agents on its own, so it takes the same consent as the other self-starting work: the Auto PM [6] preference [10], read at every attempt, and headroom under the quota boundary [12] for the project's model, resolved before the quota [17] is read. When there is no headroom, the stand-down is logged once per failing head as "[framework] CI watch: not starting a fix for PR #<number> — <reason>", and said again only for a new head, since a line every tick [9] would drown the log for as long as the pull request stayed red while saying nothing is what makes the stand-down invisible; the "said" set is in memory, so a restart says it once more. The fix agent is started unattended [11] with the fix prompt from `ci-watch.ts` and a `local` handoff [22]: it lands its fix on the red pull request's own branch, so it must push or open nothing of its own.

### The data sync

#### Context

**User story**: tickets, queue entries and runs pushed by other machines and by cloud sessions [8] show up in the dashboard within a minute, and a remote the daemon cannot converge with is shown as a project error until it is fixed.

#### Business logic

Every minute, for every registered project in turn, the daemon converges the project's `agent-data` branch [4] with the remote in one pull through the shared branch library (`agent-data`'s), which creates the branch's checkout when there is none. Anything a failed cycle left local is carried out. The daemon knows nothing of what is on the branch: the `tickets` link at a project's root and the queue file's seed are each skill's own setup, no longer the daemon's. A success clears the project's "data-sync" error unconditionally, so the error lives exactly as long as the condition and is gone at the next tick after the user fixes the remote; a failure logs "[framework] data sync: <error>" and sets that error for the dashboard to show.

### The Discord watchers

#### Context

**User story**: with no dashboard open, the user gets a Discord message when something needs them (an open question, a pull request to review, unpushed commits) or when an agent [7] starts or finishes; pasting a webhook into Settings makes this work at once, and unticking a category silences it without a restart.

#### Business logic

Everything that needs the Discord credential is one group, started and stopped together. The credential is the webhook resolved as in `discord-credentials.ts`: the daemon's environment wins over the value saved from the dashboard. Without a webhook the group is empty and nothing is posted. With one, two watchers run on the daemon's clock every minute over every registered project: one over interventions [23], one over activity. Each is gated twice: the webhook says where to post, and the preferences [10] say whether, checked at posting time for the category (interventions or activity) and the Discord channel, so the switch takes effect without a restart. A watcher keeps observing while its category is off, so switching it on announces from now rather than the whole open backlog; its first poll seeds its baseline, per project, so whatever already existed at start-up is never announced. A batch that could not be posted is logged as "[framework] could not post a needs-you batch to the Discord webhook" or "[framework] could not post an activity batch to the Discord webhook". The watching itself (what is an item, per-project baselines) is `dashboard/keyed-watcher.ts`.

The group is rebuilt against the credentials as they are now whenever a credential is saved from the dashboard, and comes up through that same path at boot, so the daemon's start never blocks on a registry read; until it lands there is simply no Discord, which is what a daemon with no credential stays in anyway. Rebuilds are chained one after another, so two saves landing together cannot interleave a start with a stop; a rebuild after the services were quiesced does nothing; a failed rebuild is logged as "[framework] could not reload the Discord services: <error>".

### What the daemon can ask of the services

#### Context

**User story**: the user ticks "Spend what's left on the roadmap" and something happens now, not up to ten minutes later; the user presses the dashboard's sweep button and reads what the sweep decided; Ctrl-C stops every background job before the agents [7].

#### Business logic

- Wake Auto PM [6]: a plain wake runs the Auto PM turn now; the turn re-reads the preference [10] itself, so a wake that arrives after the switch went the other way records "off" and starts nothing. An on-demand wake, the dashboard's button, runs the turn even while the switch is off, because the click is the ask the preference would otherwise record; it can be narrowed to the queued work [20], a plan fan-out [19], one locked routine [18] or one project. Both resolve when the turn finishes, so the button can await the sweep and show what it decided, and a failed turn resolves silently.
- Auto PM's report: what its last turn decided, for the usage panel.
- Reload Discord: the rebuild described above.
- Quiesce, the first phase of the daemon's shutdown: the clock is stopped and its turn in flight waited out, so the sweeps [1] are off the repository before any agent is stopped, since these jobs commit and push and stopping their clock does not stop their turn; then the Discord group, Auto PM, the CI watch [5], the reclaim [2] sweep, the branch links, the cloud scratch sweep and cloud work adoption are stopped, the agent-starting ones with the rest, so nothing can start or steer an agent while the daemon stops the ones it owns.
