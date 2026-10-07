Implements a branch of the project's repository used as a file store: files that programs read and write and nobody edits in a working copy, the way `gh-pages` holds a site, kept on a branch of their own so that no code commit is ever in their history. In the product that branch is the `agent-data` branch [1]; the caller names it, and this module knows git, not what the files mean. Two writers share one rule: a long-lived process (the daemon) writes through the branch's persistent checkout [2] under `.branches/<branch>` in a write cycle [3] (sync, apply, commit, push), and a command an agent [4] runs writes one-shot from any clone through a throwaway checkout of origin's tip; both treat the change as an intent that is re-applied when the push loses a race, and neither ever force-pushes. The branch leaves the machine only once the person turned sharing [9] on for the repository: until then nothing is fetched from origin and nothing is pushed to it, and both writers commit on this machine.

## Context

**User story**: an agent [4] runs `npx tickets`, `npx queue` or `npx logs` from its own checkout [2], on the user's machine or in a cloud session [5], and sees the tickets, the agent queue [6] and the runs [7] every other machine pushed; the daemon's own records are on the remote a moment after they are written; the user's own branches and tracked files never change, and the user never sees a diff. All of that holds for a repository whose records the user shares; a user who has not said the records may go to the remote finds nothing of the branch there, and the same commands read and write the branch on this machine.

**Business logic story**: every skill package hands this module a change to apply to a directory and a commit message; this module owns the branch, its checkout, syncing, committing, pushing, and reading. "origin's copy of the branch" below means what the repository last fetched of the branch from its `origin` remote.

**Problem**: several machines and cloud sessions write one branch with no coordinator. A stale commit force-fitted onto the branch would erase another writer's change, a change left half written in the checkout would ride the next unrelated commit, and a hung git call would hold the daemon.

## Glossary

[1] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs. Born as an orphan, written through one sync → commit → push cycle.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. Also "the `agent-data` branch's checkout".
[3] write cycle: one write to the branch through its persistent checkout: sync with origin, apply the caller's change, commit, push; the change is re-applied when the push loses a race.
[4] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[5] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[6] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[7] run: the `logs` skill's record of one agent on the `agent-data` branch: a card and a diary. Never the unit of work.
[8] one-shot write: a write to the branch from any clone by a command that holds no checkout of the branch: a throwaway checkout of origin's tip is created, the change applied, committed and pushed, and the checkout removed. When the branch does not reach origin [9], the same write is a write cycle [3] that ends in a local commit.
[9] sharing: the person's yes that the repository's branches kept here may leave the machine: the git setting `agent-data.share` in the repository's own git config, off while unset. A branch "reaches origin" when the repository has an `origin` remote and sharing is on; otherwise it "stays on this machine", for one of two reasons: `no-remote` (no `origin`) or `kept` (an `origin`, and sharing off).

## Business logic — TL;DR

