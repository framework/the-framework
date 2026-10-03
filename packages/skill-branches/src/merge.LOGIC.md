Merges a finished agent's [1] branch into the project's default branch [2], on this machine, and then deletes the branch: how an agent's work reaches the project's own folder where there is no remote to push to and no pull request to merge. Git only.

## Context

**User story**: the user's project is a folder that was never pushed anywhere. An agent finishes; its work is on its branch. The user presses "Merge into main" on the agent's page, and the file the agent made is in the project's folder. If the user changed the same lines meanwhile, nothing is changed and the user is told which files clash.

**Problem**: with no remote there is no pull request, so nothing brought an agent's work into the project's folder short of typing git commands.

## Glossary

[1] agent: one task worked by a coding agent in its own checkout under `.branches/`, on its own branch `agent-<name>`.
[2] default branch: the project's main line: the branch origin's HEAD names when this machine has it, else `main`, else `master`.

## Business logic — TL;DR

- **Where the merge runs** - in the project's folder, which must be on the default branch [2]; on another branch the merge is refused, naming both.
- **What is merged is what is committed** - an agent's checkout that holds uncommitted work stops the merge before it starts.
- **The merge** - a fast-forward when the default branch did not move, a merge commit "Merge branch '<branch>'" otherwise; a branch already in the default branch merges nothing.
- **A conflict changes nothing** - the merge is undone and the conflicting files are named; any other refusal by git is answered in git's words, with nothing changed.
- **The branch goes once the work is in** - an agent's branch is deleted when no checkout is on it; a branch that still has its checkout is kept with it, and a branch that is no agent's is kept.
- **What is answered** - the default branch's name, the branch's last commit and the commit its work began at, so what the branch changed can still be read once it is gone.

## Business logic

### Where the merge runs

#### Context

See `## Context`.

#### Business logic

A branch this machine does not have is refused as `no-branch`. A project with no default branch [2] is refused as `no-default-branch`. The merge runs in the project's folder, and only when that folder is on the default branch: on any other branch, or on none, it is refused as `not-on-default`, with the default branch and the one the folder is on.

### What is merged is what is committed

#### Context

**Problem**: nothing is ever committed on an agent's [1] behalf, so uncommitted work would silently stay out of the merge and then be lost with the checkout.

#### Business logic

When a checkout under `.branches/` is still on the branch and holds uncommitted work, the merge is refused as `dirty` before anything runs.

### The merge

#### Context

See `## Context`.

#### Business logic

The commit the branch's work began at is where it left the default branch [2] (their merge base). When that commit is the branch's own last commit, the default branch already holds the work and nothing is merged. Otherwise the branch is merged with the message "Merge branch '<branch>'": git fast-forwards when the default branch did not move since, and makes a merge commit when it did.

### A conflict changes nothing

#### Context

**Problem**: a half-done merge left in the user's folder, with conflict markers in their files, is a state the user did not ask for and may not know how to leave.

#### Business logic

When the merge stops on conflicts, the files in conflict are read, the merge is undone, and the answer is `conflict` with those files: the folder is as it was. When git refuses the merge for another reason (the folder holds uncommitted changes the merge would overwrite), the answer is `merge-failed` with git's own reason, and nothing was changed.

### The branch goes once the work is in

#### Context

**Business logic story**: only an agent's [1] branch is ever deleted by this package (`branch-names.ts`).

**Problem**: an agent asked to "merge" ran this command on its own branch. The command removed the agent's checkout while the agent was still running in it, and the agent's whole conversation, kept in that checkout until the run ends, was lost.

#### Business logic

After the merge, a branch named as an agent's is deleted, when no checkout under `.branches/` is on it. A branch that still has its checkout is left with it: an agent [1] may be working there, and an agent asked to merge its own work runs this command from inside that checkout, so removing it would delete the directory under the agent and, with it, the diary its run keeps there. The checkout's owner reclaims both later, by the reclaim rule, since the branch then holds nothing the default branch lacks. Any other branch is merged and kept.

### What is answered

#### Context

**Business logic story**: the dashboard records the two commits on the agent's [1] run, and reads what the agent changed between them after the branch is gone.

#### Business logic

The answer names the branch, the default branch [2] it went into, the branch's last commit, the commit its work began at, and whether the branch was deleted.
