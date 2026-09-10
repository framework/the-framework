Implements the `branches` skill [1]: one git worktree per agent [2] under the project's `.branches/` directory, the agent's checkout [3], named as its branch; made with everything an agent needs, renamed after the work once the agent names it, listed and sized for the dashboard, and reclaimed [4] once its work is on the remote, so nothing local is ever the last copy of anything. The daemon calls it as a library and every agent runs it as the `branches` command. The `*.BUG-ANALYSIS.md` notes beside the sources are review bookkeeping and carry no business logic.

## Context

**User story**: several agents [2] work one project at the same time, each in its own checkout [3] on its own branch, while the user's own working copy is never touched. An agent names its work and the dashboard labels it by that session name [5]; the user reaches any agent's checkout at `.branches/<branch>`. When an agent is done and its work is on the remote, its checkout disappears on its own; a checkout with uncommitted work stays until the user commits or throws it away.

**Problem**: git creates a worktree from the repository alone, with none of the dependencies or skill files an agent needs; git answers for any directory inside a repository, so a directory under `.branches/` that git no longer knows would make every command act on the user's own checkout; and nothing the product removes on its own may ever be the last copy of work, so only what is on the remote may go.

## Glossary

[1] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills), a command on the agent's PATH, and an API the product calls.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout" or "the user's checkout".
[4] reclaim: removing a finished agent's checkout once its work is on the remote.
[5] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[6] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[7] agent branch: a branch whose name starts with `agent-`, other than `agent-data`: the branch a checkout is created on, or the `agent-<session name>` it is renamed to. The only branches this package renames or deletes.
[8] birth branch: the branch a checkout is created on, `agent-<agent id>`, which also names the checkout's directory; the agent's branch until the agent names its work.
[9] worktree root: a directory that is itself the top level of a git worktree: the project's checkout, or an agent's checkout that git still knows as a worktree.
[10] coding agent: the CLI doing the actual work: Claude Code or Codex.
[11] branch link: a symbolic link under `.branches/`, named as the branch a checkout is on now and pointing at that checkout's directory, so `.branches/<branch>` reaches the checkout by its current branch name.
[12] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts (the daemon's log calls it the "worktree sweep"), the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[13] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.

## Business logic — TL;DR

- **The names** (`branch-names.ts`, `branch-names.test.ts`) - what an agent id [6] may look like (never `data`), that every branch the package mints is `agent-…` and slash-free, which branches are the package's to rename or delete (the agent branches [7]), and how the session name [5] is read back off a branch.
- **Git's worktree mechanism** (`worktree.ts`, `worktree.test.ts`, `worktree-size.test.ts`) - where a checkout [3] lives, creating one on a fresh birth branch [8] or on an existing branch, telling a checkout from a directory git does not know (a worktree root [9]), the project found from the `.branches/` layout, renaming the branch to the session name with `-2`, `-3` suffixes for taken names, removing and pruning, and the reads every decision needs: clean, on the remote, size on disk.
- **A checkout as an agent gets it** (`checkout.ts`) - one sequence for a new or a continued agent [2]: the worktree, `.branches/` hidden from git, the dependencies, the skills and the branch links, everything after the worktree best-effort.
- **The user's dependencies linked in** (`worktree-deps.ts`, `worktree-deps.test.ts`) - every `node_modules` down to two levels below the project root mirrored as a real directory of links, the package manager's private state left out, so an agent starts at once and an install in the checkout stays in the checkout.
- **The skill linked in** (`skill-links.ts`, `skill-links.test.ts`) - `SKILL.md` reachable where each coding agent [10] looks for skills at the checkout root, hidden from git, an existing entry left alone; further skills the caller names beside it.
- **The links under `.branches/`** (`branch-links.ts`, `branch-links.test.ts`) - a branch link [11] per checkout whose branch differs from its directory's name, stale ones dropped, nothing else touched; run after every change and as a sweep [12].
- **Reclaiming** (`reclaim.ts`, `reclaim.test.ts`) - only what is on the remote may go: the refusals `not-a-worktree`, `no-branch`, `dirty` and `not-on-remote`, the push when the caller allows it, and the branches that go with a reclaimed [4] checkout.
- **The `branches` command** (`cli.ts`, `cli.test.ts`) - `create`, `attach`, `name`, `status`, `list`, `remove` and `prune`: one JSON document on stdout, one line on stderr, exit code 0, 1 or 2.
- **The executable's home** (`bin-dir.ts`) - the `bin/` directory the daemon puts on every agent's PATH.
- **The entry point** (`index.ts`) - what the daemon and the dashboard import, and the naming rules alone for the dashboard's browser code.
- **A checkout's life** - made, named, listed and reclaimed: the flow across the files above.
- **Nothing runs through a directory git does not know** - the one guard every consumer of `.branches/` shares.

## Business logic

### A checkout's life

#### Context

See `## Context`.

#### Business logic

- The daemon, or `branches create`, makes the checkout [3] at `.branches/agent-<agent id>` on the birth branch [8] `agent-<agent id>`, from the project's head or a base the caller names (`worktree.ts`), then hides `.branches/` from git, links the dependencies and the skills in, and reconciles the branch links [11] (`checkout.ts`). `.branches/agent-data`, the checkout of the `agent-data` branch [13], sits beside the agents' checkouts and is never the package's to list, rename or delete.
- The agent [2] runs `branches status` to learn where it is and `branches name <name>` to name its work; the branch becomes `agent-<name>`, suffixed when the name is taken, while the directory keeps its name and the branch link `.branches/agent-<name>` reaches it (`worktree.ts`, `branch-links.ts`).
- The dashboard lists the checkouts on disk with their branch and size (`worktree.ts`, `cli.ts`).
- Once the agent is done, the daemon's sweep [12], the dashboard's "Remove" button or `branches remove` reclaims [4] the checkout under the one rule (`reclaim.ts`): a clean tree whose tip is on the remote, pushed on the way when allowed; a branch that held nothing and the birth branch the agent left behind go with it, and the branch links are reconciled again.
- A continued agent is put back on the branch its work is on, in a checkout named as its agent id [6] again and set up the same way (`worktree.ts`, `checkout.ts`).

### Nothing runs through a directory git does not know

#### Context

**Problem**: git answers for any directory inside a repository. A directory under `.branches/` that git no longer knows as a worktree (a checkout removed by hand, files written after a removal) makes every git command run in it act on the user's own checkout, on the user's own branch.

#### Business logic

A directory counts as a checkout [3] only when git reports that very directory as the top level of a worktree, a worktree root [9] (`worktree.ts`). Every consumer of a `.branches/` directory checks that first: the listing shows such a directory without a branch (`cli.ts`), the branch links [11] make none for it (`branch-links.ts`), `status` refuses it as `not-a-worktree` (`cli.ts`), naming refuses it (`worktree.ts`), and reclaiming [4] leaves it where it is, pushing and deleting nothing through it (`reclaim.ts`).