- **The branch's checkout, hidden from git** - the branch is checked out once per clone at `<repository>/.branches/<branch>`, `<repository>` being the clone's own directory whichever of its worktrees asks, registered with git as a worktree, and hidden through git's own ignore file rather than a committed `.gitignore`; a checkout found off its branch is put back on it, keeping what it holds, and is never made a second time.
- **Adopted from origin or born an orphan** - a branch missing locally is taken from origin's copy; missing there too, it is born from the empty tree with the commit "create the <branch> branch", so no code commit is ever an ancestor.
- **The repository's config is never written** - a branch taken from origin's copy, on adoption or when a conflict resolves toward origin, is set up without tracking: tracking writes the repository's shared config, and its lock would fail a coding agent's own `git config` or `git push -u` running at that moment in another checkout of the clone. Nothing here reads the upstream; every fetch, rebase and push names `origin` and the branch.
- **Only `origin` is the remote** - every fetch and push names `origin`; a repository without it is remote-less whatever other remotes it has.
- **Shared only on the person's word** - one git setting of the repository, off until the person turns it on, decides whether the branch leaves the machine; while it is off, or while there is no `origin`, nothing is fetched and nothing is pushed, and every operation works on this machine's copy.
- **One write at a time** - writes and pulls to one branch of one repository run one after another, never interleaved: within a process in the order requested, and across every process on the clone through the checkout's lock file (the rule in `checkout-lock.ts`); a write that waits past the lock's wait fails without touching the checkout.
- **The write cycle** - sync with origin, apply the change to the checkout, commit whatever changed under the caller's message, push whenever the branch is ahead of origin's copy.
- **Sync: rebase onto origin, and origin wins a conflict** - unpushed local commits are rebased onto origin's copy; when the rebase fails, the branch is checked out again at origin's copy and those commits are dropped, unreported; whatever the rebase did, the checkout ends on the branch.
- **A push that loses a race re-applies the change once** - the attempt's commit is wound back, the cycle re-syncs and re-applies; a second failed push keeps the commit local and reports it, for the next cycle to carry out; never a force push.
- **A git command outside the lock is waited out** - git's refusal to take a lock of the checkout, its index or the branch's ref, which a git command run in the checkout outside this module causes, resets the checkout, waits half a second and runs the cycle again, three times at most.
- **A failed change leaves the checkout clean** - any other failure, a timeout included, resets the checkout to its last commit, removes stray files, and is reported rather than thrown.
- **The pull** - a write cycle with no change, run on the daemon's clock so this machine converges on what others pushed and pushes what an earlier cycle left stranded; it answers how far the branch reaches, so a branch that stays on this machine is a fine pull that says why, not an error.
- **Reads from anywhere, and never a failure** - a file or a directory listing is read off the checkout, the local branch, or origin's copy, from any directory of the repository, an agent's checkout included; whatever is missing reads as absent.
- **A one-shot reader opens the branch once** - one fetch, then every read off origin's copy, so a command sees every writer's pushes, its own one-shot writes included; with no fetch, the local branch when the branch stays on this machine, or the copy of origin's the clone already holds when it never made the local branch.
- **The one-shot write from any clone** - a throwaway checkout of origin's tip, applied, committed, pushed straight to the branch and removed; it never touches the persistent checkout nor moves the local branch; when the branch stays on this machine it is a write cycle instead, ending in a local commit.
- **A change sees plain files** - the change is handed a directory and reads, writes, deletes and lists plain files in it; a write creates missing parent directories.
- **The branch taken off this machine** - for a person who removes a project with its files: the branch's persistent checkout, then the local branch, are removed, then the checkouts directory `.branches` and the rule hiding it when that left the directory empty; origin's copy is never touched and nothing is pushed first, so commits that never reached origin go with the branch; only from the clone's own directory; a folder git does not know as the checkout stays; where there is neither checkout nor branch nothing is touched; the sharing [9] answer is forgotten by a call of its own.

## Business logic

### The branch's checkout, hidden from git

#### Context

**Problem**: the project's own tracked files must never change because of the file store, and a per-worktree ignore file looks right but is silently never read by git.

#### Business logic

The branch's persistent checkout [2] lives at `<repository>/.branches/<branch>` and is registered with git as a worktree of the project's repository, beside the agents' [4] own checkouts. `<repository>` is the directory holding the clone's real `.git`, whichever worktree of the clone the caller works in: git checks a branch out in one place per clone, so a process started from a second worktree of the clone (a person's own, beside the project's checkout) writes, pulls and reads through the same one checkout instead of being refused a second. Every operation through the checkout first checks that the directory is checked out on the branch and, when it is, does nothing more: the common case, taken on every write. A checkout git holds at that path but off its branch is put back on the branch, never made a second time (git refuses to make a worktree where a directory exists, and one detached checkout once failed every write that way until a person repaired it): a rebase left half done is abandoned first, which restores the branch when git still has that rebase's state; a checkout detached after that has the branch moved to what it holds, so a commit made while detached goes out with the next push; a checkout on another branch has the branch checked out again, and that other branch is left where it is. Only when git holds no checkout at the path (never made, or its directory deleted by hand) is the branch made to exist locally (next section), any stale worktree registration at that path pruned so that the add is not blocked, and the checkout created. The rule `/.branches` is then appended to git's own ignore file, `info/exclude` in the repository's common git directory (the rule in `git-exclude.ts`), never to a committed `.gitignore`: one line written once covers every worktree of the repository, and no tracked file changes. That last step is best effort: the checkout stands even when the rule could not be written. Making sure the branch and its checkout exist never fails loudly: a project this cannot be set up in reports why and is left alone.

