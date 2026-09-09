Implements a branch of the project's repository used as a file store: files that programs read and write and nobody edits in a working copy, the way `gh-pages` holds a site, kept on a branch of their own so that no code commit is ever in their history. In the product that branch is the `agent-data` branch [1]; the caller names it, and this module knows git, not what the files mean. Two writers share one rule: a long-lived process (the daemon) writes through the branch's persistent checkout [2] under `.branches/<branch>` in a write cycle [3] (sync, apply, commit, push), and a command an agent [4] runs writes one-shot from any clone through a throwaway checkout of origin's tip; both treat the change as an intent that is re-applied when the push loses a race, and neither ever force-pushes.

## Context

**User story**: an agent [4] runs `npx tickets`, `npx queue` or `npx logs` from its own checkout [2], on the user's machine or in a cloud session [5], and sees the tickets, the agent queue [6] and the runs [7] every other machine pushed; the daemon's own records are on the remote a moment after they are written; the user's own branches and tracked files never change, and the user never sees a diff.

**Business logic story**: every skill package and the product's routine locks hand this module a change to apply to a directory and a commit message; this module owns the branch, its checkout, syncing, committing, pushing, and reading. "origin's copy of the branch" below means what the repository last fetched of the branch from its `origin` remote.

**Problem**: several machines and cloud sessions write one branch with no coordinator. A stale commit force-fitted onto the branch would erase another writer's change, a change left half written in the checkout would ride the next unrelated commit, and a hung git call would hold the daemon.

## Glossary

[1] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks. Born as an orphan, written through one sync → commit → push cycle.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. Also "the `agent-data` branch's checkout".
[3] write cycle: one write to the branch through its persistent checkout: sync with origin, apply the caller's change, commit, push; the change is re-applied when the push loses a race.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[5] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[6] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[7] run: the `logs` skill's record of one agent on the `agent-data` branch: a card and a diary. Never the unit of work.
[8] one-shot write: a write to the branch from any clone by a command that holds no checkout of the branch: a throwaway checkout of origin's tip is created, the change applied, committed and pushed, and the checkout removed.

## Business logic — TL;DR

- **The branch's checkout, hidden from git** - the branch is checked out once at `<repository>/.branches/<branch>`, registered with git as a worktree, and hidden through git's own ignore file rather than a committed `.gitignore`.
- **Adopted from origin or born an orphan** - a branch missing locally is taken from origin's copy; missing there too, it is born from the empty tree with the commit "create the <branch> branch", so no code commit is ever an ancestor.
- **Only `origin` is the remote** - every fetch and push names `origin`; a repository without it is remote-less whatever other remotes it has, with a stated outcome for each operation.
- **One write at a time** - writes and pulls to one branch of one repository run one after another within a process, never interleaved.
- **The write cycle** - sync with origin, apply the change to the checkout, commit whatever changed under the caller's message, push whenever the branch is ahead of origin's copy.
- **Sync: rebase onto origin, and origin wins a conflict** - unpushed local commits are rebased onto origin's copy; when the rebase fails, the checkout is reset to origin's copy and those commits are dropped, unreported.
- **A push that loses a race re-applies the change once** - the attempt's commit is wound back, the cycle re-syncs and re-applies; a second failed push keeps the commit local and reports it, for the next cycle to carry out; never a force push.
- **A failed change leaves the checkout clean** - any other failure, a timeout included, resets the checkout to its last commit, removes stray files, and is reported rather than thrown.
- **The pull** - a write cycle with no change, run on the daemon's clock so this machine converges on what others pushed and pushes what an earlier cycle left stranded; a repository with no remote is an error it names.
- **Reads from anywhere, and never a failure** - a file or a directory listing is read off the checkout, the local branch, or origin's copy, from any directory of the repository, an agent's checkout included; whatever is missing reads as absent.
- **A one-shot reader opens the branch once** - one fetch, then every read off origin's copy, so a command sees every writer's pushes, its own one-shot writes included.
- **The one-shot write from any clone** - a throwaway checkout of origin's tip, applied, committed, pushed straight to the branch and removed; it never touches the persistent checkout nor moves the local branch.
- **A change sees plain files** - the change is handed a directory and reads, writes, deletes and lists plain files in it; a write creates missing parent directories.

## Business logic

### The branch's checkout, hidden from git

#### Context

**Problem**: the project's own tracked files must never change because of the file store, and a per-worktree ignore file looks right but is silently never read by git.

#### Business logic

