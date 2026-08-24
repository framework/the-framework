Gives a fresh worktree a working dependency tree, so an agent can run the project's commands the moment it starts — shared with the parent checkout, yet safe for the agent to install into.

## User story

- The user starts an agent and it works immediately: it can run the tests, the build, the linter. It does not sit for a minute installing, and starting ten agents does not fill the disk.
- An agent changes a dependency and installs. That install must land in the agent's own checkout — never rewrite, and never delete, the dependencies of the user's checkout, which every later agent is handed.

## Business logic — TL;DR

- **Dependencies are shared, not copied** - each of the parent checkout's dependency directories is mirrored into the worktree at the same relative path, instantly and at no extra disk cost.
- **A real directory of links, never a linked directory** - the worktree gets a directory of its own holding one link per dependency entry, so an install inside the worktree writes into the worktree.
- **The package manager's private state stays behind** - the entries that mark a tree as the package manager's own install are not linked; the packages resolve without them.
- **Workspace packages get their own tree** - every dependency directory down to two levels below the repo root is mirrored, so a monorepo's packages work too.
- **Never fatal** - a link that cannot be made is skipped; a worktree with missing dependencies is a worse agent, not a failed one.

## Business logic

### Dependencies are shared, not copied

#### User story

See `## User story`: the agent works immediately, and ten agents cost no extra disk.

#### Business logic

Dependency directories are ignored by git, so a new worktree is handed an empty one and every command in it fails. Instead of copying or installing, each of the parent checkout's dependency directories is mirrored into the worktree at the same relative path: a real directory is created there, and inside it one link per entry of the parent's directory, pointing at that entry. A tree already present in the worktree is left alone, since the agent may have installed for itself already, and any missing parent directory is created first.

The scan looks for a dependency directory at the repo root and at every directory down to two levels below it, which covers a workspace's per-package dependencies without walking the whole tree. Dependency directories, the git directory, the framework's own directory, build outputs and dot-directories are never descended into. The result is ordered, so mirroring happens in a stable order.

#### Rationale

Three options existed: copy the tree (correct, but gigabytes per agent), install into each worktree (correct, but real waiting on every start), or link the parent checkout's trees in (instant, no extra disk, one store shared by all agents). Linking wins.

### A real directory of links, never a linked directory

#### User story

See `## User story`: an agent's install must stay in the agent's checkout.

#### Business logic

The worktree's dependency directory is a directory of its own, not a link to the parent's. When an agent installs in its worktree — which an agent that changes a dependency must — the package manager rewrites the entries of the worktree's directory and leaves the parent checkout's untouched. After the worktree is removed, the parent checkout's dependencies are exactly as they were.

The package manager's private state — every dot-entry of a dependency directory except the executables directory — is not linked. The executables directory is, because an agent runs the project's tools.

#### Rationale

Linking the directory itself made the parent's tree the worktree's install in the package manager's eyes: it resolved through the link, rewrote the parent checkout's workspace links to point into the worktree — which dangled once the worktree was removed — or, when told it was running unattended, purged the parent's tree outright. Either way every later agent died at boot. The private state is what tells the package manager "this tree is mine, installed here", so it stays out of the worktree; the packages resolve without it, because a package entry is itself a relative link into the package manager's store, and a link to that link resolves where the target lives — in the parent checkout.

Since the worktree's dependency directory is a real directory, the repo's own ignore rule for dependency directories covers it, and git never sees the links.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
