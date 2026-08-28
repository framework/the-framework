The cloud scratch-ref sweep: deletes from origin the leftover refs a `web`-target agent's hand-off pushes and nothing ever consumes again. Every hand-off to a cloud session leaves two: the slash-free `cloud-<counter>-<8 hex>` ref the driver pushes so the cloud session has a ref to clone at, and the agent branch (`agent-<agent id>`) the worktree sweep pushes before reclaiming the checkout. The cloud session does its work on its own `claude/*` branch and opens its PR from there, so once provisioning settles both refs are dead names — one pair per `web`-target agent, accumulating forever. The daemon sweeps them because the driver cannot safely delete its own ref: creating the cloud session only signals "session created", not "clone finished", and a ref deleted in that window strands the session.

## Glossary

- **scratch ref** — one of the two leftover refs above: the driver's `cloud-<counter>-<8 hex>` clone ref, or a pushed agent branch (`agent-<agent id>`).
- **hand-off anchor** — the empty commit, unique to one agent, that the driver pushes as the ref the cloud session clones at. Its tree equals its parent's tree (it changes nothing), and no merge ever lands the anchor itself — a squash merge rewrites the session's history without it.

## Business logic — TL;DR

- **Four gates before any deletion** - a candidate ref goes only when it is old enough, provably holds no work, backs no open PR, and belongs to no agent the daemon is still responsible for. Anything unprovable keeps the ref for the next sweep, and the sweep never throws.
- **Age is proven, not guessed** - an agent branch carries its start time in its name; a `cloud-*` ref carries nothing, so each machine records when it first saw one and only deletes what it has itself watched for a day.
- **An anchor tip counts as holding no work** - an empty commit on a parent that landed changed nothing, and plain reachability would keep its ref forever.
- **A quiet daemon service** - one sweep over every project per tick of the daemon's shared clock; only deletions and failures are logged.

## Business logic

### Four gates before any deletion

#### User story

A user who hands tasks to Claude web finds origin accumulating a pair of dead refs per hand-off. The daemon cleans them up on its own — and must never delete a branch that holds unmerged commits, backs an open PR, or belongs to a live agent.

#### Business logic

Only two naming shapes are ever candidates: the driver's tightly-matched `cloud-<counter>-<8 hex>` form (a user's own `cloud-…` branch that does not match it is never considered) and agent branches. Every other branch — the default branch, `claude/*`, `agent-<session name>` — is never even listed. A candidate is deleted only when all four gates clear:

1. **Old enough** (~a day), safely past any provisioning window.
2. **Holds no work**: its tip is already reachable from origin's default branch, or it is a hand-off anchor — an empty commit whose parent landed. This gate runs first (it is local, free, and the one that must never be wrong), and a ref that fails it is spent no PR lookup.
3. **No open PR**, so a deletion can never close one; a closed PR does not protect the ref.
4. **Not a live agent's**: its agent id is not among those the daemon is still responsible for.

One remote listing answers both the branch inventory and which branch is the default, in a single round trip; a remote that names no default falls back to `main`/`master` if present. The sweep never throws: a repo with no reachable remote sweeps nothing, a deletion the remote refuses is reported and retried next sweep, and any unprovable case (objects missing, no default branch, an agent branch whose age is unknowable) keeps the ref.

#### Rationale

A failed PR lookup reads as "no PRs", which fails toward deletion — acceptable only because the work gate has already proven the ref holds nothing, so the worst outcome is a closed PR losing its branch pointer, never lost work.

### Age is proven, not guessed

#### User story

Two machines pushing to the same origin must not delete each other's fresh hand-offs; and a `cloud-*` ref must not be aged by a commit date that says nothing about when the hand-off happened.

#### Business logic

An agent branch's age comes from the start time embedded in its name. A `cloud-*` ref carries no timestamp, and its commit date is whatever the base commit's happens to be — so the sweep records, in the repo-local file `.the-framework/cloud-refs.json` (gitignored bookkeeping), when this machine first saw each such ref on origin, and ages it only from that observation. First sight starts the day; a ref watched past the safe age becomes a candidate. Because each machine only deletes what it has itself watched for a day, a ref pushed by another machine is safe by construction. The record is rebuilt each sweep from what origin actually has, so entries for refs anyone already deleted fall away; a failed deletion keeps its entry so the retry does not restart the day; and a missing, unreadable, or malformed record simply means nothing has been seen yet — deletions are delayed, work is never lost.

### The sweep as a daemon service

#### User story

Background cleanup happens quietly, but a ref vanishing from origin with no line explaining why would read as a bug — so every deletion and every failure is said out loud in the daemon's log.

#### Business logic

One tick sweeps every registered project in order. Deletions and failures are logged; kept refs are not, because "not old enough yet" is the normal state of every ref this watches. Overlapping ticks join the sweep already running rather than piling up, so awaiting a tick means the sweep finished. The service keeps no timer of its own — the daemon's one clock ticks it — and a stopped service ticks as a no-op.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