### Adopted from origin or born an orphan

#### Context

**Problem**: a second history born on a machine while origin already has one would leave two unrelated branches to reconcile, and a branch started from a code commit would carry the whole code history.

#### Business logic

A branch missing locally is first looked for on origin: when the branch reaches origin [9] it is fetched (a failed fetch is ignored), and origin's copy, when this clone holds one, becomes the local branch. When the branch stays on this machine nothing is fetched, so only a copy the clone already holds (one that came with `git clone`, or was fetched while sharing was on) is adopted. When origin has no such branch either, the branch is born parentless from git's empty tree with the commit message "create the <branch> branch", which touches no checkout and gives the branch a history that shares no commit with any code branch. A branch born locally is pushed by its first write cycle [3] that reaches origin, even one whose change writes nothing, so origin gets it.

### Only `origin` is the remote

#### Context

See `## Context`.

#### Business logic

Every fetch and push names `origin`. A repository whose only remote has another name is remote-less to this module, whatever the sharing [9] setting says: its branch stays on this machine for the reason `no-remote`, with the outcomes of the next section instead of a push that fails twice.

### Shared only on the person's word

#### Context

**User story**: the user adds a repository whose remote other people can read. What they asked each agent [4] and what it answered is on the branch, so nothing of it goes to that remote until they say so; they can say so later, and take it back.

**Problem**: a branch pushed whenever the repository has an `origin` puts the records before everyone who can read the remote, in a repository the user may not own, with no question asked.

#### Business logic

Sharing [9] is one git setting, `agent-data.share`, in the repository's own git config, read and written through git. Every checkout of a clone shares that config, so a long-lived process and a command an agent [4] runs in its own checkout [2] read the same answer. Unset, unreadable, or anything but true reads as off. Turning it on or off writes the setting and does nothing else: the next operation is what meets origin, or stops meeting it.

How far the branch reaches is one of three answers: `origin` when the repository has an `origin` remote and sharing is on; `no-remote` when it has no `origin`, whatever the setting; `kept` when it has an `origin` and sharing is off. Every fetch and every push in this module asks that question first and goes out only for `origin`. Off means both ways: nothing is pushed to origin and nothing is fetched from it, so what another machine shared is not taken either.

While the branch stays on this machine: a write cycle [3] commits locally and reports success with nothing pushed; a sync does nothing; the pull succeeds and answers the reason; a read marked fresh and a one-shot reader fetch nothing and read the local branch, or, when the clone has none, the copy of origin's it already holds; a one-shot write [8] is a write cycle. Outside any repository the branch reaches no origin either, so a one-shot write there is a write cycle, which fails, and the failure is thrown.

Once sharing is turned on, the next write cycle or pull syncs with origin and pushes everything committed here while it was off, by the same owed-push rule as any stranded commit; a conflict with what origin holds resolves toward origin, as in every sync. Turned off again, later commits stay here and origin keeps what it was sent.

### One write at a time

#### Context

**Problem**: a writer and the pull that interleaved on one checkout would commit each other's half-written files under the wrong message. The daemon, the scheduler and each run are separate processes on one clone: a failed cycle of one resets the checkout, and the reset wipes the change another has written but not yet committed, whose commit then fails with nothing to commit and whose record is lost.

