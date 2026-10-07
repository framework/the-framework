Reads an agent's [1] files for the Files module's side-rail tab on the agent's page, for as long as git still holds them: from the agent's checkout [2] while it exists, then from the agent's branch, then from the commit its pull request merged as, or, for a subagent [6] its main agent landed, from the last commit its record kept. It answers the tree of files with each file the agent changed marked, whether all the agent changed is merged, one changed file's diff, one unchanged file's content, and the commits of the agent's work, each with what it alone changed, all from the same source. An agent's record says the commit its own work begins at. An agent started from a branch other than the default one (a subagent starts from its main agent's branch) is measured from that commit, so the other branch's work is not marked as its own; so is an agent whose work the default branch already contains, so what it changed is still marked. An agent that finished on this machine [4], with none of those sources left and no recorded pull request, changed nothing, and its answer is the project's default branch with nothing marked. When none of the three is left otherwise, the answer is that the agent's changes are gone.

## Context

**User story**: the user opens an agent that finished yesterday to see what it changed. Its checkout was reclaimed after it ended, but the change is still in git: on its branch, or, once the branch is deleted, in the commit its pull request merged as. The Files tab shows that change, and says where it read it from.

**Problem**: the tab used to read the agent's checkout and, once the checkout was gone, fall back to the project's own checkout with nothing marked. That reads as "this agent touched nothing", or as a bug.

**Business logic story**: an agent works on branch `fix-login`, commits two files, and its pull request #42 is squash-merged; the checkout is reclaimed. While the branch `fix-login` still exists, the tab shows the project's files at the branch's last commit, the two files marked, captioned "From branch fix-login". Once the branch is deleted, the tab shows the files at the squash commit, the same two files marked, captioned "From the merge of #42". Another agent finished `done` on this machine without opening a pull request: when its checkout was reclaimed, its branch was deleted with it because origin already had everything on it, so the tab shows the project's files on the default branch, nothing marked, captioned "This run changed no files". The same agent read from the user's other machine, which never saw its branch, says its changes are gone from that machine. A third agent opened pull request #50, which was merged on the git host after this machine last fetched, and its branch is deleted: the tab says its changes are gone from this machine.

**Business logic story**: a main agent on branch `agent-plan` commits `plan.txt` and starts a subagent [6] from that branch; the subagent commits `part.txt`. The subagent's record names the commit of `agent-plan` its branch was made from. In the subagent's checkout, and later on its branch, the tab marks `part.txt` only: measured from the default branch, `plan.txt` would be marked too, as if the subagent had written it. The main agent lands the subagent: its work is merged into `agent-plan`, its branch is deleted, and its record keeps its last commit. The tab now shows the files at that commit, `part.txt` marked, captioned "From its last commit, landed on its main agent’s branch", and still does once `agent-plan` is squashed and deleted.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory. The user's own working copy is the project's checkout.
[3] fork point: the commit an agent's changes are measured from: the commit where the agent's last commit left the project's default branch (origin's `HEAD`, else a local `main`, else a local `master`), or the commit where it left the commit the agent's record names as where its own work begins (`baseCommit`, on the record of every agent that made its own branch), when this machine has that commit. Which of the two is said under "Measured from where the agent's own work begins". An agent's changes are what differs between the fork point and the agent's last commit.
[4] finished on this machine: said of an agent whose record names this machine's hostname as its `host` and whose status is `done`, `failed` or `stopped`, the endings its own tool records (a Stop included), or that the sweep records only for an agent that left no checkout, and that recorded no pull request and was not landed by a main agent. A record with any other status, or with no status or no `host`, has not. The dashboard judges it, not this module: it hands the answer over as one of the agent's facts [5].
[5] the agent's facts: what the dashboard tells a module's server part about one agent when asked: its checkout while it has one, its record (status, machine, branch, pull request number, the commit its own work begins at, and the last commit of its work once its main agent landed it), and whether it finished on this machine [4]; and, on request, the commit a pull request of a branch merged as, with the last commit of the branch it merged when the git host says it, or that the git host is still being asked.
[6] subagent: an agent another agent, its main agent, started for one task, on a branch started from the main agent's. It opens no pull request: its main agent lands its work, which merges it into the main agent's branch, deletes the subagent's branch, and writes the subagent's last commit on its record (`skill-orchestration`).

## Business logic — TL;DR

