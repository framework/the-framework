Releases a pinned routine branch that a closed or merged pull request left behind, so the routine's next firing can proceed instead of being jammed forever by a branch name nobody is using.

## Glossary

- **pinned branch** — the branch of a routine whose prompt pins its session name: every firing of that routine wants the same branch (e.g. `tf-triage-quick`), and a firing deliberately aborts when the branch already exists, because an in-flight agent owning the branch means the routine must not run twice.

## Business logic — TL;DR

- **A branch is not evidence of pending work; an open PR is** - before firing a pinned routine, the sweep asks the branch's pull-request history and deletes the branch (remote and local copies) only when some PR existed and none is open.
- **Conservative on the two unprovable cases** - an open PR keeps the branch (work genuinely pending); a branch with no PR history at all keeps it too (either an agent still working toward its handoff, or GitHub could not answer — deleting on a hiccup would discard work).
- **Never throws** - a release that could not happen leaves the routine exactly as jammed as it was, and the next sweep tick retries.

## Business logic

### Releasing the leftover name

#### User story

Auto PM's triage routine fires on a schedule. A triage PR gets closed or merged without its branch being deleted; from then on every later firing finds the branch, follows its scripted abort, and reports a pending triage that does not exist — the routine is jammed until a human notices.

#### Business logic

The release checks whether the branch exists locally and/or on origin; if it exists nowhere, nothing is done (and the PR history is never even queried). Otherwise the branch's full pull-request history decides: any open PR means the work is genuinely pending and the branch is kept; an empty history is unprovable and the branch is kept; a history where some PR existed and none is open proves the work is over, and both the remote and the local copy of the branch are deleted. Each outcome is reported distinctly: gone already, genuinely busy, unprovable, or released.

#### Rationale

Deleting is safe exactly when the history proves the work is over, because the closed PR itself preserves the diff on GitHub — the branch is then a leftover name, not the last copy of anything a human still needs. The local delete is forced, because a squash merge leaves the branch looking unmerged to git; and git refusing the delete because a worktree still has the branch checked out is the in-flight guard working, not a failure — the refusal is swallowed and the branch simply stays until the next tick.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