#### Business logic

Every write cycle [3], pull, and checkout setup for one branch of one repository runs one after another. Within one process they run in the order requested: the next waits for the previous to finish, and a failed one does not block the ones behind it. Across processes on the clone, each one first takes the checkout's lock file (the rule in `checkout-lock.ts`) and lets go of it when done, so a process waits while another is in the checkout. A process that cannot take the lock within the wait fails that write or setup with the reason, without touching the checkout, and the next one tries again.

### The write cycle

#### Context

See `## Context`.

#### Business logic

A write cycle [3] applies one change through the persistent checkout [2], in this order:

- The checkout is made to exist.
- The checkout is synced with origin (next section).
- The caller's change runs against the checkout directory.
- Everything the checkout now differs by is staged, new files included, and committed when anything changed, under the caller's message: a fixed text, or a text computed after the change ran, since a batch only knows what it did once done.
- When the branch does not reach origin [9], the cycle ends here: success, saying whether anything changed, with nothing pushed.
- When it does, a push is owed whenever the local branch is ahead of origin's copy: this cycle's commit, an earlier cycle's commit the sync just rebased, or a branch origin does not have yet. When nothing is owed the cycle ends with nothing changed and nothing pushed; otherwise the branch is pushed to `origin` under its own name, never with force.

The outcome reports whether the change changed anything and whether a push went out, or a failure with its reason and whether the change still landed as a local commit.

### Sync: rebase onto origin, and origin wins a conflict

#### Context

**Problem**: a commit an earlier cycle could not push must not block every later write, and a conflict between it and what another machine pushed has no human to resolve it.

#### Business logic

When the branch does not reach origin [9], a sync does nothing. When it does, the branch is fetched from origin (a fetch that fails, the network being down, is ignored) and, when origin's copy exists, every unpushed local commit is rebased onto it. When the rebase fails for any reason, a conflict included, it is aborted and the branch is checked out again at origin's copy, with the checkout [2] attached to it: the remote wins, every unpushed local commit is dropped without a report, and only the change of the current cycle is applied afterwards, against origin's state. Whatever the rebase did, the checkout ends on the branch: a rebase moves the branch onto origin's copy as its last step and keeps the checkout detached until then, so when another process on this clone holds the branch's lock at that instant, git fails there and leaves the checkout detached, and the abort meets the same lock. A plain reset would keep it detached: the cycle's commit would land on no branch, and the push, which sends the branch, would carry nothing while reporting no failure. Because the change is applied after the sync, an intent such as "append this entry" lands on top of the other machine's version rather than on the stale local one.

### A push that loses a race re-applies the change once

#### Context

**Problem**: two writers pushing the same branch cannot both land; the loser must neither force its stale commit over the winner's nor apply its change twice.

#### Business logic

The change is an intent and the commit only its serialization, so the caller's change must be safe to run again. When the push fails on the first attempt, the attempt's commit is wound back to the tip the cycle started from (when a commit was made), the cycle syncs again, bringing in what the other writer pushed, and runs the change again against the fresher files, so the change lands exactly once. When the push fails on the second attempt too (the network, most likely), the commit stays local in the checkout [2] and the cycle reports the failure as "the <branch> branch could not be pushed: <git's reason>", marked as committed: the next write cycle [3] or pull rebases that commit onto whatever origin has by then, and its push carries it out together with the new change. A push killed on its time budget counts as a failed push and may have landed anyway; the next sync's rebase absorbs a commit origin already has. The branch is never force-pushed.

### A git command outside the lock is waited out

#### Context

**Problem**: a git command run in the checkout outside this module (a person's own, or a process built before the checkout's lock file) does not take the lock, and git refuses a cycle that meets it with "Unable to create '…/index.lock': File exists", or with "cannot lock ref 'refs/heads/<branch>'" when both touch the branch itself, rather than waiting.

#### Business logic

