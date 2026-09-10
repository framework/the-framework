The sweep [1] that reclaims [2] the checkouts [3] of finished agents [4] once their work is on the remote. Every ten minutes and once at start-up, the daemon walks every registered project, offers every retained checkout (one whose agent is not running and which the daemon is not still tearing down) to the one removal rule, and says in its terminal what it removed and what it kept and why. One rule replaces every question about how the agent ended: only what is on the remote may go. The checkout is what goes; the branch and the agent's record and events stay, so every removal is recoverable from the remote with `git worktree add`.

## Context

**User story**: a machine that runs many agents does not accumulate one full checkout per finished agent forever; a push that could not land when an agent ended (offline, no credentials, a rejected non-fast-forward) simply succeeds on a later pass and the checkout goes then; and a checkout never vanishes without a line in the daemon's terminal saying why.

**Problem**: "only remove what has been pushed to the git remote" is the product's rule for anything it removes on its own initiative, and asking "is it pushed yet" is one predicate checkable at any moment, with one failure mode, where asking "how did this end" needed several signals that could disagree.

## Glossary

[1] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts (the daemon's log calls it the "worktree sweep"), the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[2] reclaim: removing a finished agent's checkout once its work is on the remote.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[5] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[6] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[7] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[8] cloud anchor: an empty commit a web agent pushes before its task leaves this machine, unique to the agent: the branch the cloud session later pushes descends from it.

## Business logic — TL;DR

- **Which checkouts are offered** - every checkout on disk whose agent is not running and whose agent id [5] the daemon is not still busy with, whatever the agent's end was; a project that cannot be listed sweeps nothing.
- **A project with no remote keeps everything** - asked once per project; every retained checkout is reported kept with "the repo has no remote; its worktree was kept", and no push is attempted.
- **The one removal rule** - the same removal the dashboard's "Remove" button and teardown use decides: a clean tree on a pushed tip goes, a push is attempted when allowed, and everything else is kept with its reason.
- **Each removal runs under the agent's lock** - so the sweep never pulls a checkout out from under a teardown still archiving it.
- **One turn per beat of the daemon's clock** - no timer of its own: every ten minutes and once at start-up, one pass over the projects, a failing project not stopping the next.
- **Saying what it did** - every removal is announced; a kept checkout is announced once per reason, not every turn.

## Business logic

### Which checkouts are offered

#### Context

**Problem**: "not running" on disk is not "the daemon is finished with it": an agent's record flips to done a beat before its teardown finishes archiving its events and reclaiming its checkout, and a sweep landing in that window would race the teardown for the same directory.

#### Business logic

The sweep lists a project's checkouts [3] (without measuring their size, which a sweep never needs) and offers every one that is retained: its agent [4] is not running, and its agent id [5] is not among the agents the daemon is still responsible for, whether spawning, running, or mid-retirement. There is no pre-filter by outcome: an agent that failed or was stopped [6] is not a reason to keep a checkout whose work is on the remote, and the removal itself refuses when it is not. A live agent's checkout is never touched; a stop is how an agent ends, not pulling the floor out from under it. A project whose checkouts cannot be listed (not a repository) sweeps nothing rather than failing.

### A project with no remote keeps everything

#### Context

**Problem**: with no remote nothing is recoverable, so nothing may be deleted; and that answer cannot change between two checkouts of the same pass.

#### Business logic

Whether the repository has a remote is asked once per project. When it has none, every retained checkout [3] is reported as kept with "the repo has no remote; its worktree was kept", and the per-checkout probe-and-push is skipped for all of them.

### The one removal rule

#### Context

**Problem**: the automatic path and the manual one (the dashboard's "Remove" button, and the teardown at an agent's end) must be one behavior, not two that can disagree.

#### Business logic

Each offered checkout [3] is handed to the shared removal in `worktrees.ts`, whose git side is the `branches` skill's `reclaim.ts`; this sweep adds only the loop, the busy exclusion and the lock. The outcomes it reports:

- Removed. The checkout's branch goes with it when it holds nothing the remote lacks (an agent [4] that committed nothing), and the birth branch `agent-<agent id>` goes when everything on it is in the branch the agent renamed to; deleted branches are named in the announcement.
- Kept, with the reason: the agent is still going; the directory is not a git worktree (nothing is run in it); the checkout is on no branch; the tree holds uncommitted work (nothing is ever committed on the agent's behalf); the branch's tip is not on the remote and the push did not land (git's reason is quoted); the agent was set to publish nothing, a `local` handoff [7], and its tip is not on the remote or its tree is dirty, since its branch may never be pushed to make removal possible; or the agent's record cannot be read, in which case the checkout is kept rather than guessed about and retried on a later pass. A web agent whose tip is inside its cloud anchor [8] goes without a push.

### Each removal runs under the agent's lock

#### Context

See `## Context`.

#### Business logic

A removal waits for every earlier actor on the same checkout [3] to settle before it runs: the teardown at the agent's end, a "Push" or "Open PR", a "Remove" or "Delete", a "Resume" (the lock in `agent-locks.ts`). Without it a sweep landing during a teardown's archiving would remove the directory the archive is reading from, the archive would recreate it, and the removal would silently un-happen.

### One turn per beat of the daemon's clock

#### Context

**User story**: a machine that was off, or a daemon that was down, while an agent's push could not land reclaims that checkout as soon as the daemon is back.

#### Business logic

The sweep has no timer of its own: the daemon's single clock (see `daemon-services.ts`) gives it one turn every ten minutes and one at start-up, and each turn walks every registered project once (the pass shape in `project-pass.ts`). A pass whose project throws goes on to the next project; a project list that cannot be read is this turn's problem and the next turn tries again; a stopped sweep does nothing further. The daemon's log calls it the "worktree sweep".

### Saying what it did

#### Context

**Problem**: a checkout vanishing from under someone with no line explaining why reads as a bug, even when the work behind it is safe; and a permanently unpushable checkout would otherwise be re-announced every ten minutes for the life of the daemon.

#### Business logic

Every removal is announced in the daemon's terminal: "[framework] removed the worktree for session <agent id>: its branch is on the remote. The branch and the session are kept.", or, when branches went with it, "[framework] removed the worktree for session <agent id> and its branch <name>: nothing on it is missing elsewhere. The session is kept." ("its branches <a> and <b>" for two). A kept checkout [3] is announced as "[framework] kept the worktree for session <agent id>: <reason>" once per reason: the same reason is not repeated on later turns; a changed reason is a changed state and is said again (a remote added, pushes now failing on credentials); a removal clears the memory, so a checkout with the same agent id [5] that reappears is announced anew; and a daemon restart starts the accounting over, which is the boot-time announcement a retained checkout deserves.
