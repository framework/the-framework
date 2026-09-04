Everything the daemon runs in the background beside serving the dashboard, wired onto one shared clock: the worktree sweep, the branches view, the data sync, the CI watch, the Discord notification watchers, Auto PM, the cloud scratch-ref sweep and the cloud work adoption — plus the rules every self-starting job obeys before it spends the user's quota.

## User story

The user closes the dashboard and walks away. While nobody is watching, the machine keeps the projects converged, lands the pull requests whose checks went green, puts an agent on the ones that went red, works the agent queue down and refills it from the tickets — all within what the account can afford this week — and tells them on Discord when something needs them.

## Business logic — TL;DR

- **One clock for every background job** - each job declares how many ticks it wants between turns instead of owning its own timer, so there is one place to look when a sweep is not running.
- **What runs, and how often** - a fixed job list with fixed cadences, whose order on the start-up turn is itself part of the behaviour.
- **Every unattended start is marked unattended** - a job's agent can never park on a gate whose answer is not coming, because no human is at the keyboard.
- **A start is measured against the model it would run on** - the quota gate resolves the same options the start would, so a job never clears a window that is already spent for that model.
- **Auto PM's wiring** - which routines may run, how many agents at once, which routine holds its lock while it runs, which tickets may be claimed, who writes the claims, and when a drained queue entry is taken off the queue.
- **The CI watch's fix half asks the same consent as Auto PM** - merging a green pull request is ungated, but starting a fix agent needs the Auto PM preference and quota headroom.
- **Discord notifications, rebuilt on demand** - a token pasted into the dashboard takes effect immediately, and toggling the preference never replays the backlog.
- **Keeping every project's branches converged** - each project's `agent-data` branch and `agents-logs` branch are converged with origin regularly, and a project that cannot converge either of them is recorded as an error for the dashboard to show.
- **A project's agent options** - the user's own settings, with the repo's committed config on top; the same options a hand-started agent gets.
- **Quiescing before shutdown** - everything that could start or steer an agent stops first, and the turn already in flight is waited out.

## Business logic

### One clock for every background job

#### User story

The user asks why nothing is happening. There has to be one answer, not six.

#### Business logic

All background jobs share a single tick. Each declares how many ticks it wants between its turns rather than keeping its own timer, so the cadences stay in exact ratio to each other instead of drifting apart, and there is a single place that reports which job ran and which did not.

### What runs, and how often

#### User story

The user leaves the machine off overnight, or shuts the daemon down while an agent's work was still unpushed. When the daemon comes back, everything that was left half-done is picked up.

#### Business logic

The job list and its cadences:

- **worktree sweep**, every ten minutes — reclaims the checkout of an agent whose work has reached the remote; the branch and the agent's record are kept, so this frees disk rather than discarding work. It is the retry for a push that could not land at teardown.
- **branches view**, every ten minutes — keeps one symlink per checkout under `.branches/`, named after its branch.
- **data sync**, every other tick — converges each project's two branches with origin: first the `agent-data` branch, which the `tickets` skill sets up as well as pulls (its checkout, the queue file, the repository-root link to the tickets), then the `agents-logs` branch. This machine ends up seeing what other machines and cloud sessions pushed, and anything a failed write cycle left local is carried out.
- **CI watch**, every other tick — roughly a minute, which is the latency chosen for noticing a check result.
- **Discord watchers**, every other tick.
- **Auto PM**, every ten minutes.
- **cloud scratch-ref sweep**, hourly — deletes the dead pair of refs a `web` hand-off leaves on the remote. The refs must sit for a day first, so a finer cadence would only spend round-trips asking the same question.
- **cloud work adoption**, every ten minutes — matches a settled `web` agent to the branch its cloud session actually worked on, records that branch and its pull request onto the agent's archive, and opens the draft pull request the session never did.

The order of the list is the order of the start-up turn, which runs before anything else the daemon does. The worktree sweep is first, so its start-up turn lands while the daemon owns no agents at all; behind a slower job it would land in the middle of the first agent and race that agent's teardown for the same checkout. The data sync runs before Auto PM, so a sweep in the same turn reads the queue the sync just brought in.

Several jobs exist mostly for their start-up turn: the worktree sweep's case is a machine that was off while an agent's push could not land; the data sync's start-up turn is what creates both branch checkouts on a freshly cloned repo; the Discord watchers' first turn is the baseline that stops the whole open backlog from reading as new; Auto PM's start-up turn keeps a daemon started with the setting already on from sitting idle for ten minutes with quota going spare; and the cloud scratch sweep's start-up turn is what starts the one-day clock on a leftover ref.

