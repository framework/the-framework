A branch used as a file store: a branch of the project's repository holding files nobody edits in a working tree — the way a `gh-pages` branch holds a published site — written and read by programs instead. The caller names the branch and decides what the files mean; this module knows git and the filesystem, nothing else. This is where such a branch is created, kept in step with `origin`, written to, and read from. The remote is always `origin`.

## User story

- The caller keeps files in the project's repository that are not code, and the project's own branches stay 100% code: a pull request shows code and nothing else.
- The user works from two machines and lets agents run in the cloud. Those files look the same everywhere, and a machine holding an older copy never silently overwrites what another machine wrote.
- A command an agent runs inside its own checkout reads those files without holding a copy of them, and writes them without disturbing the checkout a long-lived process writes through.

## Glossary

- **A branch used as a file store** - the branch described above: files written and read by programs, never anyone's working tree, and therefore safe to push and pull eagerly.
- **The persistent checkout** - the checkout of that branch a long-lived process keeps at `.branches/<branch>`, which it both reads from and writes through.
- **The operation** - the change a caller asks for, as something re-runnable: a function handed a directory to write files in, which the cycle running it may run more than once.
- **A funneled write** - a write through the persistent checkout: one serialized cycle of sync, run the operation, commit, push.
- **A detached write** - a one-shot write from any clone, through a throwaway worktree on origin's tip; nothing of it stays behind.
- **The eager pull** - a funneled write whose operation changes nothing, run to converge this machine with origin without waiting for a local write.

## Business logic — TL;DR

- **One branch, holding files nobody edits by hand** - the caller names it; nothing on it is anyone's working tree, so it can be pushed and pulled eagerly, which is what gives every machine and every cloud session the same view.
- **Born parentless, or adopted from origin** - a branch origin already has is adopted; a branch that has to be created here starts from an empty commit with no parent, so no code commit is ever an ancestor of the file history.
- **The persistent checkout, hidden from the project's git** - the branch is checked out at `.branches/<branch>`, named after its branch like every other checkout there, and that directory is hidden from the project's git.
- **One funnel, serialized per branch** - every write a long-lived process makes goes through one cycle — sync, run the operation, commit, push — and cycles for the same branch never interleave.
- **A write is an intent, not a commit** - when a push loses a race, the cycle syncs again and re-runs the operation against the fresher state instead of force-fitting a stale commit.
- **A push is owed until it lands** - a commit that could not be pushed stays local, and the next cycle carries it out, even when that cycle writes nothing of its own.
- **Conflicts resolve toward origin** - the checkout is nobody's working tree, so origin always wins and the local intent is re-applied on top.
- **A failed operation leaves nothing half-written** - the checkout is put back to its committed state before the failure is reported.
- **The eager pull** - the same cycle applying no change: it converges this machine with origin, pushes anything a failed cycle stranded, and creates the checkout if there is none.
- **A repository with no remote** - fine for a funneled write, an error for the pull, a refusal for a detached write.
- **Reading from anywhere in the repository** - the persistent checkout when this location has one, else the branch's ref, else origin's copy of it, so a reader holds no copy of the files; a read can ask for a fresh copy instead.
- **A reader that fetches once** - a reader opening many files fetches up front, picks one ref, and takes every read off it.
- **A detached one-shot write** - a command in any clone writes through a throwaway worktree on origin's tip and pushes straight to the branch, never touching the persistent checkout.
- **The files an operation writes** - reading, writing, deleting and listing the files under the directory an operation is handed, with parent directories created on write.

## Business logic

### One branch, holding files nobody edits by hand

#### User story

The caller keeps files in the project's repository that are not code, and the user reviewing a pull request sees only code.

#### Business logic

The files live on one branch of the project's repository, named by the caller. Because nothing on that branch is anyone's working tree, it is safe to push and pull eagerly, and that is what gives every machine and every cloud session the same view: fetch the branch, read the files, commit onto it, push.

