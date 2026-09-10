Reads the git status bar of a project or of an agent's [1] checkout [2]: the current branch, whether the working tree has uncommitted changes, and the pull request linked to the branch. The branch and the dirty flag are a local git read that costs about ten milliseconds; the pull request is a `gh` read an order of magnitude slower, so it comes through the read-through cache (`gh.ts`, `cache.ts`) and is allowed to arrive late, marked as pending, rather than hold the whole row back on every poll. A directory that is not a git repository yields no status at all, which is also what an agent run on a device [3] through the relay [4] looks like from this machine, since it has no local checkout.

## Glossary

[1] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is the project's checkout.
[3] device: Another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[4] relay: Running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.

## Business logic — TL;DR

- **Branch and dirty flag** - the branch the checkout is on and whether anything is uncommitted; no git repository means no status, and a failed status read reads as clean.
- **The linked pull request, best effort** - for a project the cached pull request of its current branch, reported as pending while the first lookup is still running; a failed lookup simply omits the pull request.
- **An agent's own pull request** - when the status is read for an agent's checkout, the pull request is picked from the branch's whole history with the agent's start time, so a reused branch name never wears a predecessor's merged pull request as the agent's badge.

## Business logic

### Branch and dirty flag

#### Context

**User story**: the user sees, on project home and on the agent view, which branch the checkout [2] is on and whether it holds uncommitted changes.

#### Business logic

The branch is the one the checkout is currently on. When git cannot answer that (the directory is not a git repository, or git failed), there is no status at all. The tree is dirty when git's status lists anything at all; a status read that fails reads as clean.

### The linked pull request, best effort

#### Context

**Problem**: a pull request lookup goes through `gh` and takes around 600 ms where the git facts beside it take ten, and the row is re-read every few seconds.

#### Business logic

For a project's own checkout [2], the pull request is the one linked to the current branch, read through the cache in `gh.ts`: a known answer is served at once, and while the first lookup for a branch is still running the row carries no pull request but is marked pending, which means "not known yet" and not "there is none". When `gh` is missing, not logged in, or the lookup fails, the row simply has no pull request and is not pending.

### An agent's own pull request

#### Context

**Problem**: the plain lookup answers the newest pull request for the branch in any state, so an agent [1] on a reused pinned branch (a routine's branch such as `the-framework/triage-quick`) would wear a predecessor's merged pull request as its own badge.

#### Business logic

When the status is read for an agent's checkout [2], the caller gives the agent's start time, and the pull request is then chosen from the branch's whole pull request history by the rule in `gh.ts`: an open pull request always, otherwise a closed or merged one created no earlier than the agent started, so the agent still shows its own pull request whether open or just merged, and never an older one. The history comes through the same cache and can be pending in the same way; a history read that fails leaves the row without a pull request and not pending.