#### Rationale

The cloud scratch-ref deletion is the daemon's job rather than the driver's, because creating a cloud session only signals that it was created, not that its clone finished — a driver deleting its own ref would race the provisioning and could strand the session. The adoption pass is likewise the daemon's by necessity: the cloud session's branch does not exist yet when the agent ends, because the cloud machine is still provisioning.

### Every unattended start is marked unattended

#### User story

Nobody is at the keyboard. An agent that stops to ask a question would wait forever for an answer that is not coming.

#### Business logic

Every agent a background job starts goes through one path, which resolves the project's agent options and then forces the unattended flag on top of them. Unattended is a property of there being no human at the keyboard, not a user preference, so it is never read from the settings — and because all three self-starting jobs go through this one path, none of them can forget either half.

### A start is measured against the model it would run on

#### User story

The user's quota is exhausted for one model but not another. A job that measured the wrong one would start an agent that dies at its first call.

#### Business logic

Before a job starts an agent, the quota boundary is read for exactly the model that start would use — resolved from the same project options the start itself resolves. Both self-starting gates go through this one path, for the same reason both starts go through the unattended path.

### Auto PM's wiring

#### User story

While the user is away, the machine should work the agent queue down and, when it runs dry, refill it by triaging tickets and planning the ones without plans — without touching work someone else already claimed, and without exceeding what the account can afford.

#### Business logic

Auto PM is given everything it needs to decide, and everything it decides is applied here:

- **Consent.** The `autoPm` preference is read on every turn rather than at start-up, so switching it off takes effect at the next turn without a restart. The routines the user unticked are read the same way. Both are global rather than per project — the rotation is one schedule for the machine, not one per repo — as is the cap on how many agents a routine may keep going per project.
- **What the projects look like.** The queue is handed over as its open entries rather than as a bare "empty or not", because a batch of concurrent drains pins one entry each and the decision needs the entries themselves. The agents currently held on a project are handed over as one label per slot — the agent's id with its process id — so a stand-down or fan-out line names what it was measured against instead of printing a bare number.
- **The maintenance sweep's schedule** is a file in the project's checkout rather than in-memory state, because unlike the routine rotation it must survive a daemon restart: a machine rebooted daily would otherwise sweep every morning and never reach its interval.
- **Locking a routine.** A routine that must not run twice at once takes its routine lock on the `agents-logs` branch before its agent starts, and drops it when its run ends, with both outcomes logged — including a release that could not be committed, which stays held for the next turn to retry. On a project's first turn, the routine locks a previous daemon on this machine left behind are released as well, unless one of this machine's own agents started since a given lock was taken is still running.
- **Which tickets may be planned.** Only tickets that have no plan yet and are not claimed by a lock, most important first by priority. Locks are never expired on a timer: a lock stands until the agent holding it lifts it — releasing the ticket once its plan is written, or closing the ticket once its work lands — or a human releases it from the dashboard.
- **Who writes the claims.** The daemon claims the tickets through the `tickets` skill and pushes them, never the agent — an agent only pushes at the end onto its own branch, and a claim that stayed local would not reach the other machines it exists for. The holder each claim names is the id of the agent the sweep is about to start with it. A drain claims what it is about to implement under the same rule, except that it skips only on an existing lock: the plan it also finds is the drain's input, not a rival.
- **Releasing a dead claim.** The one claim the daemon can know is dead is the one whose agent settled with nothing to hand off — the pull request that would have deleted the lock is never coming — so that lock is released, and the outcome is logged either way.
- **Starting the agent.** An agent started for a claimed ticket is started under the very id that ticket's claim names, so the claim and the run are one thing and the Tickets page can name the session holding a ticket. A drain names on its agent record the ticket it is about to implement, taken from its own pinned queue entry (falling back to the first open entry when the job was wired without one); a fanned-out planning agent names its ticket the same way, and is marked as a planning agent so its pull request title does not inherit the issue reference — a plan merging must not close an issue whose work is still undone. A job whose pull requests may land themselves rides to the agent as the top rung of the handoff ladder. Every other routine puts work on the queue rather than taking it off, so it names no ticket.
- **Retiring a drained entry.** The daemon takes the queue entry off itself, as one write to the `agent-data` branch, never as an agent edit promoted off a branch, because the queue has one local writer. It waits for the agent to settle *and* to have actually published — its handoff reported done, or skipped because the pull request was already open from an earlier leg. An agent that published nothing leaves its entry open. A removal that could not be committed is logged and the entry stays held until the next turn retries it.