The branch's persistent checkout [2] lives at `<repository>/.branches/<branch>` and is registered with git as a worktree of the project's repository, beside the agents' [4] own checkouts. Every operation through the checkout first checks that the directory is checked out on the branch and, when it is, does nothing more: the common case, taken on every write. Otherwise the branch is made to exist locally (next section), any stale worktree registration at that path (the directory was deleted by hand) is pruned so that the add is not blocked, and the checkout is created. The rule `/.branches` is then appended to git's own ignore file, `info/exclude` in the repository's common git directory (the rule in `git-exclude.ts`), never to a committed `.gitignore`: one line written once covers every worktree of the repository, and no tracked file changes. That last step is best effort: the checkout stands even when the rule could not be written. Making sure the branch and its checkout exist never fails loudly: a project this cannot be set up in reports why and is left alone.

### Adopted from origin or born an orphan

#### Context

**Problem**: a second history born on a machine while origin already has one would leave two unrelated branches to reconcile, and a branch started from a code commit would carry the whole code history.

#### Business logic

A branch missing locally is first looked for on origin: when the repository has an `origin` remote the branch is fetched (a failed fetch is ignored), and origin's copy, when it exists, becomes the local branch. When origin has no such branch either, the branch is born parentless from git's empty tree with the commit message "create the <branch> branch", which touches no checkout and gives the branch a history that shares no commit with any code branch. A branch born locally is pushed by its first write cycle [3], even one whose change writes nothing, so origin gets it.

### Only `origin` is the remote

#### Context

See `## Context`.

#### Business logic

Every fetch and push names `origin`. A repository whose only remote has another name is remote-less to this module, with one stated outcome per operation instead of a push that fails twice: a write cycle [3] commits locally and reports success with nothing pushed; a one-shot write [8] refuses with the reason `no-remote`; the pull reports the error "the repository has no remote, so the <branch> branch cannot be shared with other machines". Outside any repository git can list no remote, so a one-shot write there is refused the same way.

### One write at a time

#### Context

**Problem**: a writer and the pull that interleaved on one checkout would commit each other's half-written files under the wrong message.

#### Business logic

Within one process, every write cycle [3], pull, and checkout setup for one branch of one repository runs one after another, in the order requested: the next waits for the previous to finish, and a failed one does not block the ones behind it. Two processes on one clone are not guarded against each other.

### The write cycle

#### Context

See `## Context`.

#### Business logic

A write cycle [3] applies one change through the persistent checkout [2], in this order:

- The checkout is made to exist.
- The checkout is synced with origin (next section).
- The caller's change runs against the checkout directory.
- Everything the checkout now differs by is staged, new files included, and committed when anything changed, under the caller's message: a fixed text, or a text computed after the change ran, since a batch only knows what it did once done.
- Without a remote, the cycle ends here: success, saying whether anything changed, with nothing pushed.
- With a remote, a push is owed whenever the local branch is ahead of origin's copy: this cycle's commit, an earlier cycle's commit the sync just rebased, or a branch origin does not have yet. When nothing is owed the cycle ends with nothing changed and nothing pushed; otherwise the branch is pushed to `origin` under its own name, never with force.

The outcome reports whether the change changed anything and whether a push went out, or a failure with its reason and whether the change still landed as a local commit.

### Sync: rebase onto origin, and origin wins a conflict

#### Context

**Problem**: a commit an earlier cycle could not push must not block every later write, and a conflict between it and what another machine pushed has no human to resolve it.

#### Business logic

Without a remote, a sync does nothing. With one, the branch is fetched from origin (a fetch that fails, the network being down, is ignored) and, when origin's copy exists, every unpushed local commit is rebased onto it. When the rebase fails for any reason, a conflict included, it is aborted and the checkout [2] is reset to origin's copy: the remote wins, every unpushed local commit is dropped without a report, and only the change of the current cycle is applied afterwards, against origin's state. Because the change is applied after the sync, an intent such as "append this entry" lands on top of the other machine's version rather than on the stale local one.

### A push that loses a race re-applies the change once

#### Context

**Problem**: two writers pushing the same branch cannot both land; the loser must neither force its stale commit over the winner's nor apply its change twice.

#### Business logic

The change is an intent and the commit only its serialization, so the caller's change must be safe to run again. When the push fails on the first attempt, the attempt's commit is wound back to the tip the cycle started from (when a commit was made), the cycle syncs again, bringing in what the other writer pushed, and runs the change again against the fresher files, so the change lands exactly once. When the push fails on the second attempt too (the network, most likely), the commit stays local in the checkout [2] and the cycle reports the failure as "the <branch> branch could not be pushed: <git's reason>", marked as committed: the next write cycle [3] or pull rebases that commit onto whatever origin has by then, and its push carries it out together with the new change. A push killed on its time budget counts as a failed push and may have landed anyway; the next sync's rebase absorbs a commit origin already has. The branch is never force-pushed.