- **Where the files are read from** - the checkout the agent's facts [5] name; else the branch the agent recorded, this machine's copy first, then origin's copy; else the commit the agent's recorded pull request merged as; else, for a subagent [6] its main agent landed, the last commit its record kept; else, for an agent that finished on this machine [4], the default branch with nothing marked; else, for an agent starting on this machine (the dashboard does not know it yet, or it is recorded `running` here with no checkout yet), the branch its record says it was told to start from, else origin's default branch, with nothing marked, since its checkout is made from it (the project's HEAD in a repository with no remote); else, for one recorded `running` on another machine, pending; else gone. Nothing is fetched and nothing is copied.
- **A branch already merged into the default branch** - it shows no change against the default branch, so the merge commit is read instead when this machine has it.
- **Measured from where the agent's own work begins** - an agent whose record names the commit its own work begins at is measured from that commit, in its checkout, on its branch and at its landed commit; a commit this machine does not have is ignored, and the default branch is measured from.
- **What is marked** - in a checkout, what the agent committed since the fork point [3] and what is on disk uncommitted, apart; on a branch, what changed since the fork point; at a merge commit, that commit's own change; at a landed commit, what changed since the fork point.
- **Whether the agent's work is merged** - yes only when the agent changed something and all of it is merged: the default branch has its last commit, or its pull request merged at that very commit, with nothing left uncommitted in its checkout; a merge commit and a landed commit are merged by what they are.
- **What is listed** - every file at the source's last state, plus the files the agent deleted while its work is not merged.
- **An agent that changed nothing** - an agent that finished on this machine [4] with no checkout, no branch and no pull request left nothing to lose, so the default branch's files are listed, nothing marked, with no diff for any file; an agent from another machine, or one with any status but `done` or `failed`, is never judged so.
- **One file's diff and content** - read from the same source as the tree, so the preview shows the change the tree marked.
- **The commits of an agent's work** - the commits between the fork point [3] and the source's last commit, newest first, 200 at most; one of them read alone answers what that commit changed against the commit before it, and one file's diff in it; a commit that is not one of them is never read.
- **Still looking** - while the agent's pull request is still being looked up and there is no branch to show, the answer is that it is not known yet.

## Business logic

### Where the files are read from

#### Context

See `## Context`.

#### Business logic

The sources are tried in this order, and the first one that exists answers:

1. The agent's checkout [2], as the agent's facts [5] name it, while its directory is there. The project's root is never used in its place. A checkout named a moment ago may have been reclaimed since, as the agent ended: it is then no source, and the agent is not starting either, so where nothing below answers, the answer is pending rather than starting, and never an empty tree.
2. The branch the agent recorded: this machine's branch of that name, else origin's copy of it (`origin/<branch>`) as this machine last fetched it.
3. The commit the agent's pull request merged as. The agent must have recorded a pull request. The dashboard is asked which commit that pull request, by its number, of the agent's branch merged as, and it must name one. That commit must be on this machine: a pull request merged on the git host after this machine last fetched is not read yet.
4. The commit the agent's record kept when its main agent landed it (`landed`), for a subagent [6] whose branch is gone. That commit must be on this machine.
5. The project's default branch [3], as its last commit on this machine, when the agent finished on this machine [4]: the agent changed nothing (see "An agent that changed nothing").
6. Starting: an agent with neither a checkout nor a record, and one recorded `running` on this machine: its checkout is being made, seconds after its page opened, from origin's default branch (`agent-data`'s rule: origin's `HEAD`, else `origin/main`, else `origin/master`; the project's HEAD in a repository with none), so that commit's files are its files, nothing marked. When the record of the one recorded `running` here names the branch it was told to start from (`base`: a person's local branch picked in the launcher, or a subagent's main agent's branch), its checkout is being made from that branch instead, so that branch's last commit is read, as this clone has it; a branch named that this clone does not have is pending: the agent fails on it, and a later read says so. Nothing is fetched: this clone's copy is read. One recorded `running` on another machine is pending instead: its branch is not here yet. Asked again, a later read finds the checkout or the branch.
7. Gone: an agent that did not finish on this machine, including one `waiting`, one from another machine and one whose record names no machine; an agent with a recorded pull request whose branch and merge commit are not on this machine; a landed subagent whose landed commit is not on this machine, which is never read as having changed nothing; and an agent for which no default branch is found.

