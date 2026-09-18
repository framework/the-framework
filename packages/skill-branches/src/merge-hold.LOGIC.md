A held merge: whoever starts an agent [1] can say more work comes on its branch after it, so the merge the agent's publish asks for waits until the last of that work is done. This file keeps the two marks that make it work, the hold [3] on a checkout [2] and the record of a held merge [4], and the line a held pull request's body carries. It names no command and no caller: a hold only says "not yet". Publishing reads and writes these marks (`publish.ts`).

## Context

**User story**: the user ticks "Post-merge cleanup" in the dashboard's launcher; the agent publishes its work with `--merge` as it always does, the request stays open with a line saying its merge is held, a second agent cleans up on the same branch, and only then does the request merge on green.

**Problem**: the agent that publishes cannot know that more work follows it, and its checkout is reclaimed when it ends, before the rest of the work is done; the "merge is wanted" fact has to outlive the checkout until someone releases it.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[3] hold: a mark put on a checkout [2] by whoever starts the agent, saying more work comes on its branch after the agent; a publish from it that asks for the merge arms nothing.
[4] held merge: a pull request whose merge a publish asked for under a hold [3]: recorded as wanted, and armed only by a release (`publish.ts`).

## Business logic — TL;DR

- **The hold lives with the checkout** - an empty file in the checkout's private git directory: out of git's sight, and gone with the checkout.
- **The record lives with the project** - an empty file `.branches/merge-held/<number>` per held merge [4]: out of git's sight, and outliving the checkout.
- **The held line** - the one line a held request's body carries for a person, added once at the end and taken out by the release.

## Business logic

### The hold lives with the checkout

#### Context

**Business logic story**: the scheduler puts the hold [3] on a checkout [2] before the agent [1] starts in it; the agent's publish reads it.

#### Business logic

Putting the hold on a checkout [2] writes an empty file named `branches-merge-hold` in the checkout's own git directory, the private one git keeps for each worktree. A checkout is under a hold exactly when that file exists. Nothing in this file removes the hold: it goes when the checkout is removed.

### The record lives with the project

#### Context

**Problem**: the release comes after the checkout [2] the agent published from is gone, so the fact "this request's merge is wanted" cannot live in the checkout.

#### Business logic

Recording a held merge [4] writes an empty file named as the pull request's number under the project's `.branches/merge-held/`, creating the directory when missing. A request's merge is held exactly when its file exists. Dropping the record removes the file, and dropping one that is not there is not an error. `merge-held` is not a checkout name, so nothing that lists checkouts lists it.

### The held line

#### Context

**User story**: a person looking at the pull request on GitHub sees why it has not merged although its checks passed.

#### Business logic

The held line is `**Merge held:** more work comes on this branch first; the merge is armed once it is done.` Adding it to a body: a body that already has the line as one of its lines (surrounding whitespace ignored) is kept as it is; an empty body becomes the line alone; any other body keeps its text, trailing whitespace dropped, followed by a blank line and the line. Taking it out: every line that is the held line (surrounding whitespace ignored) goes, runs of blank lines left behind collapse to one blank line, and trailing whitespace goes.
