The CI watch [1]: the sweep [2] that, once per tick [3] of the daemon's clock, walks every registered project and acts on what the checks say about the pull requests The Framework is waiting to land. A green pull request whose merge was left to the daemon is merged; a red one gets one unattended [4] fix agent [5] per failing head commit, at most two per pull request, told to push its fix onto the pull request's own branch; a pull request older than a week, or one a human closed, is left alone.

## Context

**User story**: the user armed the merge on an agent [6] in a repository that does not offer GitHub's own auto-merge. The agent's pull request lands about a minute after its checks pass, without the user doing anything; when the checks go red instead, a fix appears on the pull request's branch and the checks rerun; after two fixes that did not take, the pull request is left for the user, and the daemon's log says what was merged and why something was not.

**Problem**: merging a pull request directly the moment it opens lands work before its first check has run, and a check suite takes seconds to attach after a push, so "no checks" cannot be read as "green" right away. A local daemon has no public URL for GitHub to call, so the watch polls; every decision starts from what the `gh` CLI answers, so a hosted deployment could later feed the same decisions from a webhook.

## Glossary

[1] CI watch: the sweep that merges the pull requests The Framework opened once their checks pass, and starts a fix agent when a check goes red.
[2] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[3] tick: one beat of the daemon's single background clock; each sweep says how many ticks it waits between turns.
[4] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[5] fix agent: the agent the CI watch starts when a check goes red on a watched pull request.
[6] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[7] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[8] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[9] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[10] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[11] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.

## Business logic — TL;DR

- **Which pull requests are watched** - the pull request of every ended agent whose merge was recorded as watched or as armed on GitHub, for a week after the agent's record last changed, read live and skipped while the read is still warming or once the pull request is no longer open.
- **Reading the checks** - the checks are passing, failing, pending or absent; pending waits for the next tick, failing goes to the fix half, and passing or absent goes to the merge half.
- **Merging on green** - only a pull request whose merge was left to the daemon is merged; one with no checks counts as green only once `gh` really answered and the pull request is more than three minutes old; a refused merge is retried only on a new head commit.
- **Starting a fix agent on red** - one fix agent per failing head commit, never while one is running for the pull request, at most two per pull request ever, and only when the daemon wired the fix half and it does not decline.
- **What the fix agent is told** - the pull request, its failing checks, its branch and head commit, the git steps to land a fix on that branch, and never to open another pull request or merge anything.
- **What is reported** - every merge is logged; a refused merge and an exhausted pull request are logged once per daemon lifetime; a started fix agent is logged; a declined one is silent.
- **The pass lifecycle** - no timer of its own: one pass over the projects per tick of the daemon's clock, overlapping ticks join the pass in flight, a stop takes effect between projects, and a project whose sweep fails yields nothing this tick.

## Business logic

### Which pull requests are watched

#### Context

**Business logic story**: when an agent [6]'s handoff [7] arms a merge that GitHub cannot take before the checks have run, the handoff records the merge as "watched" and leaves it to this sweep [2]; when GitHub's own auto-merge took it, the merge is recorded as "auto-armed" and GitHub holds that promise (`dashboard/agent-handoff.ts`).

#### Business logic

Both the live records and the archive [8] of a project's agents are scanned. A candidate is an agent that is no longer running, whose recorded merge outcome is watched or auto-armed, and whose record last changed within the last 7 days: long enough to survive a weekend with the daemon off, short enough that the sweep's `gh` spend cannot grow with the archive, and a pull request red or unmergeable for a week is a human's to land. For each candidate the pull request the agent recorded is read live for its current state. A read still warming in the pull request cache is skipped until the next tick [3], because acting on its stand-in state would re-merge pull requests that already landed or start fixes on branches a human closed. An agent with no pull request, or whose pull request is no longer open, has nothing to watch: merged is done, and a closed but unmerged pull request is a human's rejection of the work, which the sweep never overrides. A pull request several agent records point at is handled once per pass.

### Reading the checks

#### Context

See `## Context`.

#### Business logic

The pull request's combined check state is read through `gh` and summarized to one of four answers, with the rules in `dashboard/gh.ts`: passing (every check concluded, none failed), failing (at least one concluded check failed, whatever the rest do), pending (something still running, nothing failed yet), or none (no checks reported, which is also the answer when `gh` could not say). Pending waits for the next tick [3]. Failing goes to the fix half below. Passing and none go to the merge half.

### Merging on green

#### Context

**Problem**: a merge must never land unverified work: not on a check suite that has not attached yet, not on a status `gh` could not read, and not on a pull request whose merge GitHub itself is already holding.