When a cycle fails with git's refusal to take a lock, the index's or the branch's, the checkout is reset as for any failure (next section), the cycle waits half a second and runs again, the change included, up to three more times. A lock that never lifts is then reported as the failure it is.

### A failed change leaves the checkout clean

#### Context

**Problem**: files a change left half written would be swept into the next cycle's commit, under an unrelated message, by the staging of everything.

#### Business logic

When anything else fails inside the cycle, the change itself, a git call that fails, or a git call killed on its time budget (the budgets are the rule in `git.ts`), the checkout [2] is reset to its last commit and every file not under version control is removed, so nothing half written survives; the failure is reported with its reason and marked as not committed. A write cycle [3] never throws: its callers run on the daemon's clock with nothing to catch it.

### The pull

#### Context

**User story**: a machine that writes nothing still shows the tickets, the agent queue [6] and the runs [7] other machines and cloud sessions [5] pushed, without waiting for its next local write.

#### Business logic

The pull is a write cycle [3] with an empty change and the commit message "sync", behind the same one-at-a-time rule: it creates the checkout [2] when needed, so a fresh clone converges on its first pull; syncs in what others pushed; and pushes anything an earlier failed cycle left stranded, by the same owed-push rule. It reports success together with how far the branch reaches [9] once it is done (`origin`, `no-remote` or `kept`), and an error with its reason when the cycle failed. A branch that stays on this machine has nothing to converge with: its pull is a success that answers why, and nothing is logged for it, so a caller can tell a repository that is not shared from a sync that broke. An error is also logged as "[branches] <branch>: <reason>". The pull never throws.

### Reads from anywhere, and never a failure

#### Context

**Problem**: an agent's [4] checkout holds none of the branch's files, and a read that could fail would turn every missing file into an error for every skill.

#### Business logic

