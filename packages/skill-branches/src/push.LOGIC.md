Pushes a branch to `origin`: the last git step of an agent's [1] work, and the step before whatever the project's git host package does with the branch. This package knows git and nothing beyond it: what becomes of a pushed branch on the git host, a pull request or anything else, is another package's command, composed after the push by whoever runs both. Two doors onto one rule: the agent pushes the checkout [2] it is in; a person, or the dashboard's server on the person's behalf, pushes a finished agent's branch by name, whether or not its checkout is still on disk.

## Context

**User story**: an agent finishes its work, commits it, and runs `npx branches push`; its branch is on the remote, and the next skill it reads takes it from there. A run ended without pushing (it failed, was stopped, or was told someone else publishes); the user presses the button on its page and the branch the run worked on reaches the remote, checkout or no checkout.

**Problem**: what is pushed is what is committed, and nothing is committed on the agent's behalf; so a checkout holding uncommitted work must be refused rather than pushed half-done.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[3] worktree root: a directory that is itself the top level of a git worktree: the project's checkout, or an agent's checkout that git still knows as a worktree.

## Business logic — TL;DR

- **Pushing a checkout** - the checkout's own branch is pushed to `origin` once the checkout is clean; a directory git does not know as a worktree, a checkout on no branch, and a checkout with uncommitted work are refused, in that order, before anything is pushed.
- **Pushing a branch by name** - the checkout under `.branches/` that is on the branch is pushed under the same clean rule; without one, the branch itself is pushed when this machine has it, and left as it is when only `origin` has it; a branch neither here nor on `origin` is refused.
- **What comes back** - the branch, and whether anything was pushed; a push that did not land is a refusal carrying git's reason.

## Business logic

### Pushing a checkout

#### Context

See `## Context`.

#### Business logic

The directory must be a worktree root [3], else the refusal is `not-a-worktree`; it must be on a branch, else `no-branch`; and it must be clean, nothing uncommitted and nothing untracked (a clean check git cannot answer counts as not clean), else `dirty` with the branch named. Then the branch is pushed to `origin` from the project the checkout belongs to; a push that does not land is `push-failed` with the branch and git's own reason. Success answers the branch and `pushed` true.

### Pushing a branch by name

#### Context

**User story**: see `## Context`, the finished run.

#### Business logic

Every checkout [2] directory under the project's `.branches/` is looked at; the first one whose branch is the one named is pushed exactly as a checkout is pushed, its clean rule included. When no checkout is on the branch: a branch this machine has is pushed to `origin`, answering `pushed` true, or `push-failed` with git's reason; a branch only `origin` has (pushed from elsewhere, nothing here to push) is left as it is and answers `pushed` false; a branch neither here nor on `origin` is refused as `no-branch`, the branch named.