#### Business logic

Only a pull request whose recorded merge outcome is watched is merged here; an auto-armed one lands by GitHub's own hand, though its red checks still start a fix. A pull request with no checks counts as green only when both hold: `gh` actually answered, which is known because a successful read always carries the head commit, and the pull request was created more than 3 minutes ago, longer than a suite takes to attach; a pull request with no known creation time is never merged on the absence of checks. The merge itself goes through the same path as the user's Merge action, which also marks a draft ready and refuses a pull request that is not open (`dashboard/agent-handoff.ts`). A merge that was refused, by branch protection demanding a review for instance, is remembered for the daemon's lifetime against that pull request's head commit, so it costs one `gh` write per head rather than one per tick [3] for a week; a push that changes the head, a conflict resolved for instance, re-arms exactly one more attempt, and a daemon restart retries once.

### Starting a fix agent on red

#### Context

**User story**: a red pull request The Framework produced is work it abandoned to a human unless something fixes it; a fix that did not take once may take a second time, but a failure that survives two fixes is evidently not something an agent can fix.

#### Business logic

The fix half runs only when the daemon wired it; without that wiring red pull requests are simply left to the merge half to keep ignoring. It stands down, without a word, when the status carries no head commit or no branch, because a retry could not then be told from a loop. Prior attempts are found on the same agent records by the marker every fix agent [5]'s prompt opens with, `[ci-fix] PR #<number> @<head commit>`; the `@` is always present so that "PR #12" never reads as a prefix of "PR #123". No second attempt is started for a head commit that already has one; none while an attempt for the pull request is still running; and once a pull request has had 2 attempts, the outcome is "attempts-exhausted" and the pull request is left for a human. Otherwise the daemon's wiring is asked to start an unattended [4] agent [6] with the pull request's number, title, URL, branch, head commit and the names of the failed checks; the wiring may decline, when the preference is off, the quota [9] has no headroom, or the start failed, and then the outcome is "declined". A started agent's agent id [10] is the outcome.

### What the fix agent is told

#### Context

**Problem**: the fix agent [5] works in an ordinary checkout [11] on its own scratch branch, while the pull request's branch may be checked out in a retained checkout elsewhere, so the prompt spells out the one git spelling that lands the fix without fighting over who holds the branch.

#### Business logic

The prompt opens with the marker line, then says: "CI is red on PR #<number> ("<title>"): <failed check names, or "checks failed" when none are named>." and names the branch and the failing head commit. It instructs, in order: fetch the branch from origin and put the checkout on exactly that state with a hard reset, since the checkout's own branch is scratch and nothing on it is worth keeping; read the failing checks with `gh pr checks <number>` and the failed workflow runs' logs with `gh run view --log-failed <run-id>`, and diagnose; fix it and run the relevant tests and build locally to confirm; push the fix back onto the pull request with `git push origin HEAD:<branch>`. It ends with: do NOT open a new pull request and do not merge anything, because the fix belongs on that pull request and the merge happens elsewhere once the checks pass.

### What is reported

#### Context

**Problem**: a pull request merging with no line explaining why reads as a bug even when it is the feature; a red or unmergeable pull request stays a candidate for a week, and its line does not get truer with repetition.

#### Business logic

Every merge is logged as "[framework] CI watch: checks passed on PR #<number>, merged it (<url>) (session <agent id>)". A refused merge is logged as "[framework] CI watch: could not merge PR #<number>: <error>", each distinct line once per daemon lifetime. A started fix agent [5] is logged as "[framework] CI watch: checks failed on PR #<number>, started fix session <agent id>". A pull request whose two attempts are spent is logged once as "[framework] CI watch: PR #<number> is still red after 2 fix sessions; leaving it for a human". A declined fix logs nothing.

### The pass lifecycle

#### Context

**Business logic story**: five of the daemon's background passes walk the registered projects the same way (`project-pass.ts`); the daemon's single clock decides when each is called (`daemon-tick.ts`).

#### Business logic

The watch has no timer of its own: each tick [3] from the daemon's clock is one pass over every registered project, visiting each in turn. A tick that arrives while a pass is running joins that pass rather than starting another or being dropped, so awaiting a tick always means the pass finished. A stop takes effect before the next project, never mid-project, and a stopped watch ticks as a no-op. A registry that cannot be read leaves nothing to walk this tick; a project whose sweep fails counts as having merged, failed and fixed nothing. The refused-merge memory is one set shared across all projects for the daemon's lifetime.
