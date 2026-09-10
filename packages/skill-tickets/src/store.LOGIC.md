Binds the tickets to the `agent-data` branch [1] for a long-lived process, the daemon: where the branch's persistent checkout [2] sits under a project (`<root>/.branches/agent-data`, the tickets in its `tickets/`), the write cycle every claim, release and import lands through (apply to that checkout, commit, push), and the sync that brings the daemon's view of the branch up to date: a `tickets` link at the repository root pointing into the checkout, hidden from git, and the branch converging with origin.

## Context

**User story**: the user opens the project's own checkout and finds a `tickets` directory at its root listing the roadmap, one listing away, without switching branches; the dashboard shows the tickets other machines and cloud sessions [3] pushed, and a change the daemon made reaches every other machine.

**Business logic story**: the branch's birth, its sync with origin and the commit-and-push cycle are the `agent-data` package's rules; this file only binds them to the tickets. The `tickets` command in `cli.ts` does not use the persistent checkout: it writes through a throwaway checkout at origin's tip.

## Glossary

[1] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks. Born as an orphan, written through one sync → commit → push cycle.
[2] checkout: a git worktree under the project's `.branches/` directory, named as its branch: here "the `agent-data` branch's checkout".
[3] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.

## Business logic — TL;DR

- **Where the branch is checked out** - the persistent checkout is `<root>/.branches/agent-data`, and the tickets are its `tickets/` directory.
- **The write cycle** - an operation on the branch's files runs against the persistent checkout, then commits and pushes as one commit, one cycle at a time; writing a file creates its directory.
- **The `tickets` link at the repository root** - the sync links `tickets` at the project's root to `.branches/agent-data/tickets`, relatively, only when nothing of that name sits there; the link may dangle until the first ticket lands.
- **The link is hidden from git** - two rules in the repository's exclude file, `/tickets` then `!/tickets/`, hide the link while the checkout's real `tickets/` directory keeps committing.
- **Converging with origin** - the sync births the branch and its checkout when missing, adopts what origin has, pushes anything an earlier cycle left stranded, and reports why it could not converge ("no remote") instead of throwing.

## Business logic

### Where the branch is checked out

#### Context

See `## Context`.

#### Business logic

The branch's persistent checkout [2] is `<root>/.branches/agent-data` under the project's root, the place the `agent-data` package gives every branch it checks out, and the tickets are the `tickets/` directory inside it. That directory is where the daemon reads tickets from and where each write cycle applies its change.

### The write cycle

#### Context

**Problem**: the daemon writes the branch from several places at once (claims for the agents it starts, releases, an import of issues), and each write must reach origin as one commit or other machines read stale claims.

#### Business logic

An operation on the branch's files is applied to the persistent checkout [2], committed with the operation's own message, and pushed, as one cycle; cycles run one at a time, so two operations never interleave in one checkout. The cycle's own rules are the `agent-data` package's: a cycle that changes nothing commits nothing, a push that loses a race is re-applied on origin's new tip, and a cycle that could not commit restores the checkout. Writing a file creates the directory it lives in, so the first claim or ticket creates `tickets/` on a fresh branch. Reading, writing, removing and listing the branch's files, the cycle itself and the log line are each replaceable by the caller, so every operation on tickets can be judged off disk and off git.

### The `tickets` link at the repository root

#### Context

**User story**: see `## Context`. **Problem**: the branch may hold no ticket yet, so the link's target may not exist when the link is made.

#### Business logic

When nothing sits at `<root>/tickets` (no file, no directory, not even a dangling link), the sync creates a symbolic link there to the relative path `.branches/agent-data/tickets`, relative so that a moved repository keeps working. The target may not exist yet, so the link dangles until the first ticket lands on the branch. Anything already at that path is the user's and is left alone all the way: it is neither replaced nor hidden from git. A link that cannot be made is skipped silently and the sync goes on.

### The link is hidden from git

#### Context

**Problem**: an uncommitted entry at the repository root would ride any sweeping `git add -A` onto a code branch. The repository's exclude file speaks for every worktree at once, the persistent checkout included, whose root holds the real `tickets/` directory the branch exists to carry, so one rule hiding `tickets` would also swallow the branch's own cargo.

#### Business logic

Whenever nothing sits at `<root>/tickets`, together with making the link, two rules are added to the repository's exclude file (`.git/info/exclude`): `/tickets`, which hides a root entry of that name, then `!/tickets/`, which re-admits directories of that name, which a link never is. So the link never shows in `git status` on a code branch, while the checkout's `tickets/` directory keeps committing under the same repository-wide exclude. Each rule that cannot be written is skipped silently. The rules are never added for a `tickets` path of the user's own, which stays visible to git.

### Converging with origin

#### Context

See `## Context`.

#### Business logic

After the link, the sync brings the branch and its persistent checkout [2] into being when missing and up to date otherwise, by the `agent-data` package's rules: the branch is born as an orphan whose only commit is "create the agent-data branch", with nothing else of this package written on it; origin's branch is adopted when origin already has one; what other machines and cloud sessions [3] pushed is read; anything an earlier cycle left stranded is pushed; the checkout is left clean between cycles. The sync answers whether it converged and, when it could not, why: a repository with no remote is an error state, told "no remote", and the sync never throws. Running the sync again links nothing new and writes nothing.
