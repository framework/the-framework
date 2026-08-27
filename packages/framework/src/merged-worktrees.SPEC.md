The worktree sweep: reclaims a finished agent's checkout once its work is safely on the remote, across every registered project, so a machine stops accumulating one full checkout per agent forever.

## Business logic — TL;DR

- **Only what is on the remote may go** - a checkout is reclaimed when, and only when, everything it holds is already on the remote. Every deletion is therefore recoverable, because the remote holds a copy.
- **The checkout goes, the work stays** - the agent's record and its replayable event log survive, and so does its branch unless the removal proved that branch holds nothing anyone else is missing; only the working copy on disk is reclaimed, and it can be recreated from the branch at any time.
- **The same decision as the Remove button** - the sweep reuses exactly the removal the user's own Remove button performs: keep a dirty checkout, push the branch, remove only once the remote has it. The automatic path and the manual one cannot disagree.
- **Never touches a checkout that is still someone's** - a live agent's checkout is left alone, and so is one the daemon is still responsible for, including an agent between finishing and being archived.
- **A project with no remote keeps everything** - with nowhere to push, nothing is reclaimable; each retained checkout is still accounted for.
- **It says what it did** - every removal and every retention is explained once per state, never repeated on each pass, and never silent.

## Business logic

### Only what is on the remote may go

#### User story

The user's machine should not fill up with the checkouts of agents that finished days ago — and no checkout they might still need should ever disappear irrecoverably.

#### Business logic

Every retained checkout in every registered project is offered up for reclamation on each pass. A checkout is removed when its work reaches the remote: pending work is committed, the branch is pushed, and only then is the working copy removed — or, when the removal can prove the checkout holds nothing the remote lacks, with no push at all and with that branch deleted alongside it. A checkout whose work cannot reach the remote is kept, and the reason is reported — most often a branch that could not be pushed.

Failing to reclaim is never final: a push that failed while the machine was offline, unauthenticated, or behind the remote simply succeeds on a later pass, which is exactly what the recurring sweep is for.

#### Rationale

A checkout used to be kept or reclaimed according to how its agent ended — a clean finish removed it, a failure or a stop kept it "so you can look at what it was holding", and a merged branch reclaimed it later through two different notions of "landed", because a squash merge rewrites the commits and the local ancestry check never fires. Nothing reclaimed the rest at all. One rule replaces all of that: the question stops being *how did this end* and becomes *is it pushed yet* — a single condition, answerable at any moment, with a single failure mode.

### Never touches a checkout that is still someone's

#### User story

An agent is working. The dashboard shows another agent as done a moment before the daemon has finished packing it away. Neither checkout may be pulled out from under its owner.

#### Business logic

A checkout with a live agent in it is never a candidate, and neither is one belonging to an agent the daemon is still responsible for — spawning, running, or mid-retirement. Beyond that, the sweep takes the same per-checkout lock every other actor on a checkout takes, so it and a teardown can never work on the same directory at once.

#### Rationale

Being finished on disk is not the same as the daemon being finished with it: an agent's status flips to done a beat before its teardown archives its history and reclaims its checkout. A sweep landing in that window would remove the checkout out from under the archiving, which then recreates the very directory it was reading from — and the removal silently un-happens.

### A project with no remote

#### User story

A project that has never been given a remote can never satisfy the rule, and its user should still be told why their checkouts are piling up.

#### Business logic

Whether the project has a remote is settled once per pass, not once per checkout: with no remote, every retained checkout is kept and reported as kept for that reason, and no time is spent attempting a push that cannot succeed.

### Saying what it did

#### User story

A checkout vanishing from under someone with no explanation reads as a bug, even when the work behind it is perfectly safe. And a keep reason repeated every few minutes for the life of the daemon is noise.

#### Business logic

Each removal is announced, naming the agent. When the checkout's branch is on the remote, the line says so and states that the branch and the agent's record are kept. When branches went with the checkout — one holding nothing the remote lacks, the `tf-agent-<agent id>` branch the checkout was created on and the agent walked away from, or both — the line names every branch that went, says that nothing on them is missing elsewhere, and states that the agent's record is kept regardless. Each retention is announced once per reason: the same reason is not repeated on later passes, a *changed* reason is announced again because it means the situation changed (a remote was added; pushes now fail on authentication), a removal forgets the checkout entirely so a checkout reappearing under the same identity is accounted for afresh, and restarting the daemon starts the accounting over — which is the start-up statement the retained checkouts deserve.

The sweep has no clock of its own; the daemon's shared tick drives it, including once at start-up, since the case it exists for is a machine that was switched off while the work could not be pushed. Two overlapping passes join the pass already running rather than one being dropped, so waiting for a sweep always means the sweep really finished.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