A read starts by finding the repository a directory belongs to: the directory holding the real `.git`, which from an agent's [4] checkout [2] is the project's checkout the worktree was made from (worktrees share the repository's branches, so a read from an agent's checkout sees the same files without holding a copy). One file is read, in order, from the branch's persistent checkout on disk when this repository has one checked out on the branch and the file is there; else off the local branch; else off origin's copy of the branch (a clone that fetched but never branched, the cloud session's [5] case); it is absent when none of them has it. A read marked fresh, for a long-lived process about to act on the files where the local branch may trail what others pushed, skips the checkout: when the branch reaches origin [9] it fetches origin's copy first and reads it before the local branch, and otherwise it fetches nothing and reads the local branch first. A directory's entries are listed by name off the local branch, else off origin's copy, and are empty when neither has the directory. A missing file, a missing branch, a git that could not run, and a directory outside any repository all read as absent, never as a failure.

### A one-shot reader opens the branch once

#### Context

**Problem**: a command an agent [4] runs holds no checkout [2], and its own one-shot writes [8] go straight to the remote without moving the local branch, so only origin's copy has every writer's pushes.

#### Business logic

A one-shot reader picks one copy of the branch when it opens and reads every file and directory off it. When the branch reaches origin [9], it fetches the branch from origin once and reads origin's copy, or the local branch when origin's copy is not there (nothing ever fetched). When the branch stays on this machine, nothing is fetched and the local branch is read, which is where a one-shot write [8] lands there; when the clone never made the local branch, the copy of origin's it already holds (the one it was cloned with) is read instead. When neither copy exists, every read is absent. Nothing is fetched again for the reader's lifetime, and no checkout is held. A file the copy lacks reads as absent and a directory it lacks lists as empty.

### The one-shot write from any clone

#### Context

**User story**: an agent [4] claims a ticket or edits the agent queue [6] from its own checkout [2] or from a cloud session [5], and the change is on origin when the command returns.

**Problem**: the persistent checkout belongs to a long-lived process whose cycle stages everything it finds and resets the checkout on failure, so a second writer inside it would be committed under the wrong message or wiped.

#### Business logic

When the branch does not reach origin [9] (no `origin`, or sharing off), a one-shot write [8] has no remote to write to: the change goes through a write cycle [3] of the clone's persistent checkout, behind the one-at-a-time rule every process on the clone joins, and lands as a local commit; it reports whether anything changed, and a cycle that fails is thrown with its reason. Otherwise the branch is fetched from origin and a throwaway checkout of origin's tip is created in the system's temporary directory and registered with git as a worktree of the clone; when origin has no such branch yet, the write itself births it parentless from the empty tree with the message "create the <branch> branch". The change runs against the throwaway checkout and everything is staged; when nothing changed the write ends with no commit and no push, reporting no change. Otherwise the commit is made under the caller's message and pushed straight to the branch on origin. When the push loses a race, the throwaway checkout is reset to origin's re-fetched tip and the change runs again, once; a second failed push throws with git's reason, and there is nothing left to retry. Whether or not the push landed, the throwaway checkout is removed, its registration pruned, and its directory deleted. A write that goes to origin never touches the branch's persistent checkout and never moves the clone's local branch: the persistent checkout, when there is one, converges on its own next pull.

### A change sees plain files

#### Context

**Problem**: git keeps no empty directory, so a skill's folder vanishes with its last file and is absent on a newborn branch.

#### Business logic

A change is handed the checkout [2] directory and works with plain files under it: read one, write one, delete one, list a directory by file name. A write creates the missing parent directories. A read that cannot be made is reported to the change as a rejection it reads as "absent", and listing a missing directory yields no entries.

### The branch taken off this machine

#### Context

**User story**: the user removes a project from the dashboard and asks for OpenAgent's files in the folder to go too (`packages/openagent/src/remove-files.ts`). The branch and its checkout [2] leave this machine. What origin holds of the branch stays there.

**Problem**: the branch belongs to the whole repository, and several folders may be checkouts of it. A write or a pull may be under way in the branch's checkout at that moment. And a directory a person put where the checkout would be is not this module's to delete.

#### Business logic

Taking the branch off this machine answers two lists, in words for a person: what was removed, and what was kept with the reason. It never throws: a failure, a lock that could not be taken in time included, is answered with its reason.

- It works only from the clone's own directory. Asked from a second worktree of the clone, it removes nothing and answers `branch <branch>` as kept, with the reason `it belongs to the repository at <the clone's directory>`.
- When the repository has neither a directory at `.branches/<branch>` nor the local branch, nothing is touched, the checkout's lock included, and both lists are empty.
- Otherwise it joins the one-at-a-time order, so a write cycle [3] or a pull under way finishes first.
- The persistent checkout [2] goes first. When git knows `.branches/<branch>` as a worktree, it is removed, whatever it holds, and named `.branches/<branch>`. When something sits at that path and git does not know it as a worktree, it is left alone and named as kept, with the reason `not a checkout git knows`. Stale worktree registrations are pruned.
- Then the local branch is deleted and named `branch <branch>`. When git refuses, because the branch is checked out somewhere else, the branch is named as kept with the last line of git's reason.
- Last, once the turn is over and its lock file is gone, and only when the checkout was removed: the checkouts directory `.branches` is removed when nothing is left in it, and named `.branches`. It is never removed with contents: an agent's [4] checkout or anyone's file keeps it, and it is then not named at all. When the directory went, the rule `/.branches` is taken back out of git's own ignore file (the rule in `git-exclude.ts`), unless another checkout of the repository still has a `.branches` directory. A rule that cannot be taken out, or checkouts that cannot be listed, leave the rule there.

Nothing is fetched and nothing is pushed first. Origin's copy of the branch is never touched. Commits that never reached origin, because the person does not share the records or a push was still owed, are gone with the branch.

Forgetting the sharing [9] answer is a call of its own: the setting `agent-data.share` is removed from the repository's git config, and the call answers whether there was one. Sharing then reads as off, as for a repository that was never asked.
