Reads an agent's [1] files for the agent page's Files tab, for as long as git still holds them: from the agent's checkout [2] while it exists, then from the agent's branch, then from the commit its pull request merged as. It answers the tree of files with each file the agent changed marked, one changed file's diff, and one unchanged file's content, all from the same source. An agent that finished on this machine [4], with none of the three left and no recorded pull request, changed nothing, and its answer is the project's default branch with nothing marked. When none of the three is left otherwise, the answer is that the agent's changes are gone.

## Context

**User story**: the user opens an agent that finished yesterday to see what it changed. Its checkout was reclaimed after it ended, but the change is still in git: on its branch, or, once the branch is deleted, in the commit its pull request merged as. The Files tab shows that change, and says where it read it from.

**Problem**: the tab used to read the agent's checkout and, once the checkout was gone, fall back to the project's own checkout with nothing marked. That reads as "this agent touched nothing", or as a bug.

**Business logic story**: an agent works on branch `fix-login`, commits two files, and its pull request #42 is squash-merged; the checkout is reclaimed. While the branch `fix-login` still exists, the tab shows the project's files at the branch's last commit, the two files marked, captioned "From branch fix-login". Once the branch is deleted, the tab shows the files at the squash commit, the same two files marked, captioned "From the merge of #42". Another agent finished `done` on this machine without opening a pull request: when its checkout was reclaimed, its branch was deleted with it because origin already had everything on it, so the tab shows the project's files on the default branch, nothing marked, captioned "This run changed no files". The same agent read from the user's other machine, which never saw its branch, says its changes are gone from that machine. A third agent opened pull request #50, which was merged on the git host after this machine last fetched, and its branch is deleted: the tab says its changes are gone from this machine.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory. The user's own working copy is the project's checkout.
[3] fork point: the commit where an agent's branch left the project's default branch: the default branch is origin's `HEAD`, else a local `main`, else a local `master`. An agent's changes are what differs between the fork point and the agent's last commit.
[4] finished on this machine: said of an agent whose record names this machine's hostname as its `host` and whose status is `done`. A record with any other status, or with no status or no `host`, has not.

## Business logic — TL;DR

- **Where the files are read from** - the checkout the branches provider lists for the agent; else the branch the agent recorded, this machine's copy first, then origin's copy; else the commit the agent's recorded pull request merged as; else, for an agent that finished on this machine [4] and recorded no pull request, the default branch with nothing marked; else gone. Nothing is fetched and nothing is copied.
- **A branch already merged into the default branch** - it shows no change against the default branch, so the merge commit is read instead when this machine has it.
- **What is marked** - in a checkout, what the agent committed since the fork point [3] and what is on disk uncommitted, apart; on a branch, what changed since the fork point; at a merge commit, that commit's own change.
- **What is listed** - every file at the source's last state, plus the files the agent deleted.
- **An agent that changed nothing** - an agent that finished on this machine [4] with no checkout, no branch and no pull request left nothing to lose, so the default branch's files are listed, nothing marked, with no diff for any file; an agent from another machine, or one with any status but `done`, is never judged so.
- **One file's diff and content** - read from the same source as the tree, so the preview shows the change the tree marked.
- **Still looking** - while the agent's pull request is still being looked up and there is no branch to show, the answer is that it is not known yet.

## Business logic

### Where the files are read from

#### Context

See `## Context`.

#### Business logic

The sources are tried in this order, and the first one that exists answers:

1. The agent's checkout [2], as the project's branches provider lists it for the agent's id. The project's root is never used in its place.
2. The branch the agent recorded: this machine's branch of that name, else origin's copy of it (`origin/<branch>`) as this machine last fetched it.
3. The commit the agent's pull request merged as. The agent must have recorded a pull request. That pull request is found by its number among the branch's pull requests on the git host, and it must say which commit it merged as. That commit must be on this machine: a pull request merged on the git host after this machine last fetched is not read yet.
4. The project's default branch [3], as its last commit on this machine, when the agent finished on this machine [4] and recorded no pull request: the agent changed nothing (see "An agent that changed nothing").
5. Gone: an agent with no record; an agent that did not finish on this machine, including one `running`, `waiting`, `failed` or `stopped`, one from another machine and one whose record names no machine; an agent with a recorded pull request whose branch and merge commit are not on this machine; and an agent for which no default branch is found.