Nothing is ever fetched: the tab polls, and a fetch on every poll would be a network call. The git host is asked through the dashboard, which keeps its answers in the shared cache its other pull request reads use.

### A branch already merged into the default branch

#### Context

**Problem**: a branch merged with a true merge commit (not squashed) is contained in the default branch. For an agent whose record does not name where its own work begins, its fork point [3] is then its own last commit, and it shows no change at all.

#### Business logic

When the branch's fork point is the branch's own last commit, the merge commit is read instead, if the agent has a pull request whose merge commit is on this machine. Otherwise the branch still answers, with nothing marked. An agent whose record names where its own work begins never comes here with work of its own: its fork point is that commit, and its branch answers with its changes marked.

### Measured from where the agent's own work begins

#### Context

**Problem**: a subagent's [6] branch is made from its main agent's branch, so beyond the default branch it holds the main agent's work as well as its own. Measured from the default branch, every file the main agent changed before it started the subagent would be marked as the subagent's change.

**Problem**: once an agent's work is merged, the default branch contains its last commit. Measured from the default branch, nothing the agent changed would be marked.

**Problem**: an agent that took the default branch in since it started (a merge or a rebase) holds, past the commit its work begins at, the default branch's newer changes. Measured from that commit, those would be marked as the agent's.

#### Business logic

When the agent's record names the commit its own work begins at (`baseCommit`, written by the tool that started the agent), and this machine has that commit, the fork point [3] is one of two commits: where the agent's last commit left the default branch, or where it left the recorded commit.

- The default branch already contains the agent's last commit (its work is merged): where it left the recorded commit, so what the agent changed is still marked.
- The agent left the default branch before the recorded commit (it started from another branch): where it left the recorded commit, so the other branch's files are not marked.
- Otherwise: where it left the default branch, so what the agent took in from the default branch since it started is not marked as its own.

This holds for all three sources that have a fork point: the checkout, the branch, and the landed commit. A record that names no such commit, or one this machine does not have, is measured from the default branch alone: another branch's files are then marked too, and merged work is not marked.

### What is marked

#### Context

**User story**: in a live agent's checkout, the user tells the work the agent committed from the edits it has not committed yet.

#### Business logic

Each changed file is marked added, untracked, modified or deleted, and committed or not:

- In a checkout: every file that differs between the fork point [3] and the checkout's last commit is marked committed (added, modified or deleted). Every file `git status` reports is marked not committed (untracked, modified or deleted). A file marked both keeps the uncommitted mark, because that is what the file is on disk now.
- On a branch: every file that differs between the fork point and the branch's last commit, all committed.
- At a merge commit: every file that differs between the merge commit's first parent and the merge commit, all committed. The first parent is the default branch before the merge, for a squash commit and a true merge commit alike.
- At a landed commit: every file that differs between the fork point and the landed commit, all committed.
- A renamed file is marked as the old path deleted and the new path added.
- With no fork point (no default branch found), a checkout marks only its uncommitted files and a branch marks nothing.

### Whether the agent's work is merged

#### Context

**User story**: the Files tab's marks say what is waiting: work that is not merged yet. Once an agent's work is merged the user sees a plain tree, and reads what the agent changed in the Changes tab, which keeps the list.

**Problem**: a pull request merged by a squash leaves the agent's branch outside the default branch, so git alone never says that branch is merged. And an agent may commit again after its pull request merged: that commit is not merged.

#### Business logic

The answer for a checkout, a branch, a merge commit and a landed commit says whether the agent's work is merged. It is merged only when the agent changed something (at least one file is marked) and all of it is merged:

- In a checkout: the default branch [3] contains the checkout's last commit, and nothing is uncommitted on disk. Uncommitted work is in no branch.
- On a branch: the default branch contains the branch's last commit; or the agent's recorded pull request merged, and the last commit of the branch it merged, as the git host says it, is the branch's last commit. A pull request whose merged branch ended at another commit, or for which the git host names no such commit, says nothing: the branch is not merged. Neither does a lookup still out.
- At a merge commit and at a landed commit: merged, by what they are.

An agent that changed nothing has nothing merged. For an agent with a recorded pull request and a branch, the dashboard is asked about the pull request before the branch is read, through its shared cache.

The changes are answered the same whether or not they are merged: only the Files tab stops marking them.

### What is listed

#### Context

See `## Context`.

#### Business logic