### The CI watch's fix half asks the same consent as Auto PM

#### User story

A pull request the framework opened goes red overnight. The user wants it fixed automatically — but only under the same permission and the same budget as the rest of the unattended work.

#### Business logic

Merging a watched pull request whose checks passed runs ungated: it finishes a merge the agent was already armed and authorized for. Starting a fix agent is different, because that spends the user's quota on its own initiative, so it takes the same two consents as the rest of the self-starting work: the `autoPm` preference, read per attempt, and quota headroom for the model the fix would run on.

A stand-down for quota is logged once per failing head commit, not once per turn: repeating it every turn would drown the log for as long as the pull request stayed red, while saying nothing at all is what made the behaviour invisible. The record of what was already said lives in memory, so a daemon restart says it once more.

The fix agent's work lands on the red pull request's own branch, so it is started with the bottom rung of the handoff ladder — it must not push or open anything of its own.

### Discord notifications, rebuilt on demand

#### User story

The user pastes a Discord webhook into the dashboard and expects notifications to start now, not after a daemon restart. Later they toggle notifications off and on, and must not be blasted with the entire open backlog.

#### Business logic

The Discord services are managed as one group, because they share the credentials and nothing else does: when a token is saved, this is exactly the set that has to come up, and when one is cleared, exactly the set that has to go. Rebuilding re-reads the credentials as they are now and replaces the running set. Rebuilds are chained rather than run concurrently, so two saves landing together cannot interleave a start with a stop and leave a connection nobody holds. The group comes up through this same path at daemon start-up rather than through a separate copy of it, and until it lands there is simply no Discord — the state a daemon with no credentials stays in anyway.

Two things are watched: the cross-project interventions list ("needs you"), with items carrying a link back to the dashboard, and the activity feed. Each has two gates — the webhook says *where* to post, the per-user preference says *whether*. The preference is checked at post time rather than when the watcher starts, so the dashboard toggle takes effect without a restart; and the watcher keeps observing while notifications are off, so switching them on starts from now instead of posting the whole open backlog. A batch that could not be delivered is logged.

### Keeping every project's branches converged

#### User story

The user works from two machines, and some agents run in the cloud. Tickets, the agent queue and the session history must look the same everywhere.

#### Business logic

Every registered project's `agent-data` branch is converged with origin on a schedule, and then its `agents-logs` branch; a project whose tickets could not be converged is not asked for its logs, since the first failure is already the answer. On success the project's data-sync error is cleared unconditionally, so the error lives exactly as long as the condition does — the turn after the user fixes the remote, it is gone. On failure the reason is recorded against that project for the dashboard to show, and said on the daemon's log as well, so a user watching the daemon rather than the dashboard sees it too.

### A project's agent options

#### User story

An agent the daemon starts by itself and an agent the user starts by hand should differ only in who asked for it.

#### Business logic

A project's agent options are the user's global settings with the repo's committed `the-framework.yml` on top — the same two tiers and the same mapping the dashboard's launcher uses. A tier that cannot be read falls back to empty rather than failing the start, since the defaults are what the agent would have used anyway. These options are also the base a dashboard Resume overlays, because a Resume sends only its seed.

### Waking Auto PM out of turn

#### User story

The user switches Auto PM on, or presses a routine's "Run now" button, and something has to happen straight away rather than up to ten minutes later.

#### Business logic

Auto PM can be swept immediately instead of at its next turn. Switching the preference on triggers such a wake: the sweep re-reads the preference itself, so this only changes *when* it notices — but a ten-minute wait with nothing on screen is what made the toggle read as dead. The dashboard's trigger button triggers an on-demand wake, which runs even while the preference is off, because the click itself is the ask the preference would otherwise record. The wake can be awaited, so the trigger button can report what the sweep decided; the preference-switched-on wake simply does not wait.

What the last sweep decided is kept available for the usage panel to show.

### Quiescing before shutdown

#### User story

The user presses Ctrl-C while a sweep is mid-turn. Nothing may start an agent while the daemon is busy stopping them, and no job may still be committing to a repo the shutdown is about to tear down.

#### Business logic

Quiescing happens before the daemon suspends the agents it owns, and it stops everything that could start or steer an agent — the clock, the Discord services, Auto PM, the CI watch (which can start fix agents), and the sweeps. It resolves only once the turn already in flight has finished, because these jobs commit and push, and stopping their clock does not stop their current turn. Once quiesced, a credential reload does nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
