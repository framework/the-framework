Every pull request the dashboard reads, in one place, all through the project's git host provider [1]: the pull request a branch has, a branch's whole pull request history, and the project's open pull requests. Reads only: opening and landing a pull request are the handoff's (`agent-handoff.ts`), through the same provider. The Framework runs no git host tool of its own; a project with no git host provider has no pull requests, and every read here answers "none" for it. It also owns the two shapes the rest of the dashboard speaks in, a linked pull request [2] and an open pull request [3], copied out of what the provider answers so nothing a provider adds leaks into what callers store, and the rule that says which of a branch's pull requests belongs to an agent [4].

## Context

**User story**: the user sees an agent's pull request in the git status bar and in the handoff summary, the project's open pull requests in the Human Queue, and the "Open PR" button only when the agent has none yet, whether the project is on GitHub or on another git host whose package answers the same command.

**Business logic story**: the git status bar (`git-status.ts`), the handoff (`agent-handoff.ts`), the interventions feed (`interventions.ts`), cloud work adoption (`../cloud-work.ts`) and the cloud scratch sweep (`../cloud-scratch-refs.ts`) each ask here; the slow reads come through the read-through cache (`cache.ts`).

**Problem**: a branch name gets reused, so the newest pull request on a name may be a predecessor's; and "no pull requests" and "the git host could not answer" must not look alike to a caller about to open one.

## Glossary

[1] git host provider: the package of the project that declares it provides the git host (`"framework": { "git-host": "<command>" }`); The Framework reads and moves pull requests through the command that package declares (`../store/git-host.ts`). A project with none has no git host.
[2] linked pull request: a pull request as the dashboard keeps it for a branch: number, URL, state (`OPEN`, `MERGED`, `CLOSED`, or `UNKNOWN` for a recorded pull request no live read confirmed), title, and, when the provider answered them, the creation time, the head commit and, for a merged one, the commit it landed as.
[3] open pull request: a pull request as the interventions feed keeps it: number, title, URL, whether it is a draft, and, when the provider answered them, the head branch and the creation time.
[4] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.

## Business logic — TL;DR

- **The shapes** - a provider's request becomes a linked pull request [2] with its state upper-cased and its head commit, or an open pull request [3] with its draft flag and head branch; a field the provider did not answer is absent, never present and empty.
- **A branch's history** - every pull request the branch name has had, newest first, asked of the git host provider [1] for that branch in every state; the newest one is the branch's pull request; a project with no git host has none.
- **"None" against "could not tell"** - for the panels a git host that could not answer reads as no history; for a caller about to open a pull request it is a failure, never "none".
- **Cached, and allowed to arrive late** - the branch's pull request and its history are read through the read-through cache, per checkout and branch, and forgotten after an action that changes them; a read with no branch to ask about answers nothing at once.
- **Which pull request is the agent's** - an open one always; otherwise only one created after the agent started, the first for identity, the latest for a handoff decision; without a start time only an open one is trusted.
- **The open pull requests** - the project's, asked of the git host provider by state; a git host that could not answer is a failure, never an empty queue; a project with no git host has none open.

## Business logic

### The shapes

#### Context

See `## Context`.

#### Business logic

A request the provider answers (number, URL, state `open`/`merged`/`closed`, title, draft flag, branch, head commit, creation time, merge time, merge commit) becomes a linked pull request [2] with the number, URL, title, the state in upper case (`OPEN`, `MERGED`, `CLOSED`), the creation time when the provider gave one, the head commit as `headRefOid` when it gave one, and the merge commit when it gave one; or an open pull request [3] with the number, title, URL, the draft flag, the branch as its head branch when given, and the creation time when given. A field the provider answered empty is left out rather than set to nothing, so "we do not know" stays distinguishable from "it has none": the creation time is what tells an agent's own pull request from a predecessor's.

### A branch's history

#### Context

**Problem**: the newest pull request for a branch name, in any state, is what a single lookup would answer, so an agent whose prompt pins its branch name inherits a predecessor's merged pull request as its own; the whole history is what lets the rule below decide.

#### Business logic

The git host provider [1] is asked for the branch's pull requests in every state; they come back newest first, as the provider orders them. The newest is the branch's pull request. A project with no git host provider has no history and no pull request. Two forms exist for a provider that could not answer: the forgiving one, which every panel uses, reads it as an empty history, since that is what every panel would do with a failure anyway; the strict one, for a caller about to open a pull request (cloud work adoption), throws with the provider's own error, because "none" and "could not tell" must not look alike there: the difference is a second draft pull request on a branch that already has one. A project with no git host answers an empty history to both, truthfully.

### Cached, and allowed to arrive late

#### Context

**Problem**: a pull request lookup is a run of the provider's command, hundreds of milliseconds where the git reads beside it cost ten, and the answer changes about as often as someone opens a pull request; the git status bar and the handoff summary both ask, on every poll.

#### Business logic

The branch's pull request and the branch's history are each read through the read-through cache (`cache.ts`), under a key made of the checkout and the branch, so the worktree bar and the handoff summary share one answer and it is refreshed behind whoever asks. The cache answers with the value and whether a read is still running with no value known yet; "pending" means "not known yet", not "there is none", which matters to a caller deciding whether to offer "Open PR". A read asked with no branch answers nothing at once, not pending: there is nothing to ask the git host about. After an action that changes the answer, opening or landing a pull request, the caller forgets the branch's pull request and its history, so the next read is fresh.

### Which pull request is the agent's

#### Context

**Problem**: a branch name gets reused. An agent [4] on a name an earlier agent used inherits every pull request its predecessors opened on that name, which is exactly what once showed a merged two-day-old pull request as a fresh agent's own.

#### Business logic

Out of a branch's history, an open pull request always counts, whatever its age: a git host allows one open pull request per head branch, so whatever is open on the agent's branch is where its pushed commits land. A merged or closed one counts only when it was created at or after the agent [4] started; anything older is a previous agent's wearing the same branch name. Without a start time only an open one is trusted. When several qualify, "first" (the default) answers identity: the oldest of the agent's own, the one its handoff opened, so a later agent's is never the answer; "latest" answers a handoff decision: the last pull request that saw the branch, so whether the agent kept working past it reads off that pull request's head commit, where the oldest entry would call work a second pull request already landed unlanded.

### The open pull requests

#### Context

**Business logic story**: the interventions feed lists every project's open pull requests, and its notification watcher keeps a baseline of what it has already announced (`interventions.ts`, `keyed-watcher.ts`).

#### Business logic

The git host provider [1] is asked for the project's open pull requests, which become open pull requests [3]. Unlike the panels' reads, a provider that could not answer (no remote, not logged in, the git host unreachable) is a failure the caller sees, never an empty list: "no pull requests are open" and "I could not look" are different answers, and taking the second for the first would make the next successful read announce every already-open pull request as new. A project with no git host provider has none open, and that is a real answer.