A checkout lists every file git sees in it, tracked and untracked, honoring the ignore rules. A branch, a merge commit or a landed commit lists every file in that commit. While the agent's work is not merged, the files the agent deleted are added to the list, so a deletion stays visible in the tree; once it is merged they are not, since nothing is marked in that tree. The list is sorted by path.

### An agent that changed nothing

#### Context

**Problem**: an agent that ended `done`, `failed` or `stopped` through its own tool recorded its branch's last name as it ended. On this machine, the branches rule deletes an ended agent's branch together with its checkout only when the remote already has everything on it: the branch's last commit is contained in another of origin's branches. So an agent that finished on this machine [4] with no checkout, no branch and no pull request left nothing it changed to lose, and saying its changes are gone would suggest work was lost. An agent the sweep recorded `stopped` after its process died left no checkout, so it had nowhere to keep a change. An agent from another machine may simply have a branch this machine never saw, so for it the answer stays gone. The rule is the dashboard's own, the one its handoff read uses (`agent-handoff.ts` in OpenAgent, "An agent that changed nothing"); this module is only told its answer, as one of the agent's facts [5].

#### Business logic

It applies only to an agent that finished on this machine [4], with no checkout, no branch ref of its recorded branch (local or origin's copy) or no recorded branch at all, no recorded pull request, and no landed commit on its record: a landed subagent's [6] branch went because its work moved to its main agent's branch, not because it held nothing. The answer lists every file in the default branch's [3] last commit, and marks nothing. Every file's content is read from that commit, as on a branch; no file has a diff.

### One file's diff and content

#### Context

**User story**: hovering a marked file shows its diff; hovering an unmarked one shows its content, as the agent left it.

#### Business logic

The diff (the capping and counting rules are `diff.ts`'s):

- In a checkout, a file changed on disk diffs against the checkout's last commit, as it always has. A file changed only by the agent's commits diffs from the fork point [3] to the checkout's last commit.
- On a branch, from the fork point to the branch's last commit. At a merge commit, from its first parent to the merge commit. At a landed commit, from the fork point to the landed commit.
- A file the source did not change has no diff, and neither does an unsafe path (`read.ts`'s rule).

The content: in a checkout, the file on disk (`read.ts`). On a branch, at a merge commit, at a landed commit, or on the default branch for an agent that changed nothing, the file as that commit holds it, capped at 500 lines, flagged binary when it holds a NUL byte, and nothing for an unsafe path or a path the commit does not hold.

When the agent's changes are gone, or still being looked up, there is no diff and no content.

### The commits of an agent's work

#### Context

**User story**: the Changes tab lists an agent's commits under its changed files; a click on one shows what that commit alone changed (`../dashboard/ChangesPanel.tsx`).

**Problem**: the read names a commit by its id, and the id comes from the browser. Answered for any id, the read would show any commit of the repository as if it were the agent's.

#### Business logic

The list of commits is read from the same source as the tree:

- In a checkout: the commits from the fork point [3] to the checkout's last commit. On a branch, at a merge commit and at a landed commit: from the fork point to that commit (at a merge commit the fork point is its first parent, so a squash merge lists the squash commit alone).
- Newest first, the newest 200 at most. Each commit carries its full id, its short id, its subject, its author's name and the time it was committed.
- Uncommitted work is in no commit, so a checkout's list may hold less than its tree marks.
- No commits are listed for an agent that changed nothing, one that is starting, one whose changes are still looked up or gone, and a source with no known fork point. A failed git read lists none.

One commit read alone:

- It is read only when its id is a full 40-character commit id and is one of the commits between the fork point and the source's last commit. For any other id (another commit of the repository, a branch name, a short id) the answer is nothing.
- What it changed: each file that differs between the commit before it (its first parent) and it, marked added, modified or deleted, and committed. A commit with no parent is measured from an empty tree, so every file it holds is added.
- One file's diff in it: the diff of that file between the commit before it and it. A path the commit did not change has no diff, and neither does an unsafe path (`read.ts`'s rule).

### Still looking

#### Context

**Problem**: the first read of an agent's pull requests is a git host call that may take longer than the tab waits. Answering "gone" in the meantime would flash a false line.

#### Business logic

When the agent has a recorded pull request, has no branch on this machine, and the dashboard says the git host has not answered about the branch's pull requests at all yet, the answer is that it is not known yet. The next poll has the answer.