The branch is created from origin's copy when there is one — the case on every machine after the first. When there is none, it is born here: its first commit is empty and has no parent, so no code commit is ever an ancestor of the file history, and creating it touches no checkout at all.

#### Rationale

One branch with one local writer removes two failures structurally. A writer can no longer clobber freshly-merged files with its own stale copy, because there is one copy and one funnel in front of it. And nothing a program writes can be stranded on a local code branch, because these commits land on a branch whose entire job is to be pushed.

### The persistent checkout

#### User story

A long-lived process reads these files on every tick and writes them many times an hour; it should not pay a checkout per read, and its checkout must never show up in the user's `git status`.

#### Business logic

The branch is checked out at `.branches/<branch>` — under the project, named after its branch, exactly like the agent checkouts beside it. The directory is hidden from the project's git through the repository's own exclude file, so no sweeping `git add -A` can commit it onto a code branch and no tracked file changes to achieve that; this may well be the first checkout the project ever gets.

Making sure the branch and its checkout exist is idempotent and cheap once they do — one read of the checkout's branch. A registration left behind by a directory someone deleted by hand is pruned first, so it cannot block the checkout being made again. Nothing here fails outright: a project this cannot be set up in reports why and is otherwise left alone.

### One funnel, serialized per branch

#### User story

Two background jobs write the same files in the same moment. Neither may see, or commit, a half-written state.

#### Business logic

Every write a long-lived process makes goes through one cycle: make sure the branch and its checkout exist, sync with origin, run the operation against the checkout, commit whatever it changed, push. Cycles are serialized per repository and branch, so two of them can never interleave — the eager pull included, since it is the same cycle applying no change.

A cycle never throws, because its callers run on background ticks with nobody to catch a failure. It reports one of three outcomes: it succeeded, saying whether anything changed and whether the push landed; or it failed with the change committed locally, meaning only the push failed and the next cycle will carry it; or it failed with nothing committed at all.

The commit message is the caller's, either fixed up front or resolved after the operation ran — a write that batches several changes only knows what it did once it is done.

### A write is an intent, not a commit

#### User story

Another machine pushes to the branch in the instant between this machine's sync and its push.

#### Business logic

The change is expressed as an operation that can be run again, not as a fixed commit. When the push loses the race, the cycle syncs again and runs the operation against the fresher state rather than force-fitting a stale commit — the operation is the intent, the commit is only its serialization. It tries twice; a push that still fails, most likely for want of a network, keeps the commit locally and reports that it did, so the caller knows the change survived even though it is not yet shared.

### A push is owed until it lands

#### Business logic

Whenever the local branch holds commits origin does not, the cycle pushes — even when this particular operation wrote nothing new. That is what carries out the commits an earlier failed cycle left behind. A cycle that writes nothing and owes nothing reports that it changed nothing and pushed nothing.

### Conflicts resolve toward origin

#### Business logic

Syncing fetches origin's copy of the branch and replays whatever local commits exist on top of it. When that cannot be done cleanly, the checkout is reset to origin's state outright. Nothing is lost by that, because the local intent is re-applied immediately afterwards by the cycle that is running — the whole design rests on the operation being re-runnable.

### A failed operation leaves nothing half-written

#### Business logic

When the operation itself fails, the checkout is put back to its committed state — every modification undone and every new file removed — before the failure is reported. Half-written files must not sit in the checkout waiting to ride along on the next, unrelated cycle's commit.

### The eager pull

#### User story

The user's other machine, or a cloud session, wrote one of these files ten minutes ago. This machine has to see it without anyone writing anything here first.

#### Business logic

The pull is the same cycle applying no change: it converges the checkout with origin and pushes anything a failed cycle stranded locally, under the same owed-push rule. It creates the branch and its checkout when there are none, so a freshly cloned repository converges on its first turn.

It reports why it could not converge — a push origin rejected, or no origin to converge with at all — and logs that reason, so a caller can surface it rather than swallow it.

### A repository with no remote

#### Business logic

