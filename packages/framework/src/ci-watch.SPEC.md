CI watch: follows the pull requests The Framework opened and is waiting to land — merging them once their checks pass, and starting one unattended fix agent per failing head commit when the checks go red.

## User story

- The user's repo has no GitHub auto-merge, so a finished agent's pull request would sit open until someone looked at it. The user wants merge-on-green everywhere, regardless of the repo's settings.
- The user does not want work the framework produced and then abandoned: a pull request whose checks went red should get a fix attempt of its own before it becomes the user's problem.

## Business logic — TL;DR

- **Merge on green** - a pull request The Framework promised to land is merged as soon as its checks pass, whether or not the repo supports auto-merge.
- **Fix on red** - a red pull request gets one unattended fix agent, which pushes its fix onto that same pull request's branch so the checks rerun.
- **Conservative where the answer is unclear** - a pull request that is no longer open is left alone, pending checks wait for the next sweep, and a pull request with no checks at all is only trusted as green once it is older than the time a check suite takes to attach.
- **A week, then it is a human's** - a pull request stops being watched a week after its agent last changed; by then it has been red or unmergeable long enough that nothing automatic is going to help.
- **Bounded retries** - a refused merge is retried only when the pull request's head commit changes, and a pull request gets at most two fix agents ever.
- **Everything it does is logged, once** - a pull request merging with no line explaining why reads as a bug; a repeated refusal is said once per daemon lifetime rather than every sweep.

## Glossary

- **head commit** - the newest commit on a pull request's branch; the commit its checks ran against.

## Business logic

### What is watched

#### User story

The user has agents finishing all day. Only the ones whose pull request is genuinely waiting on CI should cost anything to watch.

#### Business logic

An agent qualifies once it has finished and its record says its merge is waiting on the checks — either because The Framework itself promised to merge it on green, or because GitHub's own auto-merge is armed on it. Both live agents' records and archived ones are scanned, and an agent whose record has not changed for a week drops off the list: a pull request that has been red or unmergeable for a week is a human's to land, and the watching cost must not grow with the archive.

A pull request that is no longer open is done: merged already, or closed unmerged — which is a person's rejection of the work and never something to reopen or push at. Several agents pointing at the same pull request are handled once.

#### Rationale

The checks are polled rather than pushed, because a daemon on the user's own machine has no public address GitHub could call. Every decision starts from what the GitHub CLI answers, so the same handlers could later be fed by an event receiver with only the trigger changing.

### Merging once the checks pass

#### User story

The user's repo does not have GitHub's auto-merge available, and they still want a finished agent's pull request to land by itself the moment CI is green.

#### Business logic

A watched pull request whose checks have passed is merged. Pending checks are simply left for the next sweep. A pull request GitHub's own auto-merge is armed on is never merged here — GitHub holds that promise — but its checks going red still starts a fix agent.

A pull request that reports no checks at all is trusted as green only once it has been open longer than a check suite takes to attach; inside that window "no checks" more likely means "the suite has not started yet". A pull request whose age cannot be established is never merged on that basis.

#### Rationale

Merging a pull request seconds after opening it, before its first check had even attached, is exactly the failure that made merge-on-green a watched promise instead of an immediate merge.

### Not retrying a merge that will keep being refused

#### User story

A repo requires a human review before merging. The framework must not spend a GitHub write on that refusal every single sweep for a week.

#### Business logic

A refused merge is remembered against that pull request's current head commit, and not attempted again while the head stays the same. A new head commit — a conflict resolved, a fix pushed — re-arms exactly one more attempt. The memory lives only for as long as the daemon runs, so a restart is worth one more try.

### Fixing a red pull request

#### User story

An agent opened a pull request, its CI went red, and the user would rather the framework take one honest shot at fixing it than hand them a broken branch.

#### Business logic

When a watched or auto-armed pull request's checks fail, one unattended fix agent is started for it. It is told which pull request is red, which checks failed, which branch it lives on and which commit failed, and it is instructed to put its own throwaway checkout onto exactly that branch's state, read the failing checks' logs, fix the problem, verify locally, and push the fix straight back onto the pull request's branch. It is explicitly told not to open a new pull request and not to merge anything: the fix belongs on the existing pull request, and merging is the sweep's job once the checks come back green.

#### Rationale

The fix agent works in an ordinary agent worktree on its own throwaway branch, because the pull request's own branch may still be checked out elsewhere. Pushing the commit from the throwaway branch directly onto the pull request's branch is the one form that always lands the fix without fighting over who holds the branch.

### Keeping the fixes bounded

#### User story

The user must never find that a permanently broken check has been quietly burning agents in a loop.

#### Business logic

Each fix agent's task opens with a marker naming the pull request and the exact head commit it was started for, which makes past attempts discoverable from the agents' own records. From that:

- One fix agent per failing head commit — a rerun of the same failing commit starts nothing new.
- At most one fix agent in flight per pull request at a time.
- At most two fix agents per pull request ever. Past that the failure is evidently not agent-shaped, and it is left for a human with a line saying so.

A pull request whose failing commit or branch cannot be established starts nothing: a retry could not be told apart from a loop, so the sweep stands down rather than guessing.

The daemon's own wiring can still decline to start a fix agent — the feature switched off, no quota headroom, or the start failing — and that is recorded as a decline rather than as an attempt.

### Sweeping and reporting

#### User story

The daemon may have been switched off over a weekend while checks went green.

#### Business logic

Every registered project is swept, starting with an immediate sweep as the daemon comes up. Sweeps never overlap: a tick arriving while one is running joins the sweep already in flight. A stop ends the sweep between projects.

Everything the sweep does is logged: which pull request merged and where, which fix agent was started for which pull request, and why a pull request is being left for a human. Lines that would otherwise repeat every sweep for a week — a merge that keeps being refused, a pull request that is out of fix attempts — are said once per daemon lifetime.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