The daemon never fetches: the tab polls, and a fetch on every poll would be a network call. The git host's list of the branch's pull requests is read through the shared cache the other pull request reads use.

### A branch already merged into the default branch

#### Context

**Problem**: a branch merged with a true merge commit (not squashed) is contained in the default branch. Its fork point [3] is then its own last commit, and it shows no change at all.

#### Business logic

When the branch's fork point is the branch's own last commit, the merge commit is read instead, if the agent has a pull request whose merge commit is on this machine. Otherwise the branch still answers, with nothing marked.

### What is marked

#### Context

**User story**: in a live agent's checkout, the user tells the work the agent committed from the edits it has not committed yet.

#### Business logic

Each changed file is marked added, untracked, modified or deleted, and committed or not:

- In a checkout: every file that differs between the fork point [3] and the checkout's last commit is marked committed (added, modified or deleted). Every file `git status` reports is marked not committed (untracked, modified or deleted). A file marked both keeps the uncommitted mark, because that is what the file is on disk now.
- On a branch: every file that differs between the fork point and the branch's last commit, all committed.
- At a merge commit: every file that differs between the merge commit's first parent and the merge commit, all committed. The first parent is the default branch before the merge, for a squash commit and a true merge commit alike.
- A renamed file is marked as the old path deleted and the new path added.
- With no fork point (no default branch found), a checkout marks only its uncommitted files and a branch marks nothing.

### What is listed

#### Context

See `## Context`.

#### Business logic

A checkout lists every file git sees in it, tracked and untracked, honoring the ignore rules. A branch or a merge commit lists every file in that commit. The files the agent deleted are added to the list, so a deletion stays visible in the tree. The list is sorted by path.

### An agent that changed nothing

#### Context

**Problem**: an agent that finished `done` recorded its branch's last name as it ended. On this machine, the branches rule deletes an ended agent's branch together with its checkout only when the remote already has everything on it: the branch's last commit is contained in another of origin's branches. So an agent that finished on this machine [4] with no checkout, no branch and no pull request left nothing it changed to lose, and saying its changes are gone would suggest work was lost. An agent from another machine may simply have a branch this machine never saw, and a `failed` or `stopped` agent (such as one the sweep recorded after a crash) may have renamed its branch without its record learning the new name, so for them the answer stays gone.

#### Business logic

It applies only to an agent that finished on this machine [4], with no checkout, no branch ref of its recorded branch (local or origin's copy) or no recorded branch at all, and no recorded pull request. The answer lists every file in the default branch's [3] last commit, and marks nothing. Every file's content is read from that commit, as on a branch; no file has a diff.

### One file's diff and content

#### Context

**User story**: hovering a marked file shows its diff; hovering an unmarked one shows its content, as the agent left it.

#### Business logic

The diff (the capping and counting rules are `file-diff.ts`'s):

- In a checkout, a file changed on disk diffs against the checkout's last commit, as it always has. A file changed only by the agent's commits diffs from the fork point [3] to the checkout's last commit.
- On a branch, from the fork point to the branch's last commit. At a merge commit, from its first parent to the merge commit.
- A file the source did not change has no diff, and neither does an unsafe path (`file-read.ts`'s rule).

The content: in a checkout, the file on disk (`file-read.ts`). On a branch, at a merge commit, or on the default branch for an agent that changed nothing, the file as that commit holds it, capped at 500 lines, flagged binary when it holds a NUL byte, and nothing for an unsafe path or a path the commit does not hold.

When the agent's changes are gone, or still being looked up, there is no diff and no content.

### Still looking

#### Context

**Problem**: the first read of an agent's pull requests is a git host call that may take longer than the tab waits. Answering "gone" in the meantime would flash a false line.

#### Business logic

When the agent has a recorded pull request, has no branch on this machine, and the lookup of its branch's pull requests has not answered yet, the answer is that it is not known yet. The next poll has the answer.