A repository with no remote is fine for a funneled write: the commit is safe locally, and the write reports that it did not push. It is an error for the pull, whose entire job is to meet the other machines, and it is refused outright for a detached write, which has nothing but the remote to write through. A repository nothing else can reach is a state the caller has to surface, not a mode this supports.

### Reading from anywhere in the repository

#### User story

An agent working in its own checkout reads these files, and a freshly cloned machine reads them before the branch exists locally.

#### Business logic

Anywhere inside a repository — an agent's own checkout included — the repository a location belongs to is identified as the directory holding the repository's real git storage. From the main checkout that is the location itself; from a worktree it is the repository the worktree was made from, which is where the persistent checkout lives and the address every funneled write goes to.

One file is read from the persistent checkout when this repository has one; otherwise off the local branch, which is how an agent's own checkout reads the same files without holding any of them, since all checkouts of one repository share its refs; otherwise off origin's copy of the branch, which is the case on a machine that fetched but never created the branch locally. A file none of them has simply reads as absent, and a read never fails outright.

A read can ask for a fresh copy, which fetches first, skips the persistent checkout and prefers origin's version. That is for a reader about to act on the files, where the local ref may trail what other writers pushed.

The entries of one directory on the branch can be listed by name in the same way, always off a ref rather than off the checkout; a directory the branch does not have lists as none.

### A reader that fetches once

#### Business logic

A reader that opens many files opens the branch once instead: it fetches origin's copy up front, picks the ref every read will go to — origin's copy when the repository has one, else the local branch — and answers every file read and directory listing off that one ref, fetching nothing again. It names the ref it settled on, so a caller can say where what it read came from.

A one-shot command must see what other writers pushed, its own detached write included, and the local ref never moves for those; picking the ref once is also what keeps a reader that opens dozens of files from fetching dozens of times.

### A detached one-shot write

#### User story

An agent runs a command in its own checkout that has to add to these files. It must not wait for, or write through, the checkout a long-lived process owns — and on a machine where no such process runs, there is no such checkout at all.

#### Business logic

A detached write fetches origin's tip of the branch, checks it out in a throwaway worktree outside the repository, runs the operation there, commits, pushes straight to the branch, and removes the worktree afterwards — registration and directory both, whether it succeeded or not.

It follows the same intent rule as the funnel: a push that loses a race re-fetches, resets the worktree to origin's tip and runs the operation again, twice in all; a push that still fails is raised with git's own reason. A branch origin does not have yet is born by the write itself, parentless, exactly as it would be locally. An operation that writes nothing commits nothing and reports that it changed nothing. A repository with no remote is refused, and says so as its own outcome rather than as a failure.

It never touches the persistent checkout, and it never moves the local branch ref: the machine running a long-lived process converges on its own next pull.

#### Rationale

There are two writers because there are two callers with irreconcilable needs, and one rule holds both together.

A long-lived process writes often, reads the same files between writes, and must serialize its own writes against each other and against its eager pull. A persistent checkout is what makes those reads free and gives the serialization something to hold: one checkout, one chain of cycles, in one process.

A one-shot command runs in some clone, possibly on another machine, possibly with no long-lived process anywhere near it. It cannot join that process's chain — the chain lives in that process's memory — and it must not write inside its checkout: the funnel sweeps that checkout with `git add -A` and resets it when an operation fails, so a second writer's files there would either be committed under someone else's message or be wiped. So the one-shot writer brings its own throwaway worktree, on origin's tip, and settles the race the only way two processes can settle it: at the push.

What makes the two safe together is that both express a change as a re-runnable operation and let the push decide. Whoever loses re-syncs and re-applies, so neither writer has to know the other exists.

### The files an operation writes

#### Business logic

An operation is handed a directory and reads, writes, deletes and lists plain files under it. Writing creates parent directories, because the directory an operation expects is not a given: git keeps no empty directories, so removing the last file in one removes the directory, and a branch is born without any. Those file accesses are a seam the caller can substitute, so an operation can be tested without a disk or a repository.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
