The cloud scratch sweep [1]: the sweep [2] that, once per tick [3] of the daemon's clock, deletes from origin the two dead refs every web agent [4] leaves behind, the slash-free `cloud-*` ref its cloud session [5] cloned at and the empty branch it was born on, the one its run's record names, once four gates are cleared: the ref is at least a day old, its agent is not one the caller names as busy, it provably holds no work, and no open pull request is on it. A ref the sweep cannot prove dead simply stays for a later pass.

## Context

**User story**: the user has run web agents for weeks and origin does not fill up with one pair of dead branch names per agent; a branch that holds unmerged work, a branch a pull request is open on, and a branch a cloud session might still be cloning are never touched.

**Problem**: the driver cannot delete its own ref, because session creation only says "created", not "cloned", and a ref deleted in that window strands the session; and a `cloud-*` ref carries no timestamp, its commit date being whatever the base commit's is, so its age can only be counted from when this machine first saw it.

## Glossary

[1] cloud scratch sweep: the sweep that deletes, from origin, the scratch refs a web agent left behind when it handed its task to a cloud session, once they are provably dead.
[2] sweep: a background job the daemon runs on its clock: the data sync, the notification watchers, the cloud scratch sweep, cloud work adoption. None of them starts an agent.
[3] tick: one beat of the daemon's single background clock; each sweep says how many ticks it waits between turns.
[4] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps. A web agent is one whose location is `web`.
[5] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[6] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[7] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[8] reclaim: removing a finished agent's checkout once its work is on the remote; the tool that runs the agent does it, the daemon never does.
[9] cloud anchor: an empty commit a web agent pushes before its task leaves this machine, unique to the agent: the branch the cloud session later pushes descends from it.

## Business logic — TL;DR

- **Which refs are candidates** - only refs named `cloud-<number>-<8 hex digits>` and the branches a run's record names, never the default branch nor the `agent-data` branch, whatever a record says; every other branch on origin is never considered.
- **Old enough** - a candidate is left alone for 24 hours: a `cloud-*` ref from the moment this machine first saw it, remembered in `.the-framework/cloud-refs.json`; a run's branch from the start its record says.
- **Not a live agent's** - a run's branch whose run the caller names as busy is kept; the daemon names none, since it runs no agent.
- **Holds no work** - a ref goes only when its tip is already reachable from origin's default branch, or is an empty commit on a parent that is; anything unprovable keeps the ref.
- **No open pull request** - a ref with an open pull request is kept, so a deletion never closes one.
- **Deleting and remembering** - a cleared ref is deleted on origin; a failed deletion is reported and retried without restarting its day; the first-seen memory is rebuilt from what origin has so entries for vanished refs fall away.
- **What is reported** - deletions and failures are logged; kept refs are not.
- **The pass lifecycle** - no timer of its own: one pass over every registered project per tick; a project with no reachable remote sweeps nothing.

## Business logic

### Which refs are candidates

#### Context

**Business logic story**: a web agent's driver pushed a `cloud-<number>-<tag>` ref so the cloud session [5] had a slash-free ref to clone at (that driver is gone; no web agent is started today, and the sweep stays for their return), and the reclaim [8] of the agent [4]'s checkout pushes its `agent-<id>` branch before removing the checkout; the session does its work on its own `claude/*` branch and opens its pull request from there, so both refs are dead names once provisioning settles.

#### Business logic

Origin's branches and its default branch are read in one listing (the default branch is what origin's HEAD points at, else `main` or `master` when present). A ref is a candidate only in one of two ways: named exactly `cloud-<digits>-<eight hex digits>`, anchored tightly so a user's own `cloud-…` branch is never a candidate; or the branch a run's record names (the project's finished agents, as its runs provider answers them; a record whose start cannot be read makes its branch no candidate). The default branch and the `agent-data` branch are never candidates, even when a run's record names one of them (a run that never left `main` records `main`); they, a branch no record names, `claude/*` branches and everything else are not even listed as kept. A branch a run named itself is a run's branch like any other once its record names it, and goes only when every gate below says it holds nothing.

### Old enough

#### Context

**Problem**: no provisioning may still be reading the ref, and a ref pushed by another machine must be as safe as this machine's own.

#### Business logic

A candidate is kept as "young" until it is 24 hours old. A run's branch is aged from the start its record says. A `cloud-*` ref is aged from when this machine's sweep first saw it: the first sighting, or a sighting whose remembered time is unreadable, starts the day now and keeps the ref. The first-seen times live in `.the-framework/cloud-refs.json` of the project, which is not tracked by git; a missing, unreadable or malformed file means nothing seen yet. Because each machine only deletes what it has itself watched for a day, a ref another machine pushed yesterday is not deleted by this one today.

### Not a live agent's

#### Context

See `## Context`.

#### Business logic

A run's branch whose run the caller names as busy, by its agent id [6], is kept as "busy". The check comes before the age check, so a busy agent's branch is never a candidate however old. The daemon's clock names no agent as busy, since the daemon runs no agent.

### Holds no work

#### Context

**Problem**: this is the one gate that must never be wrong: it separates a web agent [4]'s empty scratch branch from a local agent's branch holding unmerged commits, which the sweep must never delete.

#### Business logic

A candidate's tip must be provably landed: reachable from origin's default branch, tried first against origin's own tip of that branch when its commit is local, then against the local tracking copy of it, where a stale copy is fine because reachable from a stale tip is reachable from a newer one. A tip the default branch never absorbs still clears the gate when it has the cloud anchor [9]'s shape: an empty commit, whose tree is its parent's tree, on a parent that landed; no merge ever lands the anchor itself, since a squash merge rewrites the session's history without it. The commit is fetched from origin first when it is not local. With no default branch, missing objects, or any other unprovable case, the ref is kept as "holds-work". This gate runs first because it is local and free.

### No open pull request

#### Context

See `## Context`.

#### Business logic

The candidate's pull request history is listed through the project's git host provider (`dashboard/pull-requests.ts`); any open pull request keeps the ref as "open-pr", so a deletion never closes one. A listing that cannot be read, or a project with no git host provider, counts as no pull requests, which leans toward deletion; that is acceptable only because the work gate has already proven the ref holds nothing.

### Deleting and remembering

#### Context

See `## Context`.

#### Business logic

A ref that cleared every gate is deleted on origin. A deletion that fails is reported with its error and retried next sweep, and the ref's first-seen entry is kept so the retry does not restart its day. The first-seen memory is rebuilt every pass from the `cloud-*` refs origin actually has, so entries for refs deleted by this sweep or by anyone else fall away; it is written back only when it changed, and a state file that cannot be written only delays deletions, never loses work.

### What is reported

#### Context

**Problem**: a ref vanishing from origin with no line explaining why reads as a bug; a line per tick about a ref that is merely not old enough yet would be noise.

#### Business logic

Each deletion is logged as "[framework] deleted the leftover cloud hand-off ref <ref> on origin: its session settled long ago and nothing consumes it". Each failed deletion is logged as "[framework] could not delete the leftover ref <ref> on origin: <error>". Kept refs are not mentioned.

### The pass lifecycle

#### Context

**Business logic story**: the pass walks the registered projects the way every daemon background pass does (`project-pass.ts`), on the daemon's single clock (`daemon-tick.ts`), with the set of agents the daemon is still responsible for read fresh at each project.

#### Business logic

The sweep [2] has no timer of its own: each tick [3] is one pass over every registered project, overlapping ticks join the pass in flight, and a stop takes effect between projects. A project with no remote, or whose remote cannot be reached, sweeps nothing this pass; a project whose sweep fails deletes nothing this tick.