### A failed change leaves the checkout clean

#### Context

**Problem**: files a change left half written would be swept into the next cycle's commit, under an unrelated message, by the staging of everything.

#### Business logic

When anything else fails inside the cycle, the change itself, a git call that fails, or a git call killed on its time budget (the budgets are the rule in `git.ts`), the checkout [2] is reset to its last commit and every file not under version control is removed, so nothing half written survives; the failure is reported with its reason and marked as not committed. A write cycle [3] never throws: its callers run on the daemon's clock with nothing to catch it.

### The pull

#### Context

**User story**: a machine that writes nothing still shows the tickets, the agent queue [6] and the runs [7] other machines and cloud sessions [5] pushed, without waiting for its next local write.

#### Business logic

The pull is a write cycle [3] with an empty change and the commit message "sync", behind the same one-at-a-time rule: it creates the checkout [2] when needed, so a fresh clone converges on its first pull; syncs in what others pushed; and pushes anything an earlier failed cycle left stranded, by the same owed-push rule. It reports success when converged with origin, and an error when the cycle failed or when the repository has no remote: a repository nothing can reach is an error state the caller has to surface, not a mode the pull supports. An error is also logged as "[branches] <branch>: <reason>". The pull never throws.

### Reads from anywhere, and never a failure

#### Context

**Problem**: an agent's [4] checkout holds none of the branch's files, and a read that could fail would turn every missing file into an error for every skill.

#### Business logic

A read starts by finding the repository a directory belongs to: the directory holding the real `.git`, which from an agent's [4] checkout [2] is the project's checkout the worktree was made from (worktrees share the repository's branches, so a read from an agent's checkout sees the same files without holding a copy). One file is read, in order, from the branch's persistent checkout on disk when this repository has one checked out on the branch and the file is there; else off the local branch; else off origin's copy of the branch (a clone that fetched but never branched, the cloud session's [5] case); it is absent when none of them has it. A read marked fresh, for a long-lived process about to act on the files where the local branch may trail what others pushed, fetches origin's copy first when there is a remote and reads it before the local branch, skipping the checkout. A directory's entries are listed by name off the local branch, else off origin's copy, and are empty when neither has the directory. A missing file, a missing branch, a git that could not run, and a directory outside any repository all read as absent, never as a failure.

### A one-shot reader opens the branch once

#### Context

**Problem**: a command an agent [4] runs holds no checkout [2], and its own one-shot writes [8] go straight to the remote without moving the local branch, so only origin's copy has every writer's pushes.

#### Business logic

A one-shot reader fetches the branch from origin once, when the repository has an `origin` remote, and then reads every file and directory off origin's copy; the local branch is read only when origin's copy is not there (no remote, or nothing ever fetched). Nothing is fetched again for the reader's lifetime, and no checkout is held. A file the copy lacks reads as absent and a directory it lacks lists as empty.

### The one-shot write from any clone

#### Context

**User story**: an agent [4] claims a ticket or edits the agent queue [6] from its own checkout [2] or from a cloud session [5], and the change is on origin when the command returns.

**Problem**: the persistent checkout belongs to a long-lived process whose cycle stages everything it finds and resets the checkout on failure, so a second writer inside it would be committed under the wrong message or wiped.

#### Business logic

A one-shot write [8] refuses with `no-remote` when the repository has no `origin`. Otherwise the branch is fetched from origin and a throwaway checkout of origin's tip is created in the system's temporary directory and registered with git as a worktree of the clone; when origin has no such branch yet, the write itself births it parentless from the empty tree with the message "create the <branch> branch". The change runs against the throwaway checkout and everything is staged; when nothing changed the write ends with no commit and no push, reporting no change. Otherwise the commit is made under the caller's message and pushed straight to the branch on origin. When the push loses a race, the throwaway checkout is reset to origin's re-fetched tip and the change runs again, once; a second failed push throws with git's reason, and there is nothing left to retry. Whether or not the push landed, the throwaway checkout is removed, its registration pruned, and its directory deleted. The write never touches the branch's persistent checkout and never moves the clone's local branch: the persistent checkout, when there is one, converges on its own next pull.

### A change sees plain files

#### Context

**Problem**: git keeps no empty directory, so a skill's folder vanishes with its last file and is absent on a newborn branch.

#### Business logic

A change is handed the checkout [2] directory and works with plain files under it: read one, write one, delete one, list a directory by file name. A write creates the missing parent directories. A read that cannot be made is reported to the change as a rejection it reads as "absent", and listing a missing directory yields no entries.
